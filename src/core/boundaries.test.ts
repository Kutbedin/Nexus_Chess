import { describe, expect, it } from 'vitest'

const sources = import.meta.glob<string>(['./**/*.ts', '!./**/*.test.ts'], { eager: true, query: '?raw', import: 'default' })

const FORBIDDEN_IMPORTS = /from ['"](react|react-dom|react-chessboard|i18next|react-i18next|posthog-js|stockfish)['"/]|from ['"]\.\.\/(\.\.\/)*(ui|platform|i18n)\//
const FORBIDDEN_GLOBALS = /\b(window|document|localStorage|navigator|Worker)\b\s*[.(]|Math\.random\(/

describe('src/core stays framework-free', () => {
  for (const [file, src] of Object.entries(sources)) {
    it(file, () => {
      const code = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
      expect(code).not.toMatch(FORBIDDEN_IMPORTS)
      expect(code).not.toMatch(FORBIDDEN_GLOBALS)
    })
  }
})
