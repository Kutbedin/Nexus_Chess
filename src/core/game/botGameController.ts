import { buildCoachReport, type CoachMessage } from '../coach/coach'
import { reactionForMove, reactionForOutcome } from '../bots/reactions'
import { bookMove, chooseEngineMove } from '../bots/selectMove'
import type { BotPersonality, ReactionEvent } from '../bots/types'
import type { EnginePort } from '../engine/types'
import type { Rng } from '../random'
import { GameSession } from './gameSession'
import type { Color, GameOutcome, PlayedMove, PromotionPiece, Square } from './types'

export interface BotGameState {
  fen: string
  playerColor: Color
  turn: Color
  inCheck: boolean
  botThinking: boolean
  outcome: GameOutcome
  moves: PlayedMove[]
  lastMove: PlayedMove | null
  pendingPromotion: { from: Square; to: Square } | null
  reaction: ReactionEvent | null
  /** Filled once the game ends. */
  coach: CoachMessage[] | null
}

export interface BotGameOptions {
  bot: BotPersonality
  engine: EnginePort
  playerColor: Color
  rng: Rng
  /** Minimum bot "thinking" time so instant replies don't feel robotic. */
  minThinkMs?: number
  startFen?: string
}

type Listener = (state: BotGameState) => void

/**
 * Orchestrates one game against a bot. Contains no React or DOM code so it can be
 * unit-tested with a fake engine and reused by any UI shell (web, Capacitor).
 */
export class BotGameController {
  private readonly session: GameSession
  private readonly listeners = new Set<Listener>()
  private state: BotGameState
  private pending: Promise<void> = Promise.resolve()
  private disposed = false
  private readonly opts: BotGameOptions

  constructor(opts: BotGameOptions) {
    this.opts = opts
    this.session = new GameSession(opts.startFen)
    this.state = this.snapshot({ reaction: 'greeting', pendingPromotion: null, botThinking: false })
  }

  getState(): BotGameState {
    return this.state
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  start(): void {
    if (this.session.turn !== this.opts.playerColor) this.scheduleBotMove()
  }

  legalTargets(from: Square): Square[] {
    return this.isPlayersTurn() ? this.session.legalTargets(from) : []
  }

  ownsPiece(square: Square): boolean {
    return this.session.pieceAt(square)?.color === this.opts.playerColor
  }

  kingSquare(color: Color): Square | null {
    return this.session.kingSquare(color)
  }

  /** Board gesture. Returns true if the piece should stay where it was dropped. */
  playerDrop(from: Square, to: Square): boolean {
    if (!this.isPlayersTurn()) return false
    const result = this.session.tryDrop(from, to)
    if (result.status === 'illegal') return false
    if (result.status === 'needs-promotion') {
      this.update({ pendingPromotion: { from, to } })
      return false
    }
    this.afterPlayerMove(result.move)
    return true
  }

  choosePromotion(piece: PromotionPiece): void {
    const p = this.state.pendingPromotion
    if (!p) return
    const move = this.session.move({ from: p.from, to: p.to, promotion: piece })
    this.afterPlayerMove(move)
  }

  cancelPromotion(): void {
    this.update({ pendingPromotion: null })
  }

  resign(): void {
    this.session.resign(this.opts.playerColor)
    this.finishIfOver()
  }

  /** Resolves when the bot has finished its current move (for tests and UI sequencing). */
  settled(): Promise<void> {
    return this.pending
  }

  dispose(): void {
    this.disposed = true
    this.opts.engine.stop()
    this.listeners.clear()
  }

  private isPlayersTurn(): boolean {
    return (
      !this.state.botThinking &&
      this.session.outcome().kind === 'ongoing' &&
      this.session.turn === this.opts.playerColor
    )
  }

  private afterPlayerMove(move: PlayedMove): void {
    const reaction = reactionForMove(move, this.botColor, this.session.isInCheck())
    this.update({ pendingPromotion: null, reaction })
    if (!this.finishIfOver()) this.scheduleBotMove()
  }

  private get botColor(): Color {
    return this.opts.playerColor === 'w' ? 'b' : 'w'
  }

  private scheduleBotMove(): void {
    this.update({ botThinking: true })
    this.pending = this.playBotMove().finally(() => {
      if (!this.disposed) this.update({ botThinking: false })
    })
  }

  private async playBotMove(): Promise<void> {
    const { bot, engine, rng, minThinkMs = 0 } = this.opts
    const fen = this.session.fen
    const started = Date.now()
    let uci = bookMove(bot.book, this.session.moves.map((m) => m.uci), fen, rng)
    if (!uci) {
      const lines = await engine.analyse(fen, { multiPv: bot.search.multiPv, depth: bot.search.depth })
      uci = chooseEngineMove(fen, lines, bot, rng)
    }
    const wait = minThinkMs - (Date.now() - started)
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    if (this.disposed || this.session.fen !== fen) return
    if (!uci) throw new Error('Engine returned no move in a non-terminal position')
    const move = this.session.moveUci(uci)
    this.update({ reaction: reactionForMove(move, this.botColor, this.session.isInCheck()) ?? this.state.reaction })
    this.finishIfOver()
  }

  private finishIfOver(): boolean {
    const outcome = this.session.outcome()
    if (outcome.kind === 'ongoing') return false
    this.update({
      reaction: reactionForOutcome(outcome, this.botColor),
      coach: buildCoachReport(this.session.moves, this.opts.playerColor),
    })
    return true
  }

  private snapshot(partial: Pick<BotGameState, 'reaction' | 'pendingPromotion' | 'botThinking'> & Partial<BotGameState>): BotGameState {
    const moves = this.session.moves
    return {
      coach: null,
      ...partial,
      fen: this.session.fen,
      playerColor: this.opts.playerColor,
      turn: this.session.turn,
      inCheck: this.session.isInCheck(),
      outcome: this.session.outcome(),
      moves,
      lastMove: moves.at(-1) ?? null,
    }
  }

  private update(partial: Partial<BotGameState>): void {
    if (this.disposed) return
    this.state = this.snapshot({ ...this.state, ...partial })
    for (const l of this.listeners) l(this.state)
  }
}
