import { describe, expect, it } from 'vitest'
import { PuzzleSession } from './puzzleSession'

describe('PuzzleSession', () => {
  // Scholar's mate pattern: White to play Qxf7#.
  const MATE_FEN = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4'

  it('accepts the solution and reports solved on the first try', () => {
    const s = new PuzzleSession(MATE_FEN, ['h5f7'])
    expect(s.solver).toBe('w')
    expect(s.tryMove('h5', 'f7')).toEqual({ status: 'solved' })
    expect(s.firstTry).toBe(true)
  })

  it('rejects a wrong move without applying it, and counts the mistake', () => {
    const s = new PuzzleSession(MATE_FEN, ['h5f7'])
    expect(s.tryMove('b1', 'c3')).toEqual({ status: 'wrong', expected: 'h5f7' })
    expect(s.fen).toBe(MATE_FEN)
    expect(s.tryMove('h5', 'f7').status).toBe('solved')
    expect(s.firstTry).toBe(false)
  })

  it('ignores illegal moves', () => {
    const s = new PuzzleSession(MATE_FEN, ['h5f7'])
    expect(s.tryMove('h5', 'h8')).toEqual({ status: 'illegal' })
    expect(s.firstTry).toBe(true)
  })

  it('accepts an alternative checkmate on the final move', () => {
    // Two rooks: both Ra8# and Rb8# mate.
    const s = new PuzzleSession('6k1/5ppp/8/8/8/8/R7/1R4K1 w - - 0 1', ['a2a8'])
    expect(s.tryMove('b1', 'b8')).toEqual({ status: 'solved' })
  })

  it('asks for a promotion piece', () => {
    const s = new PuzzleSession('8/P5k1/8/8/8/8/6K1/8 w - - 0 1', ['a7a8q'])
    expect(s.tryMove('a7', 'a8')).toEqual({ status: 'needs-promotion', from: 'a7', to: 'a8' })
    expect(s.tryMove('a7', 'a8', 'q')).toEqual({ status: 'solved' })
  })

  it('hint reveals the expected move and costs the first-try bonus', () => {
    const s = new PuzzleSession(MATE_FEN, ['h5f7'])
    expect(s.hint()).toEqual({ from: 'h5', to: 'f7' })
    s.tryMove('h5', 'f7')
    expect(s.firstTry).toBe(false)
  })
})
