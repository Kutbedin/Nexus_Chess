import { describe, expect, it } from 'vitest'
import { line } from '../../test/fakeEngine'
import { singleClearWinningMove } from './revenge'
import { INTERVAL_DAYS, isDue, isMastered, newReviewState, review } from './srs'

describe('revenge puzzle selection', () => {
  it('accepts a single clearly winning move', () => {
    expect(singleClearWinningMove([line('d1h5', 600), line('e2e4', 50, 2)])).toBe('d1h5')
  })

  it('rejects positions with two good answers', () => {
    expect(singleClearWinningMove([line('d1h5', 600), line('d1g4', 520, 2)])).toBeNull()
  })

  it('rejects positions that are not winning', () => {
    expect(singleClearWinningMove([line('e2e4', 120), line('d2d4', -300, 2)])).toBeNull()
  })

  it('rejects forced single-move positions', () => {
    expect(singleClearWinningMove([line('e1f1', 900)])).toBeNull()
  })

  it('treats a mate as winning', () => {
    const mate = { rank: 1, depth: 10, score: { type: 'mate' as const, value: 2 }, pv: ['h5f7'] }
    expect(singleClearWinningMove([mate, line('a2a3', 100, 2)])).toBe('h5f7')
  })
})

describe('spaced repetition', () => {
  const DAY = 86_400_000

  it('is due immediately, then after growing intervals', () => {
    let s = newReviewState(0)
    expect(isDue(s, 0)).toBe(true)
    s = review(s, true, 0)
    expect(s.dueAt).toBe(INTERVAL_DAYS[1] * DAY)
    s = review(s, true, s.dueAt)
    expect(s.box).toBe(2)
  })

  it('a miss sends the puzzle back to tomorrow', () => {
    let s = { box: 4, dueAt: 0, lapses: 0 }
    s = review(s, false, 0)
    expect(s).toEqual({ box: 1, dueAt: DAY, lapses: 1 })
  })

  it('caps at the mastered box', () => {
    let s = newReviewState(0)
    for (let i = 0; i < 10; i++) s = review(s, true, 0)
    expect(isMastered(s)).toBe(true)
  })
})
