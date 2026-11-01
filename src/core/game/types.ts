import type { Color, PieceSymbol, Square } from 'chess.js'

export type { Color, PieceSymbol, Square }

export type PromotionPiece = 'q' | 'r' | 'b' | 'n'

export interface MoveRequest {
  from: Square
  to: Square
  promotion?: PromotionPiece
}

export interface PlayedMove {
  from: Square
  to: Square
  san: string
  uci: string
  color: Color
  piece: PieceSymbol
  captured?: PieceSymbol
  promotion?: PieceSymbol
  fenBefore: string
  fenAfter: string
}

export type GameOutcome =
  | { kind: 'ongoing' }
  | { kind: 'checkmate'; winner: Color }
  | { kind: 'resigned'; winner: Color }
  | { kind: 'draw'; reason: DrawReason }

export type DrawReason = 'stalemate' | 'insufficient-material' | 'threefold-repetition' | 'fifty-move' | 'agreement'

export type DropResult =
  | { status: 'moved'; move: PlayedMove }
  | { status: 'needs-promotion'; from: Square; to: Square }
  | { status: 'illegal' }
