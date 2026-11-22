import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recordGameResult, type PlayerProgress } from '../core/progression/levelMap'
import { addRevengePuzzles } from '../core/revenge/revenge'
import type { SyncRecord } from '../core/storage/cloudSync'
import { CloudSyncedStorage } from '../core/storage/cloudSyncedStorage'
import { STORAGE_KEYS } from '../storageKeys'
import { MemoryBackend, revengeEntry } from '../test/syncFixtures'
import { cloudBackupEnabled, createStorage, localStampStore } from './cloudStorage'
import { LocalStorageAdapter } from './localStorageAdapter'
import { SupabaseBackend } from './supabaseBackend'

const createClient = vi.fn()
vi.mock('@supabase/supabase-js', () => ({ createClient: (...args: unknown[]) => createClient(...args) }))

const rec = (kind: SyncRecord['kind'], id: string, data: unknown, updatedAt: number): SyncRecord => ({ kind, id, data, updatedAt })
const node = (stars: 0 | 1 | 2 | 3, attempts = 1) => ({ completed: stars === 3, stars, attempts })

function setup(backend = new MemoryBackend(), opts: { now?: () => number; online?: () => boolean; timeout?: number } = {}) {
  let clock = 1_000
  const storage = new CloudSyncedStorage({
    local: new LocalStorageAdapter(localStorage),
    stamps: localStampStore(localStorage),
    backend,
    now: opts.now ?? (() => ++clock),
    isOnline: opts.online ?? (() => backend.online),
    initialSyncTimeoutMs: opts.timeout ?? 1_000,
    pushDelayMs: 60_000,
  })
  return { storage, backend, local: new LocalStorageAdapter(localStorage) }
}

describe('CloudSyncedStorage', () => {
  beforeEach(() => localStorage.clear())

  it('backs up existing guest progress on the first visit (anonymous session, no signup)', async () => {
    const legacy: PlayerProgress = { version: 1, nodes: { 'w1-1': node(3) } }
    localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(legacy))
    localStorage.setItem(STORAGE_KEYS.revenge, JSON.stringify([revengeEntry('g:1', 50)]))
    const { storage, backend } = setup()

    expect(await storage.start()).toBe('synced')
    expect(backend.sessions).toBe(1)
    expect(backend.get('progress', 'w1-1')?.data).toEqual(node(3))
    expect(backend.get('revenge', 'g:1')?.updatedAt).toBe(50)
    expect(await storage.loadProgress()).toEqual(legacy)
  })

  it('works fully offline and uploads the changes once back online', async () => {
    const backend = new MemoryBackend()
    backend.online = false
    const { storage } = setup(backend)
    expect(await storage.start()).toBe('offline')

    const progress = recordGameResult(await storage.loadProgress(), 'w1-1', 'win')
    await storage.saveProgress(progress)
    expect(await storage.flush()).toBe('offline')
    expect(await new LocalStorageAdapter(localStorage).loadProgress()).toEqual(progress)
    expect(backend.rows.size).toBe(0)

    backend.online = true
    expect(await storage.syncNow()).toBe('synced')
    expect(backend.get('progress', 'w1-1')?.data).toEqual(progress.nodes['w1-1'])
  })

  it('merges newest-per-record both ways and tells the UI to reload', async () => {
    localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify({ version: 1, nodes: { 'w1-1': node(3, 4), 'w1-2': node(1) } }))
    localStorage.setItem(STORAGE_KEYS.syncStamps, JSON.stringify({ progress: { 'w1-1': 900, 'w1-2': 100 }, puzzles: {}, revenge: {} }))
    const backend = new MemoryBackend().seed([
      rec('progress', 'w1-1', node(1), 500),
      rec('progress', 'w1-2', node(3, 2), 800),
      rec('puzzles', 'p1', { firstTry: true, at: 700, pack: '01' }, 700),
    ])
    const { storage } = setup(backend)
    const listener = vi.fn()
    storage.subscribe(listener)

    await storage.start()
    expect(listener).toHaveBeenCalled()
    expect((await storage.loadProgress()).nodes).toEqual({ 'w1-1': node(3, 4), 'w1-2': node(3, 2) })
    expect((await storage.loadPuzzleStats()).solved.p1.pack).toBe('01')
    expect(backend.get('progress', 'w1-1')).toEqual(rec('progress', 'w1-1', node(3, 4), 900))
    expect(backend.pushes.flat().map((r) => r.id)).toEqual(['w1-1'])
  })

  it('keeps revenge puzzle sets from both sides', async () => {
    localStorage.setItem(STORAGE_KEYS.revenge, JSON.stringify([revengeEntry('local:1', 10)]))
    const backend = new MemoryBackend().seed([rec('revenge', 'cloud:1', revengeEntry('cloud:1', 20), 20)])
    const { storage } = setup(backend)
    await storage.start()
    expect((await storage.loadRevenge()).map((e) => e.puzzle.id)).toEqual(['local:1', 'cloud:1'])
    expect(backend.get('revenge', 'local:1')).toBeDefined()
  })

  it('pushes only the records a save changed', async () => {
    const { storage, backend } = setup()
    await storage.start()
    const p0 = await storage.loadProgress()
    const p1 = recordGameResult(recordGameResult(p0, 'w1-1', 'win'), 'w1-3', 'loss')
    await storage.saveProgress(p1)
    await storage.saveProgress(recordGameResult(p1, 'w1-3', 'win'))
    expect(await storage.flush()).toBe('synced')
    expect(backend.pushes.at(-1)!.map((r) => r.id).sort()).toEqual(['w1-1', 'w1-3'])
    expect(backend.get('progress', 'w1-3')?.data).toEqual(node(3, 2))
  })

  it('a stale UI save does not revert records a background sync merged in', async () => {
    const backend = new MemoryBackend()
    const { storage } = setup(backend)
    await storage.start()
    const uiRevenge = await storage.loadRevenge()

    backend.seed([rec('revenge', 'other:1', revengeEntry('other:1', 5_000, 3), 5_000)])
    await storage.syncNow()

    // The UI still holds the pre-sync list and adds a puzzle to it.
    await storage.saveRevenge(addRevengePuzzles(uiRevenge, [revengeEntry('mine:1', 6_000).puzzle]))
    expect((await storage.loadRevenge()).map((e) => e.puzzle.id)).toEqual(['other:1', 'mine:1'])
  })

  it('first load waits for the cloud only up to the timeout', async () => {
    localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify({ version: 1, nodes: { 'w1-1': node(3) } }))
    const backend = new MemoryBackend()
    backend.pull = () => new Promise(() => {})
    const { storage } = setup(backend, { timeout: 20 })
    void storage.start()
    expect((await storage.loadProgress()).nodes['w1-1']).toEqual(node(3))
  })

  it('re-queues a failed push', async () => {
    const { storage, backend } = setup()
    await storage.start()
    await storage.savePuzzleStats({ version: 1, solved: { p9: { firstTry: false, at: 5 } } })
    const push = backend.push.bind(backend)
    backend.push = () => Promise.reject(new Error('503'))
    expect(await storage.flush()).toBe('failed')
    backend.push = push
    expect(await storage.flush()).toBe('synced')
    expect(backend.get('puzzles', 'p9')).toBeDefined()
  })
})

describe('createStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    createClient.mockReset()
  })

  it('stays purely local without Supabase keys or in school mode; supabase-js is not even created', async () => {
    expect(await createStorage({ url: undefined, anonKey: undefined, schoolMode: false }, localStorage)).toBeInstanceOf(LocalStorageAdapter)
    expect(await createStorage({ url: ' ', anonKey: 'k', schoolMode: false }, localStorage)).toBeInstanceOf(LocalStorageAdapter)
    expect(await createStorage({ url: 'https://x.supabase.co', anonKey: 'k', schoolMode: true }, localStorage)).toBeInstanceOf(LocalStorageAdapter)
    expect(createClient).not.toHaveBeenCalled()
    expect(cloudBackupEnabled({ url: 'https://x.supabase.co', anonKey: 'k', schoolMode: false })).toBe(true)
  })

  it('wraps local storage with cloud backup when configured', async () => {
    createClient.mockReturnValue(fakeClient({ session: null }).client)
    const storage = await createStorage({ url: 'https://x.supabase.co', anonKey: 'anon-key', schoolMode: false }, localStorage)
    expect(storage).toBeInstanceOf(CloudSyncedStorage)
    expect(createClient).toHaveBeenCalledWith('https://x.supabase.co', 'anon-key', expect.objectContaining({ auth: expect.objectContaining({ persistSession: true }) }))
  })

  it('keeps corrupt sync stamps from breaking anything', () => {
    localStorage.setItem(STORAGE_KEYS.syncStamps, '{oops')
    expect(localStampStore(localStorage).load()).toEqual({ progress: {}, puzzles: {}, revenge: {} })
  })
})

interface FakeOptions {
  session: { user: { id: string; is_anonymous?: boolean } } | null
  rows?: Record<string, { id: string; data: unknown; updated_at: number | string }[]>
  maxRows?: number
}

function fakeClient({ session, rows = {}, maxRows = 1000 }: FakeOptions) {
  const upserts: { table: string; rows: unknown[]; options: unknown }[] = []
  const filters: unknown[][] = []
  const auth = {
    getSession: vi.fn(async () => ({ data: { session }, error: null })),
    signInAnonymously: vi.fn(async () => ({ data: { user: { id: 'anon-1' } }, error: null })),
    updateUser: vi.fn(async () => ({ data: {}, error: null })),
  }
  const from = (table: string) => ({
    select: () => {
      const q = {
        eq: (...args: unknown[]) => (filters.push(args), q),
        order: () => q,
        range: async (start: number, end: number) => ({
          data: (rows[table] ?? []).slice(start, Math.min(end + 1, start + maxRows)),
          error: null,
        }),
      }
      return q
    },
    upsert: async (r: unknown[], options: unknown) => (upserts.push({ table, rows: r, options }), { error: null }),
  })
  return { client: { auth, from } as never, auth, upserts, filters }
}

describe('SupabaseBackend', () => {
  it('signs in anonymously only when there is no saved session', async () => {
    const fresh = fakeClient({ session: null })
    await new SupabaseBackend(fresh.client).ensureSession()
    expect(fresh.auth.signInAnonymously).toHaveBeenCalledTimes(1)

    const returning = fakeClient({ session: { user: { id: 'u1', is_anonymous: true } } })
    const backend = new SupabaseBackend(returning.client)
    await backend.ensureSession()
    expect(returning.auth.signInAnonymously).not.toHaveBeenCalled()
    expect(await backend.accountStatus()).toBe('anonymous')
  })

  it('pulls every page of every table, even when the server caps page size', async () => {
    const puzzles = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, data: { firstTry: true, at: i }, updated_at: String(i) }))
    const f = fakeClient({ session: { user: { id: 'u1' } }, rows: { puzzle_stats: puzzles, player_progress: [{ id: 'w1-1', data: node(3), updated_at: 9 }] }, maxRows: 3 })
    const backend = new SupabaseBackend(f.client)
    await backend.ensureSession()
    const records = await backend.pull()
    expect(records.filter((r) => r.kind === 'puzzles')).toHaveLength(7)
    expect(records.find((r) => r.id === 'p6')?.updatedAt).toBe(6)
    expect(records.find((r) => r.kind === 'progress')).toEqual(rec('progress', 'w1-1', node(3), 9))
    expect(f.filters.every(([col, val]) => col === 'user_id' && val === 'u1')).toBe(true)
  })

  it('upserts per table in chunks, keyed by (user_id, id)', async () => {
    const f = fakeClient({ session: { user: { id: 'u1' } } })
    const backend = new SupabaseBackend(f.client)
    await backend.ensureSession()
    const many = Array.from({ length: 501 }, (_, i) => rec('puzzles', `p${i}`, { firstTry: true, at: i }, i))
    await backend.push([...many, rec('revenge', 'g:1', revengeEntry('g:1', 1), 1)])
    expect(f.upserts.map((u) => [u.table, u.rows.length])).toEqual([
      ['puzzle_stats', 500],
      ['puzzle_stats', 1],
      ['revenge_puzzles', 1],
    ])
    expect(f.upserts[0].options).toEqual({ onConflict: 'user_id,id' })
    expect(f.upserts[2].rows[0]).toMatchObject({ user_id: 'u1', id: 'g:1', updated_at: 1 })
  })

  it('refuses to talk to tables before a session exists', async () => {
    await expect(new SupabaseBackend(fakeClient({ session: null }).client).pull()).rejects.toThrow(/session/)
  })
})
