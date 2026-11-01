import { describe, expect, it } from 'vitest'
import { getBot } from '../core/bots/roster'
import { BOTS } from '../core/bots/roster'
import type { ReactionEvent } from '../core/bots/types'
import { detectLocale } from './i18n'
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, LOCALES, NAMESPACES, SUPPORTED_LOCALES, matchLocale, type Locale } from './locales'

type Json = { [k: string]: Json } | Json[] | string
const files = import.meta.glob<Json>('./locales/*/*.json', { eager: true, import: 'default' })

function resource(locale: Locale, ns: string): Json {
  const r = files[`./locales/${locale}/${ns}.json`]
  if (!r) throw new Error(`Missing ${locale}/${ns}.json`)
  return r
}

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

/** Flattens to dotted keys; arrays count as leaf values (bot line lists). */
function flatten(obj: Json, prefix = ''): Map<string, Json> {
  const out = new Map<string, Json>()
  if (typeof obj === 'string' || Array.isArray(obj)) return out.set(prefix, obj)
  for (const [k, v] of Object.entries(obj)) for (const [kk, vv] of flatten(v, prefix ? `${prefix}.${k}` : k)) out.set(kk, vv)
  return out
}

function baseKeys(map: Map<string, Json>): Set<string> {
  return new Set([...map.keys()].map((k) => k.replace(PLURAL_SUFFIX, '')))
}

function placeholders(value: Json): string[] {
  const text = Array.isArray(value) ? value.join(' ') : String(value)
  return [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort()
}

describe('locale files', () => {
  for (const ns of NAMESPACES) {
    const reference = flatten(resource(DEFAULT_LOCALE, ns))
    const refBase = baseKeys(reference)

    for (const locale of SUPPORTED_LOCALES) {
      describe(`${locale}/${ns}`, () => {
        const map = flatten(resource(locale, ns))

        it('has exactly the keys of the Turkish reference (plural forms aside)', () => {
          expect([...baseKeys(map)].sort()).toEqual([...refBase].sort())
        })

        it('provides every plural category the language needs', () => {
          const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories
          const plural = [...refBase].filter((k) => [...reference.keys()].some((rk) => rk !== k && rk.replace(PLURAL_SUFFIX, '') === k))
          for (const key of plural) for (const cat of categories) expect(map.has(`${key}_${cat}`), `${key}_${cat}`).toBe(true)
        })

        it('uses the same interpolation placeholders', () => {
          for (const [key, value] of map) {
            const refValue = reference.get(key) ?? reference.get(`${key.replace(PLURAL_SUFFIX, '')}_other`)
            if (refValue === undefined) continue
            expect(placeholders(value), `${locale}/${ns}:${key}`).toEqual(placeholders(refValue))
          }
        })

        it('has no empty strings', () => {
          for (const [key, value] of map) {
            const values = Array.isArray(value) ? value : [value]
            expect(values.length, key).toBeGreaterThan(0)
            for (const v of values) expect(String(v).trim(), key).not.toBe('')
          }
        })
      })
    }
  }

  it('every bot has a title, tagline, and lines for every reaction in every locale; names are not translated', () => {
    const events: ReactionEvent[] = ['greeting', 'botCaptures', 'playerCaptures', 'botGivesCheck', 'playerGivesCheck', 'botWins', 'botLoses', 'draw']
    for (const locale of SUPPORTED_LOCALES) {
      const bots = flatten(resource(locale, 'bots'))
      for (const bot of BOTS) {
        expect(bots.has(`${getBot(bot.id).id}.title`), `${locale} ${bot.id} title`).toBe(true)
        expect(bots.has(`${bot.id}.tagline`), `${locale} ${bot.id} tagline`).toBe(true)
        expect(bots.has(`${bot.id}.name`), `${locale} ${bot.id}: proper names live in the roster`).toBe(false)
        for (const e of events) expect(Array.isArray(bots.get(`${bot.id}.lines.${e}`)), `${locale} ${bot.id} ${e}`).toBe(true)
      }
    }
  })

  it('piece letters are distinct within each locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const letters = Object.values((resource(locale, 'common') as Record<string, Json>).notation as Record<string, string>)
      expect(new Set(letters).size, locale).toBe(5)
    }
  })
})

describe('locale detection', () => {
  const store = (value: string | null) => ({ getItem: (k: string) => (k === LOCALE_STORAGE_KEY ? value : null) })

  it('prefers the stored choice', () => {
    expect(detectLocale(store('de'), ['en-US'])).toBe('de')
  })

  it('falls back to the first supported browser language, then Turkish', () => {
    expect(detectLocale(store(null), ['ja-JP', 'ru-RU', 'en'])).toBe('ru')
    expect(detectLocale(store(null), ['ja-JP'])).toBe(DEFAULT_LOCALE)
    expect(detectLocale(store('xx'), [])).toBe(DEFAULT_LOCALE)
  })

  it('maps Chinese variants', () => {
    expect(matchLocale('zh-CN')).toBe('zh-Hans')
    expect(matchLocale('zh')).toBe('zh-Hans')
    expect(matchLocale('zh-TW')).toBeNull()
    expect(matchLocale('de-AT')).toBe('de')
  })

  it('marks only tr and en as stable', () => {
    expect(SUPPORTED_LOCALES.filter((l) => LOCALES[l].status === 'stable')).toEqual(['tr', 'en'])
  })
})
