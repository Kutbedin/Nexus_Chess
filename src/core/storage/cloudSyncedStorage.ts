import type { PlayerProgress } from '../progression/levelMap'
import type { RevengeEntry } from '../revenge/revenge'
import {
  canonicalJson,
  fromMap,
  fromRecords,
  isValidRecord,
  mergeRecords,
  RECORD_KINDS,
  recordKey,
  recordsToPush,
  toMap,
  toRecords,
  type LocalValues,
  type RecordKind,
  type SyncRecord,
  type SyncStamps,
} from './cloudSync'
import type { PuzzleStats, StorageAdapter } from './storageAdapter'

/** Remote side of the backup (Supabase in production). Every call may reject when offline. */
export interface CloudBackend {
  /** Restores the saved session or signs in anonymously — no signup screen. */
  ensureSession(): Promise<void>
  /** All of this user's records. */
  pull(): Promise<SyncRecord[]>
  /** Upserts records; the server keeps whichever copy has the newer `updatedAt`. */
  push(records: readonly SyncRecord[]): Promise<void>
}

/**
 * Design for the later "link account" step: the anonymous user becomes an email user with the
 * same user id, so every backed-up row stays theirs and nothing has to be copied.
 * Adults only (players/teachers); never offered in school mode.
 */
export interface AccountLinkPort {
  accountStatus(): Promise<'anonymous' | 'linked' | 'signedOut'>
  /** Sends a confirmation mail; the account is linked once the player clicks it. */
  requestEmailLink(email: string): Promise<void>
}

export interface StampStore {
  load(): SyncStamps
  save(stamps: SyncStamps): void
}

export type SyncOutcome = 'synced' | 'offline' | 'failed'

export interface CloudSyncedStorageOptions {
  local: StorageAdapter
  stamps: StampStore
  backend: CloudBackend
  now: () => number
  isOnline: () => boolean
  /** How long the first load waits for the cloud before answering from the local cache. */
  initialSyncTimeoutMs?: number
  /** Debounce for pushing local changes. */
  pushDelayMs?: number
}

/**
 * Local-first storage with cloud backup. Reads and writes always hit the local cache, so the app
 * works offline exactly as before; changes are stamped per record and pushed in the background.
 * A full reconcile (pull, merge newest-per-record, push) runs on start and whenever the app comes back online.
 */
export class CloudSyncedStorage implements StorageAdapter {
  private readonly opts: Required<CloudSyncedStorageOptions>
  private ready: Promise<unknown> = Promise.resolve()
  private queue: Promise<unknown> = Promise.resolve()
  /** What the UI last loaded or saved, per kind — the base for detecting which records it changed. */
  private readonly view: Partial<LocalValues> = {}
  private readonly pending = new Set<string>()
  private readonly listeners = new Set<() => void>()
  private pushTimer: ReturnType<typeof setTimeout> | undefined
  private reconciling: Promise<SyncOutcome> | null = null

  constructor(options: CloudSyncedStorageOptions) {
    this.opts = { initialSyncTimeoutMs: 2500, pushDelayMs: 2000, ...options }
  }

  /** Starts the first reconcile. Loads wait for it, but never longer than `initialSyncTimeoutMs`. */
  start(): Promise<SyncOutcome> {
    const sync = this.syncNow()
    this.ready = Promise.race([sync, new Promise((resolve) => setTimeout(resolve, this.opts.initialSyncTimeoutMs))])
    return sync
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async loadProgress(): Promise<PlayerProgress> {
    await this.ready
    return (this.view.progress = await this.opts.local.loadProgress())
  }

  async loadPuzzleStats(): Promise<PuzzleStats> {
    await this.ready
    return (this.view.puzzles = await this.opts.local.loadPuzzleStats())
  }

  async loadRevenge(): Promise<RevengeEntry[]> {
    await this.ready
    const entries = await this.opts.local.loadRevenge()
    this.view.revenge = entries
    return entries
  }

  saveProgress(progress: PlayerProgress): Promise<void> {
    return this.save('progress', progress)
  }

  savePuzzleStats(stats: PuzzleStats): Promise<void> {
    return this.save('puzzles', stats)
  }

  saveRevenge(entries: readonly RevengeEntry[]): Promise<void> {
    return this.save('revenge', entries)
  }

  /** Full reconcile with the server. Never rejects; local data is untouched on failure. */
  syncNow(): Promise<SyncOutcome> {
    this.reconciling ??= this.reconcile().finally(() => (this.reconciling = null))
    return this.reconciling
  }

  /** Pushes pending local changes right away (e.g. when the tab is hidden). */
  async flush(): Promise<SyncOutcome> {
    clearTimeout(this.pushTimer)
    this.pushTimer = undefined
    if (this.pending.size === 0) return 'synced'
    if (!this.opts.isOnline()) return 'offline'
    const records = await this.serial(async () => {
      const all = toRecords(await this.readLocal(), this.opts.stamps.load())
      const out = all.filter((r) => this.pending.has(recordKey(r.kind, r.id)))
      this.pending.clear()
      return out
    })
    if (records.length === 0) return 'synced'
    try {
      await this.opts.backend.ensureSession()
      await this.opts.backend.push(records)
      return 'synced'
    } catch {
      for (const r of records) this.pending.add(recordKey(r.kind, r.id))
      return 'failed'
    }
  }

  private async reconcile(): Promise<SyncOutcome> {
    if (!this.opts.isOnline()) return 'offline'
    let toPush: SyncRecord[] = []
    try {
      await this.opts.backend.ensureSession()
      const remote = (await this.opts.backend.pull()).filter(isValidRecord)
      const changed = await this.serial(async () => {
        const values = await this.readLocal()
        const merged = mergeRecords(toRecords(values, this.opts.stamps.load()), remote)
        const next = fromRecords(merged)
        const kinds = RECORD_KINDS.filter((k) => canonicalJson(next.values[k]) !== canonicalJson(values[k]))
        for (const k of kinds) await this.writeLocal(k, next.values[k])
        this.opts.stamps.save(next.stamps)
        // Records dropped by the revenge cap are not worth uploading.
        toPush = recordsToPush(toRecords(next.values, next.stamps), remote)
        this.pending.clear()
        return kinds
      })
      if (changed.length > 0) this.notify()
      if (toPush.length > 0) await this.opts.backend.push(toPush)
      return 'synced'
    } catch {
      for (const r of toPush) this.pending.add(recordKey(r.kind, r.id))
      return 'failed'
    }
  }

  /**
   * Three-way save: records the UI changed since its last load are written over the current local copy,
   * so records a background sync merged in meanwhile are not reverted by a stale UI state.
   */
  private save(kind: RecordKind, next: LocalValues[RecordKind]): Promise<void> {
    return this.serial(async () => {
      const current = await this.readLocal()
      const nextValues = { ...current, [kind]: next } as LocalValues
      const base = toMap(kind, { ...current, ...this.view } as LocalValues)
      const mine = toMap(kind, nextValues)
      const merged = toMap(kind, current)
      const stamps = this.opts.stamps.load()
      const at = this.opts.now()
      // A save that races the first load must not be read as "delete everything the UI has not seen yet".
      const mayDelete = this.view[kind] !== undefined
      for (const id of new Set([...Object.keys(base), ...Object.keys(mine)])) {
        if (canonicalJson(base[id]) === canonicalJson(mine[id])) continue
        if (id in mine) {
          merged[id] = mine[id]
          stamps[kind][id] = at
          this.pending.add(recordKey(kind, id))
        } else if (mayDelete) {
          delete merged[id]
          delete stamps[kind][id]
        }
      }
      const result = fromMap(kind, merged)
      await this.writeLocal(kind, result)
      this.opts.stamps.save(stamps)
      ;(this.view as Record<RecordKind, unknown>)[kind] = next
      if (canonicalJson(result) !== canonicalJson(next)) this.notify()
      this.schedulePush()
    })
  }

  private schedulePush(): void {
    if (this.pending.size === 0) return
    clearTimeout(this.pushTimer)
    this.pushTimer = setTimeout(() => void this.flush(), this.opts.pushDelayMs)
  }

  private async readLocal(): Promise<LocalValues> {
    const { local } = this.opts
    const [progress, puzzles, revenge] = await Promise.all([local.loadProgress(), local.loadPuzzleStats(), local.loadRevenge()])
    return { progress, puzzles, revenge }
  }

  private writeLocal(kind: RecordKind, value: LocalValues[RecordKind]): Promise<void> {
    const { local } = this.opts
    if (kind === 'progress') return local.saveProgress(value as PlayerProgress)
    if (kind === 'puzzles') return local.savePuzzleStats(value as PuzzleStats)
    return local.saveRevenge(value as readonly RevengeEntry[])
  }

  private notify(): void {
    for (const l of this.listeners) l()
  }

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn)
    this.queue = run.catch(() => {})
    return run
  }
}
