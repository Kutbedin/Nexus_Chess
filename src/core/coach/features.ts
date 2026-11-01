import { Chess } from 'chess.js'
import type { Color, PieceSymbol, PlayedMove, Square } from '../game/types'
import { PIECE_VALUE, balance, findHangingPieces, findMateInOne, opposite } from '../tactics/tactics'

export type Feature =
  | { type: 'hangingPiece'; ply: number; square: Square; piece: PieceSymbol }
  | { type: 'materialLoss'; ply: number; pawns: number }
  | { type: 'forkSuffered'; ply: number; square: Square; piece: PieceSymbol; targets: Square[] }
  | { type: 'mateThreatAllowed'; ply: number; mateSan: string }

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
