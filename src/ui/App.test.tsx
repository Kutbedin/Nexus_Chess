import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { beforeAll, describe, expect, it } from 'vitest'
import { noopAnalytics } from '../core/analytics/analytics'
import { EMPTY_PROGRESS } from '../core/progression/levelMap'
import { initI18n } from '../i18n/i18n'
import { LOCALE_STORAGE_KEY } from '../i18n/locales'
import { FakeEngine } from '../test/fakeEngine'
import { App, type AppServices } from './App'

const services: AppServices = {
  getEngine: () => new FakeEngine(),
  progress: { load: async () => EMPTY_PROGRESS, save: async () => {} },
  analytics: noopAnalytics,
}

describe('App shell', () => {
  beforeAll(async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'tr')
    await initI18n()
  })

  it('renders Turkish by default, switches language, and persists the choice', async () => {
    render(
      <Suspense fallback={null}>
        <App services={services} />
      </Suspense>,
    )
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

  it('shows only the first level as playable', async () => {
    render(
      <Suspense fallback={null}>
        <App services={services} />
      </Suspense>,
    )
    const path = await screen.findByRole('list')
    const buttons = within(path).getAllByRole('button')
    expect(buttons.map((b) => (b as HTMLButtonElement).disabled)).toEqual([false, true, true, true])
  })
})
