import type { AnalyseOptions, CandidateLine, EnginePort } from '../core/engine/types'

/** Scripted engine: each analyse() call returns the next queued answer. */
export class FakeEngine implements EnginePort {
  readonly calls: Array<{ fen: string; options: AnalyseOptions }> = []
  private readonly answers: CandidateLine[][]

  constructor(answers: Array<string | CandidateLine[]> = []) {
    this.answers = answers.map((a) => (typeof a === 'string' ? [line(a, 0)] : a))
  }

  async analyse(fen: string, options: AnalyseOptions): Promise<CandidateLine[]> {
    this.calls.push({ fen, options })
    const next = this.answers.shift()
    if (!next) throw new Error('FakeEngine: no scripted answer left')
    return next
  }

  stop(): void {}
  dispose(): void {}
}

export function line(uci: string, cp: number, rank = 1): CandidateLine {
  return { rank, depth: 10, score: { type: 'cp', value: cp }, pv: [uci] }
}
