import { describe, expect, it } from 'vitest'
import { GameSession, parseUci, toUci } from './gameSession'

describe('GameSession board-gesture translation', () => {
  it('asks for a piece instead of auto-queening on promotion', () => {
    const s = new GameSession('4k3/P7/8/8/8/8/8/4K3 w - - 0 1')
    expect(s.tryDrop('a7', 'a8')).toEqual({ status: 'needs-promotion', from: 'a7', to: 'a8' })
    expect(s.fen).toBe('4k3/P7/8/8/8/8/8/4K3 w - - 0 1')
    const move = s.move({ from: 'a7', to: 'a8', promotion: 'n' })
    expect(move.uci).toBe('a7a8n')
    expect(s.pieceAt('a8')).toEqual({ type: 'n', color: 'w' })
  })

  it('treats a king drop two squares as castling', () => {
    const s = new GameSession('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
    const r = s.tryDrop('e1', 'g1')
    expect(r.status).toBe('moved')
    expect(s.pieceAt('f1')).toEqual({ type: 'r', color: 'w' })
    expect(s.pieceAt('h1')).toBeNull()
  })

  it('removes the captured pawn on an en passant drop', () => {
    const s = new GameSession('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1')
    const r = s.tryDrop('e5', 'd6')
    expect(r.status === 'moved' && r.move.captured).toBe('p')
    expect(s.pieceAt('d5')).toBeNull()
  })

  it('rejects illegal drops without changing state', () => {
    const s = new GameSession()
    expect(s.tryDrop('e2', 'e5')).toEqual({ status: 'illegal' })
    expect(s.sanHistory).toEqual([])
  })

  it('round-trips UCI notation used by the engine', () => {
    expect(parseUci('e7e8q')).toEqual({ from: 'e7', to: 'e8', promotion: 'q' })
    expect(toUci({ from: 'e1', to: 'g1' })).toBe('e1g1')
    expect(() => parseUci('e1')).toThrow()
  })

  it('reports resignation and blocks further moves', () => {
    const s = new GameSession()
    s.resign('w')
    expect(s.outcome()).toEqual({ kind: 'resigned', winner: 'b' })
    expect(s.tryDrop('e2', 'e4')).toEqual({ status: 'illegal' })
  })
})
