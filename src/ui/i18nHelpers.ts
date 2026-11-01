import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { CoachMessage } from '../core/coach/coach'
import { ENGLISH_LETTERS, localizeSan, type PieceLetters } from '../core/notation/localizeSan'

/** Returns a SAN formatter that uses the active locale's piece letters. */
export function useLocalizedSan(): (san: string) => string {
  const { t, i18n } = useTranslation('common')
  const language = i18n.language
  return useCallback(
    (san: string) => {
      const letters: unknown = t('notation', { returnObjects: true, lng: language })
      return localizeSan(san, isPieceLetters(letters) ? letters : ENGLISH_LETTERS)
    },
    [t, language],
  )
}

function isPieceLetters(value: unknown): value is PieceLetters {
  return typeof value === 'object' && value !== null && ['K', 'Q', 'R', 'B', 'N'].every((k) => k in value)
}

/**
 * Resolves a locale-agnostic coach message into the active language.
 * `context` is the raw piece symbol so translators can add gendered variants
 * (e.g. `hangingPiece_q`) without code changes.
 */
export function renderCoachMessage(
  t: TFunction,
  msg: CoachMessage,
  formatSan: (san: string) => string,
): string {
  const params: Record<string, string | number> = { ...msg.params }
  for (const [name, symbol] of Object.entries(msg.pieceParams ?? {})) params[name] = t(`common:pieces.${symbol}`)
  for (const [name, san] of Object.entries(msg.sanParams ?? {})) params[name] = formatSan(san)
  return t(`coach:${msg.key}`, { ...params, context: msg.pieceParams?.piece })
}
