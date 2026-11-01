import { EMPTY_PROGRESS, type PlayerProgress } from '../core/progression/levelMap'
import type { RevengeEntry } from '../core/revenge/revenge'
import { EMPTY_PUZZLE_STATS, type PuzzleStats, type StorageAdapter } from '../core/storage/storageAdapter'

const KEYS = {
  progress: 'nexus.progress.v1',
  revenge: 'nexus.revenge.v1',
  puzzles: 'nexus.puzzles.v1',
} as const

/**
 * Guest storage in localStorage. Safari may evict it after 7 days without a visit;
 * the Supabase adapter (anonymous auth) replaces it next phase.
 */
export class LocalStorageAdapter implements StorageAdapter {
  private readonly storage: Storage

  constructor(storage: Storage = window.localStorage) {
    this.storage = storage
  }

  /** Asks the browser not to evict our data under storage pressure (best effort). */
  static async requestPersistence(): Promise<boolean> {
    try {
      return (await navigator.storage?.persist?.()) ?? false
    } catch {
      return false
    }
  }

  async loadProgress(): Promise<PlayerProgress> {
    const p = this.read<PlayerProgress>(KEYS.progress)
    return p?.version === 1 ? p : EMPTY_PROGRESS
  }

  async saveProgress(progress: PlayerProgress): Promise<void> {
    this.write(KEYS.progress, progress)
  }

  async loadRevenge(): Promise<RevengeEntry[]> {
    const r = this.read<RevengeEntry[]>(KEYS.revenge)
    return Array.isArray(r) ? r : []
  }

  async saveRevenge(entries: readonly RevengeEntry[]): Promise<void> {
    this.write(KEYS.revenge, entries)
  }

  async loadPuzzleStats(): Promise<PuzzleStats> {
    const s = this.read<PuzzleStats>(KEYS.puzzles)
    return s?.version === 1 ? s : EMPTY_PUZZLE_STATS
  }

  async savePuzzleStats(stats: PuzzleStats): Promise<void> {
    this.write(KEYS.puzzles, stats)
  }

  private read<T>(key: string): T | null {
    try {
      const raw = this.storage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  }

  private write(key: string, value: unknown): void {
    this.storage.setItem(key, JSON.stringify(value))
  }
}
