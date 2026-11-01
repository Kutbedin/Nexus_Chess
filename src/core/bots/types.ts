/** Keyed by space-joined UCI history from the initial position ("" = first move). */
export type OpeningBook = Readonly<Record<string, ReadonlyArray<readonly [uci: string, weight: number]>>>

export interface BotStyle {
  /** Bonus in centipawns for checks and captures that keep the eval within tolerance. */
  aggression: number
  /** Bonus in centipawns per pawn-unit of material captured. */
  materialism: number
}

export interface BotSafety {
  /** Never play a move that leaves a queen or rook en prise (attacked and undefended / attacked by a cheaper piece). */
  avoidHangingHeavyPieces: boolean
  /** Upper bound on any move's loss vs. the best candidate, even on a blunder roll. */
  hardMaxLossCp: number
}

export interface BotPersonality {
  /** Stable id; i18n key prefix in the `bots` namespace (title, tagline, lines). */
  id: string
  /**
   * Turkish proper name, shown unchanged in every locale (like a person's name).
   * Only the title, tagline, and speech lines are translated.
   */
  name: string
  avatar: string
  /** Displayed approximate strength, not used by the engine. */
  displayElo: number
  isBoss: boolean
  search: { depth: number; multiPv: number }
  /** Softmax temperature in centipawns. Higher = more human-like randomness. */
  temperatureCp: number
  /** Normal moves never lose more than this versus the best candidate. */
  maxLossCp: number
  /** Probability per move of widening tolerance to `blunderLossCp`. */
  blunderChance: number
  blunderLossCp: number
  style: BotStyle
  safety?: BotSafety
  book: OpeningBook
}

/** Events the bot reacts to with a speech bubble. Text lives in locale files, never here. */
export type ReactionEvent =
  | 'greeting'
  | 'botCaptures'
  | 'playerCaptures'
  | 'botGivesCheck'
  | 'playerGivesCheck'
  | 'botWins'
  | 'botLoses'
  | 'draw'
