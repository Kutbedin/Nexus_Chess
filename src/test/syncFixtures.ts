import type { RevengeEntry } from '../core/revenge/revenge'
import { recordKey, type SyncRecord } from '../core/storage/cloudSync'
import type { CloudBackend } from '../core/storage/cloudSyncedStorage'

export function revengeEntry(id: string, createdAt: number, box = 0, fen = `fen-${id}`): RevengeEntry {
  return {
    puzzle: { id, fen, solutionUci: 'e2e4', kind: 'missedWin', botId: 'minik', moveNumber: 5, playedSan: 'Qh5', createdAt },
    review: { box, dueAt: createdAt, lapses: 0 },
  }
}

/** In-memory server with the same newest-wins rule as the `keep_newest` trigger. */
export class MemoryBackend implements CloudBackend {
  readonly rows = new Map<string, SyncRecord>()
  online = true
  sessions = 0
  pushes: SyncRecord[][] = []

  seed(records: readonly SyncRecord[]): this {
    for (const r of records) this.rows.set(recordKey(r.kind, r.id), structuredClone(r))
    return this
  }

  async ensureSession(): Promise<void> {
    this.check()
    this.sessions++
  }

  async pull(): Promise<SyncRecord[]> {
    this.check()
    return [...this.rows.values()].map((r) => structuredClone(r))
  }

  async push(records: readonly SyncRecord[]): Promise<void> {
    this.check()
    this.pushes.push(records.map((r) => structuredClone(r)))
    for (const r of records) {
      const key = recordKey(r.kind, r.id)
      const prev = this.rows.get(key)
      if (!prev || r.updatedAt >= prev.updatedAt) this.rows.set(key, structuredClone(r))
    }
  }

  get(kind: SyncRecord['kind'], id: string): SyncRecord | undefined {
    return this.rows.get(recordKey(kind, id))
  }

  private check() {
    if (!this.online) throw new Error('offline')
  }
}
