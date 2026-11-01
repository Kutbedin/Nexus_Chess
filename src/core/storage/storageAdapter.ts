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
 * Phase 1a: local adapter (localStorage). Next phase: Supabase with anonymous auth, because
 * Safari (ITP) evicts script-writable storage after 7 days without interaction.
 */
export interface StorageAdapter {
  loadProgress(): Promise<PlayerProgress>
  saveProgress(progress: PlayerProgress): Promise<void>
  loadRevenge(): Promise<RevengeEntry[]>
  saveRevenge(entries: readonly RevengeEntry[]): Promise<void>
  loadPuzzleStats(): Promise<PuzzleStats>
  savePuzzleStats(stats: PuzzleStats): Promise<void>
}
