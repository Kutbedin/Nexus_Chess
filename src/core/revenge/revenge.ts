import { scoreToCp, type CandidateLine } from '../engine/types'
import { isDue, isMastered, newReviewState, review, type ReviewState } from './srs'

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

/** What the player missed; drives the story line ("the mate you missed against Minik Mert"). */
export type RevengeKind = 'missedMate' | 'missedWin'

export interface RevengePuzzle {
  /** `${gameId}:${ply}` — stable, so re-analysing a game never duplicates puzzles. */
  id: string
  /** Position before the player's mistake, player to move. */
  fen: string
  solutionUci: string
  kind: RevengeKind
  /** Mate distance in moves, for missedMate. */
  mateIn?: number
  botId: string
  moveNumber: number
  /** What the player actually played (English SAN; localized for display). */
  playedSan: string
  createdAt: number
}

export interface RevengeEntry {
  puzzle: RevengePuzzle
  review: ReviewState
}

/** Adds new puzzles (skipping duplicate ids and positions) and caps the queue size. */
export function addRevengePuzzles(entries: readonly RevengeEntry[], puzzles: readonly RevengePuzzle[], maxEntries = 200): RevengeEntry[] {
  const ids = new Set(entries.map((e) => e.puzzle.id))
  const fens = new Set(entries.map((e) => e.puzzle.fen))
  const added = puzzles
    .filter((p) => !ids.has(p.id) && !fens.has(p.fen))
    .map((p) => ({ puzzle: p, review: newReviewState(p.createdAt) }))
  return [...entries, ...added].slice(-maxEntries)
}

export function dueRevenge(entries: readonly RevengeEntry[], now: number): RevengeEntry[] {
  return entries.filter((e) => !isMastered(e.review) && isDue(e.review, now)).sort((a, b) => a.review.dueAt - b.review.dueAt)
}

export function recordRevengeAttempt(entries: readonly RevengeEntry[], id: string, solved: boolean, now: number): RevengeEntry[] {
  return entries.map((e) => (e.puzzle.id === id ? { ...e, review: review(e.review, solved, now) } : e))
}
