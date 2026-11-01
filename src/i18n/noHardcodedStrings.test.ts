import { describe, expect, it } from 'vitest'

/**
 * Guard for the "no hardcoded user-facing strings" rule. Flags JSX text nodes and
 * user-visible attributes that contain letters in any script. Emoji, chess glyphs,
 * punctuation, and {expressions} are allowed.
 */
const sources = import.meta.glob<string>('../ui/**/*.tsx', { eager: true, query: '?raw', import: 'default' })

const LETTER = /\p{L}{2,}/u
const JSX_TEXT = />([^<>{}]+)</g
const JS_KEYWORD = /^(return|const|let|if|else|export|function|interface|type)\b/
const ATTRS = /\b(aria-label|title|placeholder|alt)="([^"]*)"/g

describe('UI components', () => {
  for (const [file, src] of Object.entries(sources)) {
    it(`${file} has no hardcoded user-facing text`, () => {
      const offenders: string[] = []
      const code = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
      for (const m of code.matchAll(JSX_TEXT)) {
        const text = m[1].trim()
        // Skip TypeScript generics/comparisons that look like JSX text.
        if (text && LETTER.test(text) && !/[=;()&|]/.test(text) && !JS_KEYWORD.test(text)) offenders.push(text)
      }
      for (const m of code.matchAll(ATTRS)) if (LETTER.test(m[2])) offenders.push(`${m[1]}="${m[2]}"`)
      expect(offenders).toEqual([])
    })
  }
})
