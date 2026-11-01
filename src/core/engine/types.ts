/** Score from the side-to-move's perspective, as reported by UCI. */
export type EngineScore = { type: 'cp'; value: number } | { type: 'mate'; value: number }

export interface CandidateLine {
  /** 1-based MultiPV rank. */
  rank: number
  depth: number
  score: EngineScore
  /** Principal variation in UCI notation; pv[0] is the candidate move. */
  pv: string[]
}

export interface AnalyseOptions {
  multiPv: number
  depth?: number
  movetimeMs?: number
  /** UCI_Elo / Skill Level are deliberately not used: personality comes from our own move choice. */
}

/**
 * Port for any UCI engine. The browser adapter runs Stockfish in a Web Worker as a
 * separate program (GPL boundary); tests use a fake.
 */
export interface EnginePort {
  analyse(fen: string, options: AnalyseOptions): Promise<CandidateLine[]>
  stop(): void
  dispose(): void
}

const MATE_CP = 100_000

/** Collapses a score to centipawns so candidates can be compared and weighted. */
export function scoreToCp(score: EngineScore): number {
  if (score.type === 'cp') return score.value
  // Faster mates rank higher; being mated ranks lowest.
  return score.value > 0 ? MATE_CP - score.value : -MATE_CP - score.value
}
