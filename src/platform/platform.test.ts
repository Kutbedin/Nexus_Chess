import { describe, expect, it, vi } from 'vitest'
import { appOpenedEvent, isoWeek, noopAnalytics } from '../core/analytics/analytics'
import { EMPTY_PROGRESS } from '../core/progression/levelMap'
import { EMPTY_PUZZLE_STATS } from '../core/storage/storageAdapter'
import { createAnalytics } from './analytics'
import { LocalStorageAdapter } from './localStorageAdapter'
import { resolveSchoolMode } from './schoolMode'
import { STOCKFISH_INFO } from './stockfishEngine'

vi.mock('posthog-js', () => ({ default: { init: vi.fn(), capture: vi.fn() } }))

describe('school mode', () => {
  it('is off by default, sticky after ?mode=school, cleared by ?mode=home', () => {
    localStorage.clear()
    expect(resolveSchoolMode('', localStorage, undefined)).toBe(false)
    expect(resolveSchoolMode('?mode=school', localStorage, undefined)).toBe(true)
    expect(resolveSchoolMode('', localStorage, undefined)).toBe(true)
    expect(resolveSchoolMode('?mode=home', localStorage, undefined)).toBe(false)
  })

  it('is forced on by the build flag', () => {
    expect(resolveSchoolMode('?mode=home', null, 'true')).toBe(true)
  })
})

describe('analytics', () => {
  it('fully disables analytics in school mode, even with a key; PostHog is never loaded', async () => {
    const posthog = (await import('posthog-js')).default
    vi.mocked(posthog.init).mockClear()
    expect(await createAnalytics({ key: 'phc_test', schoolMode: true })).toBe(noopAnalytics)
    expect(posthog.init).not.toHaveBeenCalled()
  })

  it('initialises PostHog EU in cookieless, anonymous mode', async () => {
    const posthog = (await import('posthog-js')).default
    const port = await createAnalytics({ key: 'phc_test', schoolMode: false })
    expect(posthog.init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({
        api_host: 'https://eu.i.posthog.com',
        cookieless_mode: 'always',
        persistence: 'memory',
        person_profiles: 'never',
        autocapture: false,
      }),
    )
    port.track({ name: 'revenge_created', count: 2 })
    expect(posthog.capture).toHaveBeenCalledWith('revenge_created', { count: 2 })
  })

  it('computes anonymous retention properties instead of a user id', () => {
    const first = Date.UTC(2026, 10, 1, 12)
    expect(appOpenedEvent(first, first + 7 * 86_400_000 + 1000)).toEqual({ name: 'app_opened', daysSinceFirstOpen: 7, firstOpenWeek: '2026-W44' })
    expect(isoWeek(new Date(Date.UTC(2027, 0, 1)))).toBe('2026-W53')
  })
})

describe('LocalStorageAdapter', () => {
  it('round-trips progress, revenge, and puzzle stats, with safe defaults', async () => {
    localStorage.clear()
    const s = new LocalStorageAdapter(localStorage)
    expect(await s.loadProgress()).toEqual(EMPTY_PROGRESS)
    expect(await s.loadRevenge()).toEqual([])
    expect(await s.loadPuzzleStats()).toEqual(EMPTY_PUZZLE_STATS)

    const progress = { version: 1 as const, nodes: { 'w1-1': { completed: true, stars: 2 as const, attempts: 1 } } }
    await s.saveProgress(progress)
    await s.savePuzzleStats({ version: 1, solved: { abc: { firstTry: true, at: 1, pack: '01' } } })
    expect(await s.loadProgress()).toEqual(progress)
    expect((await s.loadPuzzleStats()).solved.abc.pack).toBe('01')

    localStorage.setItem('nexus.revenge.v1', '{broken')
    expect(await s.loadRevenge()).toEqual([])
  })
})

describe('engine provider info', () => {
  it('pins the exact Stockfish build we distribute', () => {
    expect(STOCKFISH_INFO.license).toBe('GPL-3.0')
    expect(STOCKFISH_INFO.build).toContain('stockfish@19.0.1')
    expect(STOCKFISH_INFO.build).toContain('0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6')
  })
})
