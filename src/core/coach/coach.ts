import type { Color, PlayedMove } from '../game/types'
import { extractFeatures, type Feature } from './features'

/**
 * A locale-agnostic coach message: an i18n key in the `coach` namespace plus raw params.
 * The UI resolves piece names and SAN into the active language; templates differ per locale.
 */
export interface CoachMessage {
  key: string
  params: Record<string, string | number>
  /** Raw piece symbols the UI must localize before interpolation, by param name. */
  pieceParams?: Record<string, string>
  /** SAN strings the UI must localize before interpolation, by param name. */
  sanParams?: Record<string, string>
  ply: number
}

const PRIORITY: Record<Feature['type'], number> = {
  mateThreatAllowed: 0,
  forkSuffered: 1,
  hangingPiece: 2,
  materialLoss: 3,
}

const moveNumber = (ply: number) => Math.floor(ply / 2) + 1

function toMessage(f: Feature, moves: readonly PlayedMove[]): CoachMessage {
  const san = moves[f.ply]?.san ?? ''
  const base = { ply: f.ply, params: { moveNumber: moveNumber(f.ply) } as Record<string, string | number> }
  switch (f.type) {
    case 'hangingPiece':
      return { ...base, key: 'hangingPiece', params: { ...base.params, square: f.square }, pieceParams: { piece: f.piece }, sanParams: { san } }
    case 'materialLoss':
      return { ...base, key: 'materialLoss', params: { ...base.params, count: f.pawns }, sanParams: { san } }
    case 'forkSuffered':
      return {
        ...base,
        key: 'forkSuffered',
        params: { ...base.params, square: f.square, targets: f.targets.join(', ') },
        pieceParams: { piece: f.piece },
        sanParams: { san },
      }
    case 'mateThreatAllowed':
      return { ...base, key: 'mateThreatAllowed', params: base.params, sanParams: { san, mateSan: f.mateSan } }
  }
}

/** Picks the most instructive moments (one per ply, highest priority first). */
export function buildCoachReport(moves: readonly PlayedMove[], player: Color, maxMessages = 3): CoachMessage[] {
  const features = extractFeatures(moves, player).sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type] || a.ply - b.ply)
  const seenPly = new Set<number>()
  const picked: CoachMessage[] = []
  for (const f of features) {
    // Fork and the preceding material loss describe the same mistake; one bubble is enough.
    const anchor = f.type === 'forkSuffered' ? f.ply - 1 : f.ply
    if (seenPly.has(anchor)) continue
    seenPly.add(anchor)
    picked.push(toMessage(f, moves))
    if (picked.length >= maxMessages) break
  }
  if (picked.length === 0) return [{ key: 'clean', params: {}, ply: -1 }]
  return picked.sort((a, b) => a.ply - b.ply)
}
