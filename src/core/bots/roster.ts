import type { BotPersonality } from './types'

/**
 * Starter roster. Names, taglines, and speech lines are i18n keys under `bots:<id>.*`.
 * Book keys are UCI histories from the initial position.
 */
export const BOTS: readonly BotPersonality[] = [
  {
    id: 'minik',
    avatar: '🐣',
    displayElo: 400,
    isBoss: false,
    search: { depth: 6, multiPv: 6 },
    temperatureCp: 120,
    maxLossCp: 250,
    blunderChance: 0.2,
    blunderLossCp: 700,
    style: { aggression: 10, materialism: 40 },
    book: {
      '': [['e2e4', 3], ['d2d4', 1]],
      'e2e4': [['e7e5', 1]],
      'd2d4': [['d7d5', 1]],
    },
  },
  {
    id: 'atli',
    avatar: '🐴',
    displayElo: 800,
    isBoss: false,
    search: { depth: 8, multiPv: 5 },
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
    id: 'sultan',
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
