import i18next, { type i18n as I18n } from 'i18next'
import resourcesToBackend from 'i18next-resources-to-backend'
import { initReactI18next } from 'react-i18next'
import { DEFAULT_LOCALE, LOCALES, LOCALE_STORAGE_KEY, NAMESPACES, isLocale, matchLocale, type Locale } from './locales'

/** Stored choice wins; otherwise the first supported browser language; otherwise Turkish. */
export function detectLocale(storage: Pick<Storage, 'getItem'> | null, browserLanguages: readonly string[]): Locale {
  const stored = storage?.getItem(LOCALE_STORAGE_KEY)
  if (stored && isLocale(stored)) return stored
  for (const tag of browserLanguages) {
    const match = matchLocale(tag)
    if (match) return match
  }
  return DEFAULT_LOCALE
}

function applyDocumentLocale(locale: Locale): void {
  const meta = LOCALES[locale]
  const root = document.documentElement
  root.lang = locale
  root.dir = meta.dir
  root.style.setProperty('--locale-font', 'fontFamily' in meta ? meta.fontFamily : 'inherit')
}

export async function initI18n(): Promise<I18n> {
  const storage = typeof localStorage === 'undefined' ? null : localStorage
  const lng = detectLocale(storage, typeof navigator === 'undefined' ? [] : navigator.languages)

  await i18next
    .use(initReactI18next)
    // Each locale/namespace is a separate chunk; only the active language is fetched.
    .use(resourcesToBackend((language: string, namespace: string) => import(`./locales/${language}/${namespace}.json`)))
    .init({
      lng,
      supportedLngs: Object.keys(LOCALES),
      // Key parity is enforced by tests, so stable locales load nothing extra.
      // Beta (machine-translated) locales keep English as a safety net.
      fallbackLng: { default: ['en'], en: [], tr: [] },
      ns: [...NAMESPACES],
      defaultNS: 'common',
      load: 'currentOnly',
      interpolation: { escapeValue: false },
      returnNull: false,
    })

  applyDocumentLocale(lng)
  i18next.on('languageChanged', (next) => {
    if (!isLocale(next)) return
    applyDocumentLocale(next)
    storage?.setItem(LOCALE_STORAGE_KEY, next)
  })
  return i18next
}
