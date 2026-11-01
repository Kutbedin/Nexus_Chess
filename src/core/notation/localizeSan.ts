/** Localized letters for King, Queen, Rook, Bishop, Knight, in that order. Pawns have no letter. */
export interface PieceLetters {
  K: string
  Q: string
  R: string
  B: string
  N: string
}

export const ENGLISH_LETTERS: PieceLetters = { K: 'K', Q: 'Q', R: 'R', B: 'B', N: 'N' }

/**
 * Rewrites standard (English) SAN with localized piece letters, including promotions:
 * "Nxe5+" -> "Axe5+" (tr), "e8=Q#" -> "e8=V#" (tr). Castling and squares are unchanged.
 */
export function localizeSan(san: string, letters: PieceLetters): string {
  if (san.startsWith('O-O')) return san
  return san.replace(/^[KQRBN]|=[QRBN]/g, (m) => (m.startsWith('=') ? `=${letters[m[1] as keyof PieceLetters]}` : letters[m as keyof PieceLetters]))
}
