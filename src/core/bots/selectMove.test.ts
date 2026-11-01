import { describe, expect, it } from 'vitest'
import { line } from '../../test/fakeEngine'
import { seededRng } from '../random'
import { getBot } from './roster'
import { bookMove, chooseEngineMove, scoreCandidates } from './selectMove'
import type { BotPersonality } from './types'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const base: BotPersonality = { ...getBot('atli'), blunderChance: 0, maxLossCp: 100, temperatureCp: 50 }

describe('personality-weighted move choice', () => {
  it('drops candidates outside the loss tolerance', () => {
    const lines = [line('e2e4', 50), line('d2d4', 30, 2), line('g2g4', -200, 3)]
    const scored = scoreCandidates(START, lines, base, seededRng(1))
    expect(scored.map((c) => c.uci)).toEqual(['e2e4', 'd2d4'])
  })

  it('widens tolerance when the blunder roll hits', () => {
    const lines = [line('e2e4', 50), line('g2g4', -200, 2)]
    const scored = scoreCandidates(START, lines, { ...base, blunderChance: 1, blunderLossCp: 500 }, seededRng(1))
    expect(scored).toHaveLength(2)
  })

  it('aggressive bots favour captures among equal moves', () => {
    const fen = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
    const lines = [line('g1f3', 20), line('e4d5', 20, 2)]
    const scored = scoreCandidates(fen, lines, { ...base, style: { aggression: 200, materialism: 0 } }, seededRng(1))
    const capture = scored.find((c) => c.uci === 'e4d5')!
    const quiet = scored.find((c) => c.uci === 'g1f3')!
    expect(capture.weight).toBeGreaterThan(quiet.weight * 5)
  })

  describe('Minik Mert: careful beginner', () => {
    // After 1.e4 d5: Qg4?? walks into Bc8xg4.
    const fen = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
    const minik = getBot('minik')

    it('searches shallowly with several candidate lines', () => {
      expect(minik.search.depth).toBeLessThanOrEqual(2)
      expect(minik.search.multiPv).toBeGreaterThanOrEqual(4)
    })

    it('never leaves the queen en prise, even if a shallow search likes the move', () => {
      const lines = [line('d1g4', 60), line('g1f3', 20, 2)]
      for (let seed = 0; seed < 20; seed++) {
        expect(chooseEngineMove(fen, lines, { ...minik, blunderChance: 1 }, seededRng(seed))).toBe('g1f3')
      }
      expect(scoreCandidates(fen, lines, { ...minik, safety: undefined }, seededRng(1)).map((c) => c.uci)).toContain('d1g4')
    })

    it('caps blunders at ~500cp so it misses ideas rather than gifting pieces', () => {
      const lines = [line('e4d5', 120), line('g1f3', 20, 2), line('a2a3', -450, 3)]
      const scored = scoreCandidates(START, lines, { ...minik, blunderChance: 1, blunderLossCp: 900 }, seededRng(1))
      expect(scored.map((c) => c.uci)).not.toContain('a2a3')
    })

    it('falls back to the full list when every move hangs a heavy piece', () => {
      const scored = scoreCandidates(fen, [line('d1g4', 0)], minik, seededRng(1))
      expect(scored.map((c) => c.uci)).toEqual(['d1g4'])
    })
  })

  it('is deterministic for a given seed', () => {
    const lines = [line('e2e4', 20), line('d2d4', 15, 2), line('c2c4', 10, 3)]
    const a = Array.from({ length: 5 }, (_, i) => chooseEngineMove(START, lines, base, seededRng(i)))
    const b = Array.from({ length: 5 }, (_, i) => chooseEngineMove(START, lines, base, seededRng(i)))
    expect(a).toEqual(b)
  })
})

describe('opening book', () => {
  it('returns a book move for a known history', () => {
    const book = { 'e2e4': [['c7c5', 1]] as const }
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
    expect(bookMove(book, ['e2e4'], fen, seededRng(1))).toBe('c7c5')
  })

  it('skips illegal or unknown entries', () => {
    expect(bookMove({ '': [['e7e5', 1]] }, [], START, seededRng(1))).toBeNull()
    expect(bookMove({}, ['e2e4'], START, seededRng(1))).toBeNull()
  })

  it('every roster book entry is legal', async () => {
    const { BOTS } = await import('./roster')
    const { Chess } = await import('chess.js')
    for (const bot of BOTS) {
      for (const [history, moves] of Object.entries(bot.book)) {
        const c = new Chess()
        for (const m of history.split(' ').filter(Boolean)) c.move(m)
        for (const [uci] of moves) expect(() => new Chess(c.fen()).move(uci), `${bot.id} ${history} ${uci}`).not.toThrow()
      }
    }
  })
})
