import { describe, expect, it } from 'vitest'
import { generateCode, isValidCode } from './classroom/model'
import { ENGLISH_LETTERS, localizeSan } from './notation/localizeSan'
import { seededRng } from './random'

describe('anonymous class codes', () => {
  it('generates WORD-1234 codes', () => {
    const rng = seededRng(42)
    for (let i = 0; i < 50; i++) expect(isValidCode(generateCode(rng))).toBe(true)
    expect(isValidCode('ayse-12')).toBe(false)
  })
})

describe('localized SAN', () => {
  const tr = { K: 'Ş', Q: 'V', R: 'K', B: 'F', N: 'A' }
  const ru = { K: 'Кр', Q: 'Ф', R: 'Л', B: 'С', N: 'К' }

  it('rewrites piece letters and promotions', () => {
    expect(localizeSan('Nxe5+', tr)).toBe('Axe5+')
    expect(localizeSan('Kf1', tr)).toBe('Şf1')
    expect(localizeSan('Rae1', tr)).toBe('Kae1')
    expect(localizeSan('exd8=Q#', tr)).toBe('exd8=V#')
    expect(localizeSan('Qh4#', ru)).toBe('Фh4#')
  })

  it('leaves castling, pawn moves, and English untouched', () => {
    expect(localizeSan('O-O-O+', tr)).toBe('O-O-O+')
    expect(localizeSan('e4', tr)).toBe('e4')
    expect(localizeSan('Bxf7+', ENGLISH_LETTERS)).toBe('Bxf7+')
  })
})
