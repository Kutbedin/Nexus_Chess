import { Chess } from 'chess.js'
import type { Color, PieceSymbol, Square } from '../game/types'

export const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

export const opposite = (c: Color): Color => (c === 'w' ? 'b' : 'w')

export function material(chess: Chess, color: Color): number {
  let sum = 0
  for (const row of chess.board()) for (const sq of row) if (sq && sq.color === color) sum += PIECE_VALUE[sq.type]
  return sum
}

/** Material of `color` minus the opponent's, in pawns. */
export function balance(fen: string, color: Color): number {
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
