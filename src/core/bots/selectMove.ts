import { Chess } from 'chess.js'
import { scoreToCp, type CandidateLine } from '../engine/types'
import { pickWeighted, type Rng } from '../random'
import type { BotPersonality, OpeningBook } from './types'

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

export function bookMove(book: OpeningBook, uciHistory: readonly string[], fen: string, rng: Rng): string | null {
  const entries = book[uciHistory.join(' ')]
  if (!entries || entries.length === 0) return null
  const legal = new Set(new Chess(fen).moves({ verbose: true }).map((m) => m.lan))
  const playable = entries.filter(([uci]) => legal.has(uci))
  if (playable.length === 0) return null
  return pickWeighted(
    playable.map(([uci]) => uci),
    playable.map(([, w]) => w),
    rng,
  )
}

export interface ScoredCandidate {
  uci: string
  cp: number
  styleBonus: number
  weight: number
}

/**
 * Personality-weighted choice among MultiPV candidates:
 * 1. drop candidates that lose more than the tolerance vs. the best line,
 * 2. add style bonuses (checks, captures),
 * 3. softmax-sample with the bot's temperature.
 */
export function scoreCandidates(
  fen: string,
  lines: readonly CandidateLine[],
  bot: BotPersonality,
  rng: Rng,
): ScoredCandidate[] {
  if (lines.length === 0) return []
  const chess = new Chess(fen)
  const best = Math.max(...lines.map((l) => scoreToCp(l.score)))
  const tolerance = rng() < bot.blunderChance ? bot.blunderLossCp : bot.maxLossCp

  const scored = lines
    .map((l) => {
      const uci = l.pv[0]
      const cp = scoreToCp(l.score)
      let styleBonus = 0
      try {
        const m = chess.move(uci)
        if (m.isCapture()) styleBonus += bot.style.aggression / 2 + bot.style.materialism * PIECE_VALUE[m.captured ?? 'p']
        if (chess.inCheck()) styleBonus += bot.style.aggression
        chess.undo()
      } catch {
        return null
      }
      return { uci, cp, styleBonus, weight: 0 }
    })
    .filter((c): c is ScoredCandidate => c !== null && best - c.cp <= tolerance)

  const t = Math.max(1, bot.temperatureCp)
  const top = Math.max(...scored.map((c) => c.cp + c.styleBonus))
  for (const c of scored) c.weight = Math.exp((c.cp + c.styleBonus - top) / t)
  return scored
}

export function chooseEngineMove(fen: string, lines: readonly CandidateLine[], bot: BotPersonality, rng: Rng): string | null {
  const scored = scoreCandidates(fen, lines, bot, rng)
  if (scored.length === 0) return lines[0]?.pv[0] ?? null
  return pickWeighted(
    scored.map((c) => c.uci),
    scored.map((c) => c.weight),
    rng,
  )
}
