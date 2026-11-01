export type LevelNodeKind = 'bot' | 'boss' | 'puzzles'

export interface LevelNode {
  id: string
  kind: LevelNodeKind
  /** For bot/boss nodes. */
  botId?: string
  /** For puzzle nodes: theme filter and how many must be solved. */
  puzzleTheme?: string
  puzzleCount?: number
  /** All listed nodes must be completed to unlock this one. Empty = unlocked from the start. */
  requires: readonly string[]
}

export type GameResult = 'win' | 'draw' | 'loss'

export interface NodeProgress {
  completed: boolean
  stars: 0 | 1 | 2 | 3
  attempts: number
}

export interface PlayerProgress {
  version: 1
  nodes: Readonly<Record<string, NodeProgress>>
}

export const EMPTY_PROGRESS: PlayerProgress = { version: 1, nodes: {} }

/** World 1 of the vertical map: three regular bots with puzzle stops between them, then the boss. */
export const WORLD_1: readonly LevelNode[] = [
  { id: 'w1-1', kind: 'bot', botId: 'minik', requires: [] },
  { id: 'w1-2', kind: 'puzzles', puzzleTheme: 'mateIn1', puzzleCount: 3, requires: ['w1-1'] },
  { id: 'w1-3', kind: 'bot', botId: 'atli', requires: ['w1-2'] },
  { id: 'w1-4', kind: 'puzzles', puzzleTheme: 'fork', puzzleCount: 3, requires: ['w1-3'] },
  { id: 'w1-5', kind: 'bot', botId: 'filiz', requires: ['w1-4'] },
  { id: 'w1-6', kind: 'puzzles', puzzleTheme: 'backRankMate', puzzleCount: 3, requires: ['w1-5'] },
  { id: 'w1-boss', kind: 'boss', botId: 'sultan', requires: ['w1-6'] },
]

export function isUnlocked(map: readonly LevelNode[], progress: PlayerProgress, nodeId: string): boolean {
  const node = map.find((n) => n.id === nodeId)
  if (!node) return false
  return node.requires.every((id) => progress.nodes[id]?.completed === true)
}

const STARS: Record<GameResult, 0 | 1 | 3> = { win: 3, draw: 1, loss: 0 }

/** Pure reducer: a win completes the node; stars only ever go up. */
export function recordGameResult(progress: PlayerProgress, nodeId: string, result: GameResult): PlayerProgress {
  const prev = progress.nodes[nodeId] ?? { completed: false, stars: 0, attempts: 0 }
  const stars = Math.max(prev.stars, STARS[result]) as NodeProgress['stars']
  return {
    ...progress,
    nodes: {
      ...progress.nodes,
      [nodeId]: { completed: prev.completed || result === 'win', stars, attempts: prev.attempts + 1 },
    },
  }
}

export function recordPuzzleNodeCompleted(progress: PlayerProgress, nodeId: string): PlayerProgress {
  const prev = progress.nodes[nodeId] ?? { completed: false, stars: 0, attempts: 0 }
  return {
    ...progress,
    nodes: { ...progress.nodes, [nodeId]: { completed: true, stars: 3, attempts: prev.attempts + 1 } },
  }
}
