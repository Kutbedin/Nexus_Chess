import { Chess } from 'chess.js'

/**
 * Row from the Lichess puzzle database (CC0): https://database.lichess.org/#puzzles
 * CSV columns: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
 */
export interface Puzzle {
  id: string
  /** Position the player solves from (after the opponent's setup move). */
  fen: string
  /** Player's moves and forced replies in UCI, starting with the player's first move. */
  solution: string[]
  rating: number
  themes: string[]
}

/**
 * In the Lichess format, FEN is *before* the opponent's move and Moves[0] is that move.
 * We apply it so the puzzle starts with the player to move.
 */
export function parseLichessCsvRow(row: string): Puzzle {
  const cols = row.split(',')
  if (cols.length < 8) throw new Error('Malformed puzzle row')
  const [id, fen, moves, rating, , , , themes] = cols
  const uci = moves.trim().split(' ')
  const chess = new Chess(fen)
  chess.move(uci[0])
  return { id, fen: chess.fen(), solution: uci.slice(1), rating: Number(rating), themes: themes.split(' ').filter(Boolean) }
}

export type PuzzleAttempt =
  | { status: 'correct'; reply?: string; done: boolean }
  | { status: 'wrong' }

/** Checks the player's move at `step` (player moves are even indices). Any mate-in-one also counts. */
export function checkPuzzleMove(puzzle: Puzzle, fenNow: string, step: number, uci: string): PuzzleAttempt {
  const expected = puzzle.solution[step]
  let ok = uci === expected
  if (!ok && step === puzzle.solution.length - 1) {
    const c = new Chess(fenNow)
    try {
      c.move(uci)
      ok = c.isCheckmate()
    } catch {
      ok = false
    }
  }
  if (!ok) return { status: 'wrong' }
  const reply = puzzle.solution[step + 1]
  return { status: 'correct', reply, done: step + 2 >= puzzle.solution.length }
}
