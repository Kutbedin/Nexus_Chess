/**
 * Locale registry. Adding a language = add an entry here + a folder under ./locales/<code>/
 * with the same namespaces. Everything else (switcher, detection, lazy loading) is generic.
 */
export type LocaleStatus = 'stable' | 'beta'

export interface LocaleMeta {
  /** Name in its own language, shown in the switcher. Not translated on purpose. */
  nativeName: string
  /** `beta` = machine-translated, pending native review. */
  status: LocaleStatus
  dir: 'ltr' | 'rtl'
  /** Optional font stack override for scripts that need it (CJK, Arabic later). */
  fontFamily?: string
}

export const LOCALES = {
  tr: { nativeName: 'Türkçe', status: 'stable', dir: 'ltr' },
  en: { nativeName: 'English', status: 'stable', dir: 'ltr' },
  de: { nativeName: 'Deutsch', status: 'beta', dir: 'ltr' },
  fr: { nativeName: 'Français', status: 'beta', dir: 'ltr' },
  es: { nativeName: 'Español', status: 'beta', dir: 'ltr' },
  ru: { nativeName: 'Русский', status: 'beta', dir: 'ltr' },
  'zh-Hans': {
    nativeName: '简体中文',
    status: 'beta',
    dir: 'ltr',
    fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "Noto Sans CJK SC", sans-serif',
  },
} as const satisfies Record<string, LocaleMeta>

export type Locale = keyof typeof LOCALES

export const DEFAULT_LOCALE: Locale = 'tr'
export const SUPPORTED_LOCALES = Object.keys(LOCALES) as Locale[]
export const NAMESPACES = ['common', 'bots', 'coach', 'puzzles', 'about'] as const
export type Namespace = (typeof NAMESPACES)[number]
export const LOCALE_STORAGE_KEY = 'nexus.locale'

export function isLocale(value: string): value is Locale {
  return value in LOCALES
}

/**
 * Maps a BCP-47 tag from the browser to a supported locale, or null.
 * "de-AT" -> "de", "zh-CN"/"zh-SG"/"zh" -> "zh-Hans". Traditional Chinese is not mapped yet.
 */
export function matchLocale(tag: string): Locale | null {
  if (isLocale(tag)) return tag
  const lower = tag.toLowerCase()
  if (lower.startsWith('zh')) {
    const traditional = /^zh-(hant|tw|hk|mo)/.test(lower)
    return traditional ? null : 'zh-Hans'
  }
  const base = lower.split('-')[0]
  return isLocale(base) ? base : null
}
