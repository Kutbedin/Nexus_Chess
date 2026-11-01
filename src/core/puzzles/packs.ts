import type { PuzzleStats } from '../storage/storageAdapter'

/** One curated puzzle as stored in `public/puzzles/pack-NN.json` (see scripts/build-puzzles.mjs). */
export interface PackPuzzle {
  id: string
  /** Position with the solver to move (the opponent's setup move is already applied). */
  fen: string
  /** The opponent's setup move, for last-move highlighting. */
  setup: string
  /** Solver moves and forced replies in UCI, alternating, starting with the solver. */
  moves: string[]
  rating: number
  primary: string
  themes: string[]
}

export interface PackInfo {
  id: string
  file: string
  count: number
  minRating: number
  maxRating: number
  themeCounts: Record<string, number>
}

export interface PackManifest {
  version: 1
  source: string
  generatedAt: string
  total: number
  packs: PackInfo[]
}

/** Share of a pack that must be solved before the next (harder) pack opens. */
export const PACK_UNLOCK_SHARE = 0.5

export function solvedCountsByPack(manifest: PackManifest, stats: PuzzleStats): number[] {
  const counts = new Map<string, number>()
  for (const s of Object.values(stats.solved)) if (s.pack) counts.set(s.pack, (counts.get(s.pack) ?? 0) + 1)
  return manifest.packs.map((p) => counts.get(p.id) ?? 0)
}

/** Pack 1 is always open; pack N opens once half of pack N-1 is solved. */
export function isPackUnlocked(index: number, solvedCounts: readonly number[], manifest: PackManifest): boolean {
  if (index === 0) return true
  const prev = manifest.packs[index - 1]
  return (solvedCounts[index - 1] ?? 0) >= Math.ceil(prev.count * PACK_UNLOCK_SHARE)
}

/** Next unsolved puzzle, optionally restricted to a theme; falls back to solved ones for replay. */
export function nextPuzzle(
  puzzles: readonly PackPuzzle[],
  stats: PuzzleStats,
  options: { theme?: string; exclude?: ReadonlySet<string> } = {},
): PackPuzzle | null {
  const matching = puzzles.filter((p) => (!options.theme || p.themes.includes(options.theme)) && !options.exclude?.has(p.id))
  return matching.find((p) => !stats.solved[p.id]) ?? matching[0] ?? null
}

export function recordPuzzleSolved(stats: PuzzleStats, id: string, packId: string, firstTry: boolean, now: number): PuzzleStats {
  const prev = stats.solved[id]
  return { ...stats, solved: { ...stats.solved, [id]: { firstTry: prev ? prev.firstTry : firstTry, at: now, pack: packId } } }
}
