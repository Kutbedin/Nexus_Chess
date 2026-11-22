import type { PlayerProgress } from '../progression/levelMap'
import type { RevengeEntry } from '../revenge/revenge'

/** Per-puzzle outcome. `firstTry` = solved without a wrong move on the first attempt. */
export interface PuzzleStats {
  version: 1
  solved: Readonly<Record<string, { firstTry: boolean; at: number; pack?: string }>>
}

export const EMPTY_PUZZLE_STATS: PuzzleStats = { version: 1, solved: {} }

/**
 * Persistence port for everything the player accumulates.
 * Local adapter (localStorage) is always the primary/offline cache; when Supabase is configured,
 * `CloudSyncedStorage` wraps it and backs it up under an anonymous account.
 */
export interface StorageAdapter {
  loadProgress(): Promise<PlayerProgress>
  saveProgress(progress: PlayerProgress): Promise<void>
  loadRevenge(): Promise<RevengeEntry[]>
  saveRevenge(entries: readonly RevengeEntry[]): Promise<void>
  loadPuzzleStats(): Promise<PuzzleStats>
  savePuzzleStats(stats: PuzzleStats): Promise<void>
  /** Called when stored data changed underneath the UI (e.g. a cloud sync merged newer records); reload then. */
  subscribe?(listener: () => void): () => void
}
