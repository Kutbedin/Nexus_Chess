import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode, Suspense } from 'react'
import { beforeAll, describe, expect, it } from 'vitest'
import { getBot } from '../../core/bots/roster'
import { initI18n } from '../../i18n/i18n'
import { LOCALE_STORAGE_KEY } from '../../i18n/locales'
import { FakeEngine } from '../../test/fakeEngine'
import { GameScreen } from './GameScreen'

function square(id: string): HTMLElement {
  const el = document.querySelector(`[data-square="${id}"]`)
  if (!el) throw new Error(`square ${id} not rendered`)
  return el as HTMLElement
}

describe('GameScreen', () => {
  beforeAll(async () => {
    // jsdom has no layout; the board's move animation needs a non-zero square size.
    HTMLElement.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, right: 60, bottom: 60, width: 60, height: 60, toJSON: () => ({}) })
    localStorage.setItem(LOCALE_STORAGE_KEY, 'tr')
    await initI18n()
  })

  it('click-to-move works under StrictMode and the bot answers', async () => {
    // Minik's book answers 1.e4 with 1...e5, so the engine is not consulted.
    render(
      <StrictMode>
        <Suspense fallback={null}>
          <GameScreen bot={getBot('minik')} engine={new FakeEngine()} onFinished={() => {}} onExit={() => {}} />
        </Suspense>
      </StrictMode>,
    )
    await screen.findByText('Sıra sende')
    fireEvent.click(square('e2'))
    fireEvent.click(square('e4'))
    const moves = await screen.findByRole('region', { name: 'Hamleler' })
    await act(() => new Promise((r) => setTimeout(r, 600)))
    expect(within(moves).getByText('e4')).toBeInTheDocument()
    expect(within(moves).getByText('e5')).toBeInTheDocument()
  })
})
