import type { Color, GameOutcome, PlayedMove } from '../game/types'
import type { ReactionEvent } from './types'

/** Maps a just-played move to a reaction event. Returns null when the bot stays quiet. */
export function reactionForMove(move: PlayedMove, botColor: Color, givesCheck: boolean): ReactionEvent | null {
  const byBot = move.color === botColor
  if (givesCheck) return byBot ? 'botGivesCheck' : 'playerGivesCheck'
  if (move.captured) return byBot ? 'botCaptures' : 'playerCaptures'
  return null
}

export function reactionForOutcome(outcome: GameOutcome, botColor: Color): ReactionEvent | null {
  switch (outcome.kind) {
    case 'ongoing':
      return null
    case 'draw':
      return 'draw'
    case 'checkmate':
    case 'resigned':
      return outcome.winner === botColor ? 'botWins' : 'botLoses'
  }
}
