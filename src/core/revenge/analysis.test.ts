import { describe, expect, it } from 'vitest'
import { FakeEngine, line } from '../../test/fakeEngine'
import { GameSession } from '../game/gameSession'
import { findRevengePuzzles } from './analysis'

/** 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6?? 4.Nc3 — White missed Qxf7#. */
function missedMateGame() {
  const g = new GameSession()
  for (const m of ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'b1c3']) g.moveUci(m)
  return g.moves
}

const quiet = [line('a', 30), line('b', 25, 2)]

describe('background revenge analysis', () => {
  it('turns a missed mate into a story puzzle', async () => {
    const engine = new FakeEngine([
      quiet,
      quiet,
      quiet,
      [{ rank: 1, depth: 12, score: { type: 'mate', value: 1 }, pv: ['h5f7'] }, line('c4f7', 50, 2)],
      [line('f6h5', 100)],
    ])
    const found = await findRevengePuzzles(missedMateGame(), 'w', engine, { gameId: 'g1', botId: 'minik', now: 5 })
    expect(found).toEqual([
      {
        id: 'g1:6',
        fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
        solutionUci: 'h5f7',
        kind: 'missedMate',
        mateIn: 1,
        botId: 'minik',
        moveNumber: 4,
        playedSan: 'Nc3',
        createdAt: 5,
      },
    ])
    expect(engine.calls.map((c) => c.options.multiPv)).toEqual([2, 2, 2, 2, 1])
  })

  it('skips positions without a single clear winning move', async () => {
    const twoWins = [line('h5f7', 400), line('c4f7', 380, 2)]
    const engine = new FakeEngine([quiet, quiet, quiet, twoWins])
    expect(await findRevengePuzzles(missedMateGame(), 'w', engine, { gameId: 'g', botId: 'minik', now: 0 })).toEqual([])
  })

  it('skips moves where the player found the winning move, and small eval drops', async () => {
    const engine = new FakeEngine([
      [line('e2e4', 300), line('d2d4', 50, 2)],
      quiet,
      quiet,
      [line('h5f7', 300), line('c4f7', 50, 2)],
      [line('x', -200)],
    ])
    expect(await findRevengePuzzles(missedMateGame(), 'w', engine, { gameId: 'g', botId: 'minik', now: 0 })).toEqual([])
  })

  it('only looks at the player’s moves and respects the per-game cap', async () => {
    const win = [line('zzzz', 500), line('b', 0, 2)]
    const engine = new FakeEngine([win, [line('x', 0)]])
    const found = await findRevengePuzzles(missedMateGame(), 'b', engine, { gameId: 'g', botId: 'atli', now: 0 }, { maxPerGame: 1 })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ kind: 'missedWin', moveNumber: 1, playedSan: 'e5' })
  })
})
