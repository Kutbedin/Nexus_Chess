import { Chess } from 'chess.js'
import type { Color, PieceSymbol, PlayedMove, Square } from '../game/types'

export const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

export type Feature =
  | { type: 'hangingPiece'; ply: number; square: Square; piece: PieceSymbol }
  | { type: 'materialLoss'; ply: number; pawns: number }
  | { type: 'forkSuffered'; ply: number; square: Square; piece: PieceSymbol; targets: Square[] }
  | { type: 'mateThreatAllowed'; ply: number; mateSan: string }

const opposite = (c: Color): Color => (c === 'w' ? 'b' : 'w')

function material(chess: Chess, color: Color): number {
  let sum = 0
  for (const row of chess.board()) for (const sq of row) if (sq && sq.color === color) sum += PIECE_VALUE[sq.type]
  return sum
}

function balance(fen: string, color: Color): number {
  const c = new Chess(fen)
  return material(c, color) - material(c, opposite(color))
}

/** Pieces of `color` that the opponent can win: attacked and undefended, or attacked by a cheaper piece. */
export function findHangingPieces(fen: string, color: Color): Array<{ square: Square; piece: PieceSymbol }> {
  const chess = new Chess(fen)
  const result: Array<{ square: Square; piece: PieceSymbol }> = []
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq || sq.color !== color || sq.type === 'k' || sq.type === 'p') continue
      const attackers = chess.attackers(sq.square, opposite(color))
      if (attackers.length === 0) continue
      const defended = chess.attackers(sq.square, color).length > 0
      const cheapest = Math.min(...attackers.map((a) => PIECE_VALUE[chess.get(a)!.type] || 100))
      if (!defended || cheapest < PIECE_VALUE[sq.type]) result.push({ square: sq.square, piece: sq.type })
    }
  }
  return result.sort((a, b) => PIECE_VALUE[b.piece] - PIECE_VALUE[a.piece])
}

export function findMateInOne(fen: string): string | null {
  const chess = new Chess(fen)
  for (const m of chess.moves({ verbose: true })) {
    chess.move(m)
    const mate = chess.isCheckmate()
    chess.undo()
    if (mate) return m.san
  }
  return null
}

function forkBy(move: PlayedMove): { targets: Square[] } | null {
  const chess = new Chess(move.fenAfter)
  const victim = opposite(move.color)
  const targets: Square[] = []
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq || sq.color !== victim) continue
      if (sq.type !== 'k' && PIECE_VALUE[sq.type] < 3) continue
      if (chess.attackers(sq.square, move.color).includes(move.to)) targets.push(sq.square)
    }
  }
  return targets.length >= 2 ? { targets } : null
}

/**
 * Deterministic, engine-free tactical facts about the player's moves.
 * Every coach sentence (template or future LLM) must be backed by one of these.
 */
export function extractFeatures(moves: readonly PlayedMove[], player: Color): Feature[] {
  const features: Feature[] = []
  moves.forEach((move, ply) => {
    if (move.color !== player) return
    const reply = moves[ply + 1]

    const mateSan = findMateInOne(move.fenAfter)
    if (mateSan) features.push({ type: 'mateThreatAllowed', ply, mateSan })

    const hanging = findHangingPieces(move.fenAfter, player)[0]
    if (hanging) features.push({ type: 'hangingPiece', ply, ...hanging })

    if (reply) {
      const lost = balance(move.fenBefore, player) - balance(reply.fenAfter, player)
      if (lost >= 2) features.push({ type: 'materialLoss', ply, pawns: lost })
      const fork = forkBy(reply)
      if (fork) features.push({ type: 'forkSuffered', ply: ply + 1, square: reply.to, piece: reply.piece, targets: fork.targets })
    }
  })
  return features
}

/** Keeps only claims that the extractor independently confirms on the board. */
export function verifyFeatures(claims: readonly Feature[], moves: readonly PlayedMove[], player: Color): Feature[] {
  const truth = new Set(extractFeatures(moves, player).map((f) => JSON.stringify(f)))
  return claims.filter((c) => truth.has(JSON.stringify(c)))
}
