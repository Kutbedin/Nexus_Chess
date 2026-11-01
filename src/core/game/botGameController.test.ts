import { describe, expect, it } from 'vitest'
import { FakeEngine } from '../../test/fakeEngine'
import { getBot } from '../bots/roster'
import type { BotPersonality } from '../bots/types'
import { seededRng } from '../random'
import { BotGameController } from './botGameController'
import type { Color } from './types'

const testBot: BotPersonality = { ...getBot('minik'), book: {}, blunderChance: 0 }

function setup(fen: string, playerColor: Color, answers: string[], bot = testBot) {
  const engine = new FakeEngine(answers)
  const c = new BotGameController({ bot, engine, playerColor, rng: seededRng(1), startFen: fen })
  return { c, engine }
}

describe('BotGameController: UI to engine integration', () => {
  it('player promotion: waits for the piece choice, then the bot replies', async () => {
    const { c, engine } = setup('4k3/P7/8/8/8/8/8/4K3 w - - 0 1', 'w', ['e8e7'])
    c.start()
    expect(c.playerDrop('a7', 'a8')).toBe(false)
    expect(c.getState().pendingPromotion).toEqual({ from: 'a7', to: 'a8' })
    expect(engine.calls).toHaveLength(0)

    c.choosePromotion('q')
    await c.settled()
    const s = c.getState()
    expect(s.moves.map((m) => m.uci)).toEqual(['a7a8q', 'e8e7'])
    expect(s.pendingPromotion).toBeNull()
    expect(s.botThinking).toBe(false)
  })

  it('cancelled promotion leaves the position unchanged', () => {
    const { c } = setup('4k3/P7/8/8/8/8/8/4K3 w - - 0 1', 'w', [])
    c.playerDrop('a7', 'a8')
    c.cancelPromotion()
    expect(c.getState().pendingPromotion).toBeNull()
    expect(c.getState().moves).toHaveLength(0)
  })

  it('applies engine castling given as king-two-squares UCI', async () => {
    const { c } = setup('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R b KQkq - 0 1', 'w', ['e8g8'])
    c.start()
    await c.settled()
    expect(c.getState().lastMove?.san).toBe('O-O')
    expect(c.getState().fen.split(' ')[0].startsWith('r4rk1')).toBe(true)
  })

  it('applies engine en passant captures', async () => {
    const { c } = setup('4k3/8/8/8/3pP3/8/8/4K3 b - e3 0 1', 'w', ['d4e3'])
    c.start()
    await c.settled()
    expect(c.getState().lastMove?.captured).toBe('p')
    expect(c.getState().fen.split(' ')[0]).toBe('4k3/8/8/8/8/4p3/8/4K3')
  })

  it('applies engine promotions and reacts to the resulting check', async () => {
    const { c } = setup('4k3/8/8/8/8/8/p7/4K3 b - - 0 1', 'w', ['a2a1q'])
    c.start()
    await c.settled()
    expect(c.getState().lastMove?.promotion).toBe('q')
    expect(c.getState().reaction).toBe('botGivesCheck')
  })

  it('uses the opening book before asking the engine', async () => {
    const bot = { ...testBot, book: { '': [['e2e4', 1]] as const } }
    const { c, engine } = setup('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'b', [], bot)
    c.start()
    await c.settled()
    expect(c.getState().lastMove?.uci).toBe('e2e4')
    expect(engine.calls).toHaveLength(0)
  })

  it('ignores player input while it is the bot turn', () => {
    const { c } = setup('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'b', ['e2e4'])
    expect(c.playerDrop('e7', 'e5')).toBe(false)
  })

  it('finishing the game produces a bot reaction and a coach report', () => {
    const { c } = setup('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', 'w', [])
    expect(c.playerDrop('a1', 'a8')).toBe(true)
    const s = c.getState()
    expect(s.outcome).toEqual({ kind: 'checkmate', winner: 'w' })
    expect(s.reaction).toBe('botLoses')
    expect(s.coach).not.toBeNull()
  })

  it('resignation ends the game as a loss for the player', () => {
    const { c } = setup('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'w', [])
    c.resign()
    expect(c.getState().outcome).toEqual({ kind: 'resigned', winner: 'b' })
    expect(c.getState().reaction).toBe('botWins')
  })
})
