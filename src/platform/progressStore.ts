import { EMPTY_PROGRESS, type PlayerProgress } from '../core/progression/levelMap'

/**
 * Persistence port. Phase 1a ships the localStorage adapter (guest play, no account);
 * a Supabase adapter implements the same interface once accounts exist.
 */
export interface ProgressRepository {
  load(): Promise<PlayerProgress>
  save(progress: PlayerProgress): Promise<void>
}

const KEY = 'nexus.progress.v1'

export class LocalProgressRepository implements ProgressRepository {
  private readonly storage: Storage

  constructor(storage: Storage = window.localStorage) {
    this.storage = storage
  }

  async load(): Promise<PlayerProgress> {
    try {
      const raw = this.storage.getItem(KEY)
      if (!raw) return EMPTY_PROGRESS
      const parsed = JSON.parse(raw) as PlayerProgress
      return parsed.version === 1 ? parsed : EMPTY_PROGRESS
    } catch {
      return EMPTY_PROGRESS
    }
  }

  async save(progress: PlayerProgress): Promise<void> {
    this.storage.setItem(KEY, JSON.stringify(progress))
  }
}
