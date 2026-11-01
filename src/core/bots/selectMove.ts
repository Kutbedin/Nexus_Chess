import { Chess } from 'chess.js'
import { scoreToCp, type CandidateLine } from '../engine/types'
import { pickWeighted, type Rng } from '../random'
import { PIECE_VALUE, findHangingPieces } from '../tactics/tactics'
import type { BotPersonality, OpeningBook } from './types'


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
  const rolled = rng() < bot.blunderChance ? bot.blunderLossCp : bot.maxLossCp
  const tolerance = Math.min(rolled, bot.safety?.hardMaxLossCp ?? Infinity)
  const botColor = chess.turn()

  const scored = lines
    .map((l) => {
      const uci = l.pv[0]
      const cp = scoreToCp(l.score)
      let styleBonus = 0
      try {
        const m = chess.move(uci)
        if (m.isCapture()) styleBonus += bot.style.aggression / 2 + bot.style.materialism * PIECE_VALUE[m.captured ?? 'p']
        if (chess.inCheck()) styleBonus += bot.style.aggression
        const hangsHeavy = !!bot.safety?.avoidHangingHeavyPieces && leavesHeavyPieceHanging(chess.fen(), botColor)
        chess.undo()
        return { uci, cp, styleBonus, weight: 0, hangsHeavy }
      } catch {
        return null
      }
    })
    .filter((c): c is ScoredCandidate & { hangsHeavy: boolean } => c !== null && best - c.cp <= tolerance)

  // A careful beginner never leaves a queen/rook en prise, unless every option does.
  const safe = scored.filter((c) => !c.hangsHeavy)
  const pool = (safe.length > 0 ? safe : scored).map(({ hangsHeavy: _ignored, ...c }) => c)

  const t = Math.max(1, bot.temperatureCp)
  const top = Math.max(...pool.map((c) => c.cp + c.styleBonus))
  for (const c of pool) c.weight = Math.exp((c.cp + c.styleBonus - top) / t)
  return pool
}

function leavesHeavyPieceHanging(fenAfter: string, color: 'w' | 'b'): boolean {
  return findHangingPieces(fenAfter, color).some((h) => PIECE_VALUE[h.piece] >= 5)
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
