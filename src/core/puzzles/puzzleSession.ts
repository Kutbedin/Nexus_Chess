import { GameSession, parseUci } from '../game/gameSession'
import type { PlayedMove, PromotionPiece, Square } from '../game/types'

export type PuzzleMoveResult =
  | { status: 'illegal' }
  | { status: 'needs-promotion'; from: Square; to: Square }
  | { status: 'wrong'; expected: string }
  | { status: 'correct'; reply: PlayedMove | null }
  | { status: 'solved' }

/**
 * Solves a line of alternating moves (solver first). Wrong moves are not applied, so the
 * player can retry; any checkmating move on the last step is accepted.
 */
export class PuzzleSession {
  private readonly game: GameSession
  private readonly solution: readonly string[]
  private step = 0
  private mistakes = 0

  constructor(fen: string, solution: readonly string[]) {
    if (solution.length === 0) throw new Error('Puzzle needs at least one move')
    this.game = new GameSession(fen)
    this.solution = solution
  }

  get fen(): string {
    return this.game.fen
  }

  get solver(): 'w' | 'b' {
    return new GameSession(this.game.initialFen).turn
  }

  get isSolved(): boolean {
    return this.step >= this.solution.length
  }

  get firstTry(): boolean {
    return this.mistakes === 0
  }

  get lastMove(): PlayedMove | null {
    return this.game.moves.at(-1) ?? null
  }

  get expectedMove(): string | null {
    return this.solution[this.step] ?? null
  }

  legalTargets(from: Square): Square[] {
    return this.isSolved ? [] : this.game.legalTargets(from)
  }

  ownsPiece(square: Square): boolean {
    return this.game.pieceAt(square)?.color === this.game.turn
  }

  tryMove(from: Square, to: Square, promotion?: PromotionPiece): PuzzleMoveResult {
    if (this.isSolved) return { status: 'illegal' }
    if (!this.game.legalTargets(from).includes(to)) return { status: 'illegal' }
    const expected = this.solution[this.step]
    const isPromotion = this.isPromotionMove(from, to)
    if (isPromotion && !promotion) return { status: 'needs-promotion', from, to }

    const uci = `${from}${to}${promotion ?? ''}`
    const isLast = this.step === this.solution.length - 1
    if (uci !== expected && !(isLast && this.mates(uci))) {
      this.mistakes++
      return { status: 'wrong', expected }
    }
    this.game.moveUci(uci)
    this.step++
    if (this.isSolved) return { status: 'solved' }
    const reply = this.game.moveUci(this.solution[this.step])
    this.step++
    if (this.isSolved) return { status: 'solved' }
    return { status: 'correct', reply }
  }

  /** Reveals the expected move (counts as a mistake). */
  hint(): { from: Square; to: Square } | null {
    const next = this.expectedMove
    if (!next) return null
    this.mistakes++
    const { from, to } = parseUci(next)
    return { from, to }
  }

  private isPromotionMove(from: Square, to: Square): boolean {
    const probe = new GameSession(this.game.fen)
    return probe.tryDrop(from, to).status === 'needs-promotion'
  }

  private mates(uci: string): boolean {
    const probe = new GameSession(this.game.fen)
    try {
      probe.moveUci(uci)
    } catch {
      return false
    }
    const o = probe.outcome()
    return o.kind === 'checkmate'
  }
}
