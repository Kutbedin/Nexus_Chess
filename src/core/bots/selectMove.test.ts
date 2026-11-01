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
