import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { noopAnalytics } from '../core/analytics/analytics'
import type { EngineProvider } from '../core/engine/provider'
import { EMPTY_PROGRESS } from '../core/progression/levelMap'
import { addRevengePuzzles, type RevengeEntry } from '../core/revenge/revenge'
import { EMPTY_PUZZLE_STATS, type StorageAdapter } from '../core/storage/storageAdapter'
import i18n from 'i18next'
import { initI18n } from '../i18n/i18n'
import { LOCALE_STORAGE_KEY } from '../i18n/locales'
import { STOCKFISH_INFO } from '../platform/stockfishEngine'
import { FakeEngine } from '../test/fakeEngine'
import { fetchPuzzleFile } from '../test/puzzleFiles'
import { App, type AppServices } from './App'

const engines: EngineProvider = { info: STOCKFISH_INFO, get: () => new FakeEngine() }

function memoryStorage(revenge: RevengeEntry[] = []): StorageAdapter {
  return {
    loadProgress: async () => EMPTY_PROGRESS,
    saveProgress: async () => {},
    loadRevenge: async () => revenge,
    saveRevenge: async () => {},
    loadPuzzleStats: async () => EMPTY_PUZZLE_STATS,
    savePuzzleStats: async () => {},
  }
}

const services = (storage = memoryStorage()): AppServices => ({ engines, storage, analytics: noopAnalytics, firstOpenAt: 0, now: () => 1000 })

function renderApp(s = services()) {
  return render(
    <Suspense fallback={null}>
      <App services={s} />
    </Suspense>,
  )
}

describe('App shell', () => {
  beforeAll(async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'tr')
    await initI18n()
    vi.stubGlobal('fetch', fetchPuzzleFile)
    // jsdom has no layout; the board's move animation needs a non-zero square size.
    HTMLElement.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, right: 60, bottom: 60, width: 60, height: 60, toJSON: () => ({}) })
  })
  afterAll(() => vi.unstubAllGlobals())
  beforeEach(async () => {
    await act(() => i18n.changeLanguage('tr'))
  })

  it('renders Turkish by default, switches language, and persists the choice', async () => {
    renderApp()
    expect(await screen.findByRole('heading', { level: 1, name: 'Nexus Satranç' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('tr')

    await act(() => userEvent.selectOptions(screen.getByRole('combobox'), 'de'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Nexus Schach' })).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent(/maschinell/)
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('de')
    expect(document.documentElement.lang).toBe('de')

    await act(() => userEvent.selectOptions(screen.getByRole('combobox'), 'en'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Nexus Chess' })).toBeInTheDocument()
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('beta locales offer a "report translation error" mail link with locale and screen', async () => {
    renderApp()
    await act(() => i18n.changeLanguage('fr'))
    const link = await screen.findByRole('link', { name: 'Signaler une erreur de traduction' })
    const href = link.getAttribute('href')!
    expect(href).toMatch(/^mailto:contact@nexuschess\.com\?subject=/)
    expect(decodeURIComponent(href)).toContain('[translation][fr] map')
  })

  it('World 1 has 4 bots with Turkish names in every locale; only the first node is playable', async () => {
    renderApp()
    await act(() => i18n.changeLanguage('en'))
    const path = await screen.findByRole('list')
    const buttons = within(path).getAllByRole('button')
    expect(buttons.map((b) => (b as HTMLButtonElement).disabled)).toEqual([false, true, true, true, true, true, true])
    for (const name of ['Minik Mert', 'Atlı Ayşe', 'Fil Filiz', 'Sultan Kale']) expect(within(path).getByText(name)).toBeInTheDocument()
    expect(within(path).getByText('The Rookie')).toBeInTheDocument()
  })

  it('lists graded puzzle packs and opens a puzzle', async () => {
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Bulmacalar' }))
    const first = await screen.findByRole('button', { name: /Paket 1/ })
    expect(screen.getByRole('button', { name: /Paket 2/ })).toBeDisabled()
    await userEvent.click(first)
    expect(await screen.findByText(/oynar ve kazanır/)).toBeInTheDocument()
    expect(screen.getByText(/^Puan \d+$/)).toBeInTheDocument()
  })

  it('shows due revenge puzzles with the story hook', async () => {
    const revenge = addRevengePuzzles(
      [],
      [
        {
          id: 'g:6',
          fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
          solutionUci: 'h5f7',
          kind: 'missedMate',
          mateIn: 1,
          botId: 'minik',
          moveNumber: 4,
          playedSan: 'Nc3',
          createdAt: 0,
        },
      ],
    )
    const saved: RevengeEntry[][] = []
    renderApp(services({ ...memoryStorage(revenge), saveRevenge: async (e) => void saved.push([...e]) }))
    const nav = await screen.findByRole('button', { name: /İntikam\s*1/ })
    await userEvent.click(nav)
    expect(await screen.findByText(/Minik Mert karşısında kaçırdığın mat! 4\. hamlede Ac3 oynamıştın/)).toBeInTheDocument()

    const square = (s: string) => document.querySelector(`[data-square="${s}"]`) as HTMLElement
    await userEvent.click(square('h5'))
    await userEvent.click(square('f7'))
    expect(await screen.findByText('Harika! İlk denemede çözdün.')).toBeInTheDocument()
    expect(saved.at(-1)?.[0].review.box).toBe(1)
  })

  it('About page carries the Stockfish GPLv3 notice, exact build, source link, and contact', async () => {
    renderApp()
    await act(() => i18n.changeLanguage('en'))
    await userEvent.click(await screen.findByRole('button', { name: 'About' }))
    expect(await screen.findByText(/GNU General Public License version 3/)).toBeInTheDocument()
    expect(screen.getByText(/All rights reserved/)).toBeInTheDocument()
    expect(screen.getByText(/0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'https://github.com/Kutbedin/stockfish-wasm-fork' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'contact@nexuschess.com' }).length).toBeGreaterThan(0)
  })
})
