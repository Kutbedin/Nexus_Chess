import type { CandidateLine, EngineScore } from './types'

/** Parses a UCI `info` line that carries a PV. Returns null for anything else. */
export function parseInfoLine(line: string): CandidateLine | null {
  if (!line.startsWith('info ') || !line.includes(' pv ')) return null
  const tokens = line.split(/\s+/)
  let depth = 0
  let rank = 1
  let score: EngineScore | null = null
  let pv: string[] = []
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i]
    if (t === 'depth') depth = Number(tokens[++i])
    else if (t === 'multipv') rank = Number(tokens[++i])
    else if (t === 'score') {
      const kind = tokens[++i]
      const value = Number(tokens[++i])
      if (kind === 'cp' || kind === 'mate') score = { type: kind, value }
      if (tokens[i + 1] === 'lowerbound' || tokens[i + 1] === 'upperbound') return null
    } else if (t === 'pv') {
      pv = tokens.slice(i + 1)
      break
    }
  }
  if (!score || pv.length === 0) return null
  return { rank, depth, score, pv }
}

export function parseBestMove(line: string): string | null {
  const m = /^bestmove (\S+)/.exec(line)
  if (!m || m[1] === '(none)') return null
  return m[1]
}

/** Keeps only the deepest line per MultiPV rank, sorted by rank. */
export function collectLines(lines: Iterable<CandidateLine>): CandidateLine[] {
  const byRank = new Map<number, CandidateLine>()
  for (const l of lines) {
    const prev = byRank.get(l.rank)
    if (!prev || l.depth >= prev.depth) byRank.set(l.rank, l)
  }
  return [...byRank.values()].sort((a, b) => a.rank - b.rank)
}
