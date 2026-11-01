import type { EnginePort } from '../engine/types'
import { scoreToCp } from '../engine/types'
import { GameSession } from '../game/gameSession'
import type { Color, PlayedMove } from '../game/types'
import { DEFAULT_REVENGE_CRITERIA, singleClearWinningMove, type RevengeCriteria, type RevengePuzzle } from './revenge'

export interface RevengeAnalysisOptions {
  depth: number
  /** Minimum eval drop (best line vs. played move) to call the move a blunder. */
  minDropCp: number
  maxPerGame: number
  criteria: RevengeCriteria
}

export const DEFAULT_ANALYSIS: RevengeAnalysisOptions = {
  depth: 12,
  minDropCp: 150,
  maxPerGame: 3,
  criteria: DEFAULT_REVENGE_CRITERIA,
}

export interface GameContext {
  gameId: string
  botId: string
  now: number
}

/**
 * Background pass over a finished game: for each player move, ask the engine whether a
 * single clearly winning move existed and the player missed it. Two searches per
 * candidate move (before: MultiPV 2; after: MultiPV 1), skipped when the player found the best move.
 */
export async function findRevengePuzzles(
  moves: readonly PlayedMove[],
  player: Color,
  engine: EnginePort,
  ctx: GameContext,
  options: Partial<RevengeAnalysisOptions> = {},
): Promise<RevengePuzzle[]> {
  const opts = { ...DEFAULT_ANALYSIS, ...options }
  const found: RevengePuzzle[] = []

  for (let ply = 0; ply < moves.length && found.length < opts.maxPerGame; ply++) {
    const move = moves[ply]
    if (move.color !== player) continue

    const before = await engine.analyse(move.fenBefore, { multiPv: 2, depth: opts.depth })
    const solution = singleClearWinningMove(before, opts.criteria)
    if (!solution || solution === move.uci) continue

    const playedCp = await evalAfter(move, engine, opts.depth)
    const best = before.find((l) => l.pv[0] === solution)!
    if (scoreToCp(best.score) - playedCp < opts.minDropCp) continue

    const mate = best.score.type === 'mate' && best.score.value > 0 ? best.score.value : undefined
    found.push({
      id: `${ctx.gameId}:${ply}`,
      fen: move.fenBefore,
      solutionUci: solution,
      kind: mate ? 'missedMate' : 'missedWin',
      mateIn: mate,
      botId: ctx.botId,
      moveNumber: Math.floor(ply / 2) + 1,
      playedSan: move.san,
      createdAt: ctx.now,
    })
  }
  return found
}

/** Eval of the played move from the player's point of view. */
async function evalAfter(move: PlayedMove, engine: EnginePort, depth: number): Promise<number> {
  const outcome = new GameSession(move.fenAfter).outcome()
  if (outcome.kind === 'checkmate') return 100_000
  if (outcome.kind === 'draw') return 0
  const lines = await engine.analyse(move.fenAfter, { multiPv: 1, depth })
  return lines[0] ? -scoreToCp(lines[0].score) : 0
}
