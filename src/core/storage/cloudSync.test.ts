import { describe, expect, it } from 'vitest'
import { EMPTY_PROGRESS } from '../progression/levelMap'
import { MAX_REVENGE_ENTRIES } from '../revenge/revenge'
import { revengeEntry } from '../../test/syncFixtures'
import {
  canonicalJson,
  emptyStamps,
  fromRecords,
  isValidRecord,
  mergeRecords,
  recordsToPush,
  toRecords,
  type LocalValues,
  type SyncRecord,
} from './cloudSync'
import { EMPTY_PUZZLE_STATS } from './storageAdapter'

const node = (stars: 0 | 1 | 2 | 3, attempts = 1) => ({ completed: stars === 3, stars, attempts })
const rec = (kind: SyncRecord['kind'], id: string, data: unknown, updatedAt: number): SyncRecord => ({ kind, id, data, updatedAt })

describe('cloud sync merge', () => {
  it('keeps the newest copy of each record and unions everything else', () => {
    const local = [rec('progress', 'w1-1', node(3, 2), 200), rec('progress', 'w1-2', node(1), 100)]
    const remote = [rec('progress', 'w1-1', node(1), 150), rec('progress', 'w1-2', node(3), 300), rec('progress', 'w1-3', node(1), 50)]
    const { values } = fromRecords(mergeRecords(local, remote))
    expect(values.progress.nodes).toEqual({ 'w1-1': node(3, 2), 'w1-2': node(3), 'w1-3': node(1) })
  })

  it('merges revenge sets: puzzles from both sides survive, each with its newest review state', () => {
    const local = [rec('revenge', 'g1:10', revengeEntry('g1:10', 10, 2), 500), rec('revenge', 'g2:4', revengeEntry('g2:4', 20), 20)]
    const remote = [rec('revenge', 'g1:10', revengeEntry('g1:10', 10, 1), 400), rec('revenge', 'g3:8', revengeEntry('g3:8', 15), 15)]
    const { values, stamps } = fromRecords(mergeRecords(local, remote))
    expect(values.revenge.map((e) => e.puzzle.id)).toEqual(['g1:10', 'g3:8', 'g2:4'])
    expect(values.revenge[0].review.box).toBe(2)
    expect(stamps.revenge).toEqual({ 'g1:10': 500, 'g2:4': 20, 'g3:8': 15 })
  })

  it('keeps revenge positions unique (oldest wins) and caps the queue', () => {
    const dupes = fromRecords([rec('revenge', 'a:1', revengeEntry('a:1', 1, 0, 'same'), 1), rec('revenge', 'b:1', revengeEntry('b:1', 2, 0, 'same'), 2)])
    expect(dupes.values.revenge.map((e) => e.puzzle.id)).toEqual(['a:1'])

    const many = Array.from({ length: MAX_REVENGE_ENTRIES + 5 }, (_, i) => rec('revenge', `g:${i}`, revengeEntry(`g:${i}`, i), i))
    const capped = fromRecords(many).values.revenge
    expect(capped).toHaveLength(MAX_REVENGE_ENTRIES)
    expect(capped[0].puzzle.id).toBe('g:5')
  })

  it('resolves equal timestamps the same way on every device', () => {
    const a = rec('progress', 'w1-1', node(1), 100)
    const b = rec('progress', 'w1-1', node(3), 100)
    expect(mergeRecords([a], [b])).toEqual(mergeRecords([b], [a]))
  })

  it('stamps legacy records without a change time from their own data', () => {
    const values: LocalValues = {
      progress: { version: 1, nodes: { 'w1-1': node(3) } },
      puzzles: { version: 1, solved: { p1: { firstTry: true, at: 777, pack: '01' } } },
      revenge: [revengeEntry('g:1', 555)],
    }
    const byKey = Object.fromEntries(toRecords(values, emptyStamps()).map((r) => [`${r.kind}:${r.id}`, r.updatedAt]))
    expect(byKey).toEqual({ 'progress:w1-1': 0, 'puzzles:p1': 777, 'revenge:g:1': 555 })
  })

  it('pushes only what the server is missing or holds an older copy of, ignoring jsonb key order', () => {
    const merged = [rec('progress', 'a', { completed: true, stars: 3, attempts: 1 }, 5), rec('progress', 'b', node(1), 9), rec('progress', 'c', node(1), 1)]
    const remote = [rec('progress', 'a', { attempts: 1, stars: 3, completed: true }, 5), rec('progress', 'b', node(1), 3)]
    expect(recordsToPush(merged, remote).map((r) => r.id)).toEqual(['b', 'c'])
    expect(canonicalJson({ b: 1, a: { d: 1, c: 2 } })).toBe('{"a":{"c":2,"d":1},"b":1}')
  })

  it('round-trips empty values', () => {
    const empty: LocalValues = { progress: EMPTY_PROGRESS, puzzles: EMPTY_PUZZLE_STATS, revenge: [] }
    expect(fromRecords(toRecords(empty, emptyStamps())).values).toEqual(empty)
  })

  it('rejects malformed server rows', () => {
    expect(isValidRecord(rec('progress', 'w1-1', node(3), 1))).toBe(true)
    expect(isValidRecord(rec('progress', 'w1-1', { completed: 'yes', stars: 9, attempts: 1 }, 1))).toBe(false)
    expect(isValidRecord(rec('puzzles', 'p', { firstTry: true, at: 1 }, Number.NaN))).toBe(false)
    expect(isValidRecord(rec('revenge', 'g:1', revengeEntry('g:1', 1), 1))).toBe(true)
    expect(isValidRecord(rec('revenge', 'other', revengeEntry('g:1', 1), 1))).toBe(false)
    expect(isValidRecord({ kind: 'secrets' as SyncRecord['kind'], id: 'x', data: {}, updatedAt: 1 })).toBe(false)
  })
})
