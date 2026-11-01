import { describe, expect, it } from 'vitest'
import { scoreToCp } from './types'
import { collectLines, parseBestMove, parseInfoLine } from './uci'

describe('UCI parsing', () => {
  it('parses MultiPV info lines', () => {
    const l = parseInfoLine('info depth 12 seldepth 18 multipv 2 score cp -35 nodes 1000 nps 1 pv e7e5 g1f3 b8c6')
    expect(l).toEqual({ rank: 2, depth: 12, score: { type: 'cp', value: -35 }, pv: ['e7e5', 'g1f3', 'b8c6'] })
  })

  it('parses mate scores and skips bound/no-pv lines', () => {
    expect(parseInfoLine('info depth 5 multipv 1 score mate 2 pv d1h5 g7g6 h5f7')?.score).toEqual({ type: 'mate', value: 2 })
    expect(parseInfoLine('info depth 5 score cp 10 lowerbound pv e2e4')).toBeNull()
    expect(parseInfoLine('info string NNUE evaluation enabled')).toBeNull()
  })

  it('parses bestmove', () => {
    expect(parseBestMove('bestmove e2e4 ponder e7e5')).toBe('e2e4')
    expect(parseBestMove('bestmove (none)')).toBeNull()
  })

  it('keeps the deepest line per rank', () => {
    const a = parseInfoLine('info depth 5 multipv 1 score cp 10 pv e2e4')!
    const b = parseInfoLine('info depth 9 multipv 1 score cp 30 pv d2d4')!
    const c = parseInfoLine('info depth 9 multipv 2 score cp 20 pv e2e4')!
    expect(collectLines([a, c, b]).map((l) => l.pv[0])).toEqual(['d2d4', 'e2e4'])
  })

  it('orders mate scores above any centipawn score', () => {
    expect(scoreToCp({ type: 'mate', value: 1 })).toBeGreaterThan(scoreToCp({ type: 'mate', value: 3 }))
    expect(scoreToCp({ type: 'mate', value: 3 })).toBeGreaterThan(5000)
    expect(scoreToCp({ type: 'mate', value: -2 })).toBeLessThan(-5000)
  })
})
