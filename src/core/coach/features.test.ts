import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { GameSession } from '../game/gameSession'
import { buildCoachReport } from './coach'
import { extractFeatures, verifyFeatures } from './features'

function play(sans: string[], fen?: string) {
  const s = new GameSession(fen)
  for (const san of sans) s.moveUci(new Chess(s.fen).move(san).lan)
  return s.moves
}

describe('feature extractor', () => {
  it('finds a hanging queen and the material it lost', () => {
    const moves = play(['e4', 'd5', 'Qg4', 'Bxg4'])
    const f = extractFeatures(moves, 'w')
    expect(f).toContainEqual({ type: 'hangingPiece', ply: 2, square: 'g4', piece: 'q' })
    expect(f).toContainEqual({ type: 'materialLoss', ply: 2, pawns: 9 })
  })

  it('finds an allowed mate in one', () => {
    const moves = play(['f3', 'e5', 'g4'])
    expect(extractFeatures(moves, 'w')).toContainEqual({ type: 'mateThreatAllowed', ply: 2, mateSan: 'Qh4#' })
  })

  it('finds a knight fork on king and rook', () => {
    const moves = play(['Rb2', 'Nd3+'], '4k3/8/8/2n5/8/8/7R/4K3 w - - 0 1')
    const fork = extractFeatures(moves, 'w').find((f) => f.type === 'forkSuffered')
    expect(fork).toMatchObject({ ply: 1, square: 'd3', piece: 'n' })
    expect(fork && fork.type === 'forkSuffered' && [...fork.targets].sort()).toEqual(['b2', 'e1'])
  })

  it('verification rejects claims the board does not support', () => {
    const moves = play(['e4', 'd5', 'Qg4', 'Bxg4'])
    const real = { type: 'hangingPiece', ply: 2, square: 'g4', piece: 'q' } as const
    const fake = { type: 'hangingPiece', ply: 0, square: 'a1', piece: 'r' } as const
    expect(verifyFeatures([real, fake], moves, 'w')).toEqual([real])
  })
})

describe('coach report', () => {
  it('reports one message per mistake with locale-agnostic params', () => {
    const report = buildCoachReport(play(['e4', 'd5', 'Qg4', 'Bxg4']), 'w')
    expect(report).toHaveLength(1)
    expect(report[0]).toMatchObject({ key: 'hangingPiece', params: { moveNumber: 2, square: 'g4' }, pieceParams: { piece: 'q' }, sanParams: { san: 'Qg4' } })
  })

  it('praises clean games', () => {
    expect(buildCoachReport(play(['e4', 'e5']), 'w')).toEqual([{ key: 'clean', params: {}, ply: -1 }])
  })
})
