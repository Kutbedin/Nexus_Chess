import { scoreToCp, type CandidateLine } from '../engine/types'

export interface RevengeCriteria {
  /** Best move must be at least this good for the side to move. */
  minWinningCp: number
  /** Second-best move must be at least this much worse, so there is a single clear answer. */
  minGapCp: number
}

export const DEFAULT_REVENGE_CRITERIA: RevengeCriteria = { minWinningCp: 200, minGapCp: 150 }

/**
 * Decides whether a position (taken from the player's blunder) makes a fair puzzle.
 * Requires MultiPV >= 2 analysis of the position with the player to move.
 */
export function singleClearWinningMove(
  lines: readonly CandidateLine[],
  criteria: RevengeCriteria = DEFAULT_REVENGE_CRITERIA,
): string | null {
  const sorted = [...lines].sort((a, b) => scoreToCp(b.score) - scoreToCp(a.score))
  const [best, second] = sorted
  if (!best || best.pv.length === 0) return null
  const bestCp = scoreToCp(best.score)
  if (bestCp < criteria.minWinningCp) return null
  // A lone legal move is "forced", not a puzzle.
  if (!second) return null
  if (bestCp - scoreToCp(second.score) < criteria.minGapCp) return null
  return best.pv[0]
}

export interface RevengePuzzle {
  id: string
  fen: string
  solutionUci: string
  sourceGameId: string
  createdAt: number
}
