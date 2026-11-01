import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import type { EnginePort } from './core/engine/types'
import { initI18n } from './i18n/i18n'
import { createAnalytics } from './platform/analytics'
import { LocalProgressRepository } from './platform/progressStore'
import { StockfishEngine } from './platform/stockfishEngine'
import { App } from './ui/App'
import './styles.css'

let engine: EnginePort | null = null
const getEngine = () => (engine ??= new StockfishEngine())

async function bootstrap() {
  const [, analytics] = await Promise.all([initI18n(), createAnalytics()])
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Suspense fallback={<div className="spinner" aria-busy="true" />}>
        <App services={{ getEngine, progress: new LocalProgressRepository(), analytics }} />
      </Suspense>
    </StrictMode>,
  )
}

void bootstrap()
