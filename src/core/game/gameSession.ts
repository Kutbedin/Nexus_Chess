import { Chess, type Move } from 'chess.js'
import type { Color, DropResult, GameOutcome, MoveRequest, PieceSymbol, PlayedMove, PromotionPiece, Square } from './types'

const UCI_RE = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/

export function parseUci(uci: string): MoveRequest {
  const m = UCI_RE.exec(uci)
  if (!m) throw new Error(`Invalid UCI move: ${uci}`)
  return { from: m[1] as Square, to: m[2] as Square, promotion: m[3] as PromotionPiece | undefined }
}

export function toUci(move: { from: string; to: string; promotion?: string }): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`
}

function toPlayed(m: Move): PlayedMove {
  return {
    from: m.from,
    to: m.to,
    san: m.san,
    uci: toUci(m),
    color: m.color,
    piece: m.piece,
    captured: m.captured,
    promotion: m.promotion,
    fenBefore: m.before,
    fenAfter: m.after,
  }
}

/**
 * Owns the authoritative game state. chess.js is the rules oracle; this class only adds
 * the translation between board gestures / engine UCI and chess.js, plus resignation.
 */
export class GameSession {
  private readonly chess: Chess
  private readonly startFen: string
  private resignedBy: Color | null = null

  constructor(fen?: string) {
    this.chess = fen ? new Chess(fen) : new Chess()
    this.startFen = this.chess.fen()
  }

  get fen(): string {
    return this.chess.fen()
  }

  get initialFen(): string {
    return this.startFen
  }

  get turn(): Color {
    return this.chess.turn()
  }

  get sanHistory(): string[] {
    return this.chess.history()
  }

  get moves(): PlayedMove[] {
    return this.chess.history({ verbose: true }).map(toPlayed)
  }

  get pgn(): string {
    return this.chess.pgn()
  }

  isInCheck(): boolean {
    return this.chess.inCheck()
  }

  pieceAt(square: Square): { type: PieceSymbol; color: Color } | null {
    return this.chess.get(square) ?? null
  }

  kingSquare(color: Color): Square | null {
    for (const row of this.chess.board()) for (const sq of row) if (sq?.type === 'k' && sq.color === color) return sq.square
    return null
  }

  legalTargets(from: Square): Square[] {
    return this.chess.moves({ square: from, verbose: true }).map((m) => m.to)
  }

  /**
   * Handles a drag/tap from the board. Promotion moves are not auto-queened:
   * the UI must ask the player and call `move()` with the chosen piece.
   */
  tryDrop(from: Square, to: Square): DropResult {
    if (this.outcome().kind !== 'ongoing') return { status: 'illegal' }
    const candidates = this.chess.moves({ square: from, verbose: true }).filter((m) => m.to === to)
    if (candidates.length === 0) return { status: 'illegal' }
    if (candidates.some((m) => m.isPromotion())) return { status: 'needs-promotion', from, to }
    return { status: 'moved', move: this.apply({ from, to }) }
  }

  move(req: MoveRequest): PlayedMove {
    if (this.outcome().kind !== 'ongoing') throw new Error('Game is over')
    return this.apply(req)
  }

  moveUci(uci: string): PlayedMove {
    return this.move(parseUci(uci))
  }

  resign(color: Color): void {
    if (this.outcome().kind === 'ongoing') this.resignedBy = color
  }

  outcome(): GameOutcome {
    if (this.resignedBy) return { kind: 'resigned', winner: this.resignedBy === 'w' ? 'b' : 'w' }
    const c = this.chess
    if (c.isCheckmate()) return { kind: 'checkmate', winner: c.turn() === 'w' ? 'b' : 'w' }
    if (c.isStalemate()) return { kind: 'draw', reason: 'stalemate' }
    if (c.isInsufficientMaterial()) return { kind: 'draw', reason: 'insufficient-material' }
    if (c.isThreefoldRepetition()) return { kind: 'draw', reason: 'threefold-repetition' }
    if (c.isDrawByFiftyMoves()) return { kind: 'draw', reason: 'fifty-move' }
    return { kind: 'ongoing' }
  }

  private apply(req: MoveRequest): PlayedMove {
    // chess.js throws on illegal moves; let it propagate so callers notice bugs.
    return toPlayed(this.chess.move({ from: req.from, to: req.to, promotion: req.promotion }))
  }
}
