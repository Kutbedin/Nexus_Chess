import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { initI18n } from './i18n/i18n'
import { createAnalytics } from './platform/analytics'
import { LocalStorageAdapter } from './platform/localStorageAdapter'
import { migrateLegacyLocalStorage, STORAGE_KEYS } from './platform/storageMigration'
import { resolveSchoolMode } from './platform/schoolMode'
import { StockfishWasmProvider } from './platform/stockfishEngine'
import { App } from './ui/App'
import './styles.css'

const FIRST_OPEN_KEY = STORAGE_KEYS.firstOpen

function firstOpenAt(): number {
  const stored = Number(localStorage.getItem(FIRST_OPEN_KEY))
  if (stored > 0) return stored
  const now = Date.now()
  localStorage.setItem(FIRST_OPEN_KEY, String(now))
  return now
}

async function bootstrap() {
  migrateLegacyLocalStorage(localStorage)
  const schoolMode = resolveSchoolMode(location.search, localStorage, import.meta.env.VITE_SCHOOL_MODE as string | undefined)
  const [, analytics] = await Promise.all([
    initI18n(),
    createAnalytics({
      key: import.meta.env.VITE_POSTHOG_KEY as string | undefined,
      host: import.meta.env.VITE_POSTHOG_HOST as string | undefined,
      schoolMode,
    }),
  ])
  void LocalStorageAdapter.requestPersistence()
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
  }

  const services = {
    engines: new StockfishWasmProvider(),
    storage: new LocalStorageAdapter(),
    analytics,
    firstOpenAt: firstOpenAt(),
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Suspense fallback={<div className="spinner" aria-busy="true" />}>
        <App services={services} />
      </Suspense>
    </StrictMode>,
  )
}

void bootstrap()
