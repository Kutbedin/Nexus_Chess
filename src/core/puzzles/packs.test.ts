import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { PUZZLE_FILES } from '../../test/puzzleFiles'
import { EMPTY_PUZZLE_STATS } from '../storage/storageAdapter'
import { isPackUnlocked, nextPuzzle, recordPuzzleSolved, solvedCountsByPack, type PackManifest, type PackPuzzle } from './packs'

const manifest = PUZZLE_FILES['index.json'] as PackManifest
const packs = manifest.packs.map((p) => PUZZLE_FILES[p.file] as PackPuzzle[])

describe('bundled puzzle packs (Lichess CC0)', () => {
  it('has ~2,000 puzzles in packs of 200–250, matching the manifest', () => {
    expect(manifest.total).toBeGreaterThanOrEqual(1800)
    expect(packs.flat()).toHaveLength(manifest.total)
    packs.forEach((pack, i) => {
      expect(pack.length).toBe(manifest.packs[i].count)
      expect(pack.length).toBeGreaterThanOrEqual(200)
      expect(pack.length).toBeLessThanOrEqual(250)
    })
  })

  it('is graded: packs are sorted by rating and do not overlap', () => {
    const ratings = packs.flat().map((p) => p.rating)
    expect(ratings).toEqual([...ratings].sort((a, b) => a - b))
    manifest.packs.forEach((info, i) => {
      expect(info.minRating).toBe(packs[i][0].rating)
      expect(info.maxRating).toBe(packs[i].at(-1)!.rating)
    })
  })

  it('every puzzle is valid: legal moves throughout, mates end in checkmate, unique ids', () => {
    const ids = new Set<string>()
    for (const p of packs.flat()) {
      expect(ids.has(p.id), p.id).toBe(false)
      ids.add(p.id)
      expect(p.themes, p.id).toContain(p.primary)
      const chess = new Chess(p.fen)
      expect(p.moves.length % 2, `${p.id}: solver must make the last move`).toBe(1)
      for (const m of p.moves) expect(() => chess.move(m), `${p.id} ${m}`).not.toThrow()
      if (p.themes.some((t) => t.startsWith('mateIn') || t === 'backRankMate')) expect(chess.isCheckmate(), p.id).toBe(true)
    }
    // Replays ~2,000 lines with chess.js; slow CI runners exceed the 5s default.
  }, 30_000)

  it('covers the core beginner themes', () => {
    const themes = new Set(packs.flat().map((p) => p.primary))
    for (const t of ['fork', 'pin', 'mateIn1', 'mateIn2', 'backRankMate', 'skewer']) expect(themes, t).toContain(t)
  })
})

describe('pack progression', () => {
  it('opens pack 1 immediately and pack N after half of pack N-1', () => {
    const counts = [0, 0]
    expect(isPackUnlocked(0, counts, manifest)).toBe(true)
    expect(isPackUnlocked(1, counts, manifest)).toBe(false)
    expect(isPackUnlocked(1, [Math.ceil(manifest.packs[0].count / 2), 0], manifest)).toBe(true)
  })

  it('counts solved puzzles per pack and serves unsolved ones first', () => {
    const [first, second] = packs[0]
    let stats = recordPuzzleSolved(EMPTY_PUZZLE_STATS, first.id, manifest.packs[0].id, true, 1)
    stats = recordPuzzleSolved(stats, first.id, manifest.packs[0].id, false, 2)
    expect(stats.solved[first.id].firstTry).toBe(true)
    expect(solvedCountsByPack(manifest, stats)[0]).toBe(1)
    expect(nextPuzzle(packs[0], stats)?.id).toBe(second.id)
    const forks = nextPuzzle(packs[0], stats, { theme: 'fork' })
    expect(forks?.themes).toContain('fork')
  })
})
