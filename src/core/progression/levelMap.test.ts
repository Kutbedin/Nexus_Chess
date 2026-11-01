import { describe, expect, it } from 'vitest'
import { getBot } from '../bots/roster'
import { EMPTY_PROGRESS, WORLD_1, isUnlocked, recordGameResult, recordPuzzleNodeCompleted } from './levelMap'

describe('level map progression', () => {
  it('only the first node is open at the start', () => {
    expect(WORLD_1.filter((n) => isUnlocked(WORLD_1, EMPTY_PROGRESS, n.id)).map((n) => n.id)).toEqual(['w1-1'])
  })

  it('a loss records an attempt but does not unlock the next node', () => {
    const p = recordGameResult(EMPTY_PROGRESS, 'w1-1', 'loss')
    expect(p.nodes['w1-1']).toEqual({ completed: false, stars: 0, attempts: 1 })
    expect(isUnlocked(WORLD_1, p, 'w1-2')).toBe(false)
  })

  it('a win unlocks the next node and stars never decrease', () => {
    let p = recordGameResult(EMPTY_PROGRESS, 'w1-1', 'win')
    p = recordGameResult(p, 'w1-1', 'loss')
    expect(p.nodes['w1-1']).toMatchObject({ completed: true, stars: 3, attempts: 2 })
    expect(isUnlocked(WORLD_1, p, 'w1-2')).toBe(true)
  })

  it('the boss unlocks after the whole path', () => {
    let p = recordGameResult(EMPTY_PROGRESS, 'w1-1', 'win')
    p = recordPuzzleNodeCompleted(p, 'w1-2')
    expect(isUnlocked(WORLD_1, p, 'w1-boss')).toBe(false)
    p = recordGameResult(p, 'w1-3', 'win')
    p = recordPuzzleNodeCompleted(p, 'w1-4')
    p = recordGameResult(p, 'w1-5', 'win')
    expect(isUnlocked(WORLD_1, p, 'w1-boss')).toBe(false)
    p = recordPuzzleNodeCompleted(p, 'w1-6')
    expect(isUnlocked(WORLD_1, p, 'w1-boss')).toBe(true)
  })

  it('World 1 has three regular bots and one boss, each with a puzzle stop in between', () => {
    const bots = WORLD_1.filter((n) => n.botId).map((n) => getBot(n.botId!))
    expect(bots.filter((b) => !b.isBoss)).toHaveLength(3)
    expect(bots.filter((b) => b.isBoss)).toHaveLength(1)
    expect(WORLD_1.filter((n) => n.kind === 'puzzles')).toHaveLength(3)
  })

  it('boss nodes point at boss bots', () => {
    for (const n of WORLD_1.filter((n) => n.kind === 'boss')) expect(getBot(n.botId!).isBoss).toBe(true)
  })
})
