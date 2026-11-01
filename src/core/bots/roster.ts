import type { BotPersonality } from './types'

/**
 * World 1 roster. `name` is a Turkish proper name shown as-is in every locale;
 * titles, taglines, and speech lines are i18n keys under `bots:<id>.*`.
 * Book keys are UCI histories from the initial position.
 */
export const BOTS: readonly BotPersonality[] = [
  {
    id: 'minik',
    name: 'Minik Mert',
    avatar: '🐣',
    displayElo: 400,
    isBoss: false,
    // Depth 1–2 sees one-move captures but not two-move threats (forks, mate in 2):
    // a careful beginner, not a random piece-gifter.
    search: { depth: 2, multiPv: 8 },
    temperatureCp: 90,
    maxLossCp: 250,
    blunderChance: 0.15,
    blunderLossCp: 450,
    style: { aggression: 10, materialism: 40 },
    safety: { avoidHangingHeavyPieces: true, hardMaxLossCp: 500 },
    book: {
      '': [['e2e4', 3], ['d2d4', 1]],
      'e2e4': [['e7e5', 1]],
      'd2d4': [['d7d5', 1]],
    },
  },
  {
    id: 'atli',
    name: 'Atlı Ayşe',
    avatar: '🐴',
    displayElo: 700,
    isBoss: false,
    search: { depth: 6, multiPv: 5 },
    temperatureCp: 60,
    maxLossCp: 150,
    blunderChance: 0.08,
    blunderLossCp: 400,
    style: { aggression: 40, materialism: 10 },
    book: {
      '': [['g1f3', 2], ['e2e4', 1]],
      'e2e4': [['b8c6', 2], ['e7e5', 1]],
      'd2d4': [['g8f6', 1]],
      'e2e4 e7e5': [['g1f3', 1]],
      'e2e4 e7e5 g1f3 b8c6': [['f1c4', 1]],
    },
  },
  {
    id: 'filiz',
    name: 'Fil Filiz',
    avatar: '🦚',
    displayElo: 950,
    isBoss: false,
    search: { depth: 8, multiPv: 4 },
    temperatureCp: 45,
    maxLossCp: 110,
    blunderChance: 0.05,
    blunderLossCp: 300,
    style: { aggression: 15, materialism: 15 },
    // Fianchettoes whenever possible: loves long diagonals.
    book: {
      '': [['g2g3', 2], ['b2b3', 1]],
      'g2g3': [['g7g6', 1]],
      'e2e4': [['g7g6', 2], ['b7b6', 1]],
      'd2d4': [['g7g6', 1]],
      'g2g3 d7d5': [['f1g2', 1]],
      'g2g3 e7e5': [['f1g2', 1]],
      'e2e4 g7g6 d2d4': [['f8g7', 1]],
      'd2d4 g7g6 c2c4': [['f8g7', 1]],
    },
  },
  {
    id: 'sultan',
    name: 'Sultan Kale',
    avatar: '🏰',
    displayElo: 1200,
    isBoss: true,
    search: { depth: 10, multiPv: 4 },
    temperatureCp: 30,
    maxLossCp: 80,
    blunderChance: 0.03,
    blunderLossCp: 200,
    style: { aggression: 20, materialism: 20 },
    book: {
      '': [['d2d4', 1]],
      'e2e4': [['c7c5', 2], ['e7e6', 1]],
      'd2d4': [['d7d5', 1]],
      'd2d4 d7d5': [['c2c4', 1]],
    },
  },
]

export function getBot(id: string): BotPersonality {
  const bot = BOTS.find((b) => b.id === id)
  if (!bot) throw new Error(`Unknown bot: ${id}`)
  return bot
}
