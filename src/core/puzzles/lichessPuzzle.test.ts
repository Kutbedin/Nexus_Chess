import { describe, expect, it } from 'vitest'
import { checkPuzzleMove, parseLichessCsvRow } from './lichessPuzzle'

// Real row shape from the Lichess CC0 puzzle export.
const ROW =
  '00sHx,q3k1nr/1pp1nQpp/3p4/1P2p3/4P3/B1PP1b2/B5PP/5K2 b k - 0 17,e8d7 a2e6 d7d8 f7f8,1760,80,83,72,mate mateIn2 middlegame short,https://lichess.org/yyznGmXs/black#34,Italian_Game'

describe('Lichess puzzle import', () => {
  it('applies the setup move so the player moves first', () => {
    const p = parseLichessCsvRow(ROW)
    expect(p.id).toBe('00sHx')
    expect(p.fen.split(' ')[1]).toBe('w')
    expect(p.solution).toEqual(['a2e6', 'd7d8', 'f7f8'])
    expect(p.themes).toContain('mateIn2')
  })

  it('walks through the solution', () => {
    const p = parseLichessCsvRow(ROW)
    expect(checkPuzzleMove(p, p.fen, 0, 'a2e6')).toEqual({ status: 'correct', reply: 'd7d8', done: false })
    expect(checkPuzzleMove(p, p.fen, 0, 'f7g7')).toEqual({ status: 'wrong' })
  })
})
