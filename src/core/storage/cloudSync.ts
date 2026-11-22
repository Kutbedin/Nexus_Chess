import type { NodeProgress, PlayerProgress } from '../progression/levelMap'
import { MAX_REVENGE_ENTRIES, type RevengeEntry } from '../revenge/revenge'
import type { PuzzleStats } from './storageAdapter'

/**
 * Cloud backup data model. Everything the player accumulates is split into small records
 * (one per level node, solved puzzle, or revenge puzzle) so two copies can be merged record by record:
 * the newer `updatedAt` wins, and sets are unioned (a revenge puzzle found on either side is kept).
 */
export type RecordKind = 'progress' | 'puzzles' | 'revenge'
export const RECORD_KINDS: readonly RecordKind[] = ['progress', 'puzzles', 'revenge']

export type SolvedPuzzle = PuzzleStats['solved'][string]

export interface SyncRecord {
  kind: RecordKind
  id: string
  data: unknown
  /** Epoch ms of the last local change to this record. */
  updatedAt: number
}

/** Last-change time per record id, persisted next to the local cache. */
export type SyncStamps = Record<RecordKind, Record<string, number>>

export const emptyStamps = (): SyncStamps => ({ progress: {}, puzzles: {}, revenge: {} })

export interface LocalValues {
  progress: PlayerProgress
  puzzles: PuzzleStats
  revenge: readonly RevengeEntry[]
}

export type RecordMap = Record<string, unknown>

export const recordKey = (kind: RecordKind, id: string) => `${kind}:${id}`

export function toMap(kind: RecordKind, values: LocalValues): RecordMap {
  switch (kind) {
    case 'progress':
      return { ...values.progress.nodes }
    case 'puzzles':
      return { ...values.puzzles.solved }
    case 'revenge':
      return Object.fromEntries(values.revenge.map((e) => [e.puzzle.id, e]))
  }
}

/** Rebuilds one value from its records. Revenge keeps the queue invariants: oldest first, unique positions, capped. */
export function fromMap(kind: RecordKind, map: RecordMap): LocalValues[RecordKind] {
  switch (kind) {
    case 'progress':
      return { version: 1, nodes: map as Record<string, NodeProgress> }
    case 'puzzles':
      return { version: 1, solved: map as Record<string, SolvedPuzzle> }
    case 'revenge': {
      const sorted = (Object.values(map) as RevengeEntry[]).sort(
        (a, b) => a.puzzle.createdAt - b.puzzle.createdAt || (a.puzzle.id < b.puzzle.id ? -1 : 1),
      )
      const fens = new Set<string>()
      const unique = sorted.filter((e) => !fens.has(e.puzzle.fen) && fens.add(e.puzzle.fen))
      return unique.slice(-MAX_REVENGE_ENTRIES)
    }
  }
}

function defaultStamp(kind: RecordKind, data: unknown): number {
  if (kind === 'puzzles') return (data as SolvedPuzzle).at
  if (kind === 'revenge') return (data as RevengeEntry).puzzle.createdAt
  return 0
}

export function toRecords(values: LocalValues, stamps: SyncStamps): SyncRecord[] {
  return RECORD_KINDS.flatMap((kind) =>
    Object.entries(toMap(kind, values)).map(([id, data]) => ({ kind, id, data, updatedAt: stamps[kind][id] ?? defaultStamp(kind, data) })),
  )
}

export function fromRecords(records: readonly SyncRecord[]): { values: LocalValues; stamps: SyncStamps } {
  const maps: Record<RecordKind, RecordMap> = { progress: {}, puzzles: {}, revenge: {} }
  const stamps = emptyStamps()
  for (const r of records) {
    maps[r.kind][r.id] = r.data
    stamps[r.kind][r.id] = r.updatedAt
  }
  return {
    values: {
      progress: fromMap('progress', maps.progress) as PlayerProgress,
      puzzles: fromMap('puzzles', maps.puzzles) as PuzzleStats,
      revenge: fromMap('revenge', maps.revenge) as RevengeEntry[],
    },
    stamps,
  }
}

/** JSON with sorted object keys, so copies that went through Postgres `jsonb` compare equal. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  )
}

/** `a` beats `b` when it is newer; equal stamps fall back to a stable order so every copy converges. */
function wins(a: SyncRecord, b: SyncRecord): boolean {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt
  return canonicalJson(a.data) > canonicalJson(b.data)
}

/** Union of both sides; per record the newest copy wins. */
export function mergeRecords(local: readonly SyncRecord[], remote: readonly SyncRecord[]): SyncRecord[] {
  const merged = new Map<string, SyncRecord>()
  for (const r of [...remote, ...local]) {
    const key = recordKey(r.kind, r.id)
    const prev = merged.get(key)
    if (!prev || wins(r, prev)) merged.set(key, r)
  }
  return [...merged.values()]
}

/** Records the server is missing or holds an older/different copy of. */
export function recordsToPush(merged: readonly SyncRecord[], remote: readonly SyncRecord[]): SyncRecord[] {
  const server = new Map(remote.map((r) => [recordKey(r.kind, r.id), r]))
  return merged.filter((r) => {
    const s = server.get(recordKey(r.kind, r.id))
    return !s || s.updatedAt !== r.updatedAt || canonicalJson(s.data) !== canonicalJson(r.data)
  })
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string'

/** Shape check for records coming from the server; anything else is ignored rather than trusted. */
export function isValidRecord(r: SyncRecord): boolean {
  if (!RECORD_KINDS.includes(r.kind) || !isStr(r.id) || r.id.length === 0 || !isNum(r.updatedAt) || !isObj(r.data)) return false
  const d = r.data
  switch (r.kind) {
    case 'progress':
      return typeof d.completed === 'boolean' && [0, 1, 2, 3].includes(d.stars as number) && isNum(d.attempts)
    case 'puzzles':
      return typeof d.firstTry === 'boolean' && isNum(d.at) && (d.pack === undefined || isStr(d.pack))
    case 'revenge': {
      const p = d.puzzle
      const rv = d.review
      return (
        isObj(p) &&
        isObj(rv) &&
        p.id === r.id &&
        isStr(p.fen) &&
        isStr(p.solutionUci) &&
        isStr(p.botId) &&
        isStr(p.playedSan) &&
        isNum(p.moveNumber) &&
        isNum(p.createdAt) &&
        (p.kind === 'missedMate' || p.kind === 'missedWin') &&
        isNum(rv.box) &&
        isNum(rv.dueAt) &&
        isNum(rv.lapses)
      )
    }
  }
}
