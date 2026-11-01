const DAY_MS = 24 * 60 * 60 * 1000

/** Leitner boxes. Box index -> days until next review. */
export const INTERVAL_DAYS = [0, 1, 3, 7, 16, 35] as const

export interface ReviewState {
  box: number
  dueAt: number
  lapses: number
}

export function newReviewState(now: number): ReviewState {
  return { box: 0, dueAt: now, lapses: 0 }
}

export function review(state: ReviewState, solved: boolean, now: number): ReviewState {
  const box = solved ? Math.min(state.box + 1, INTERVAL_DAYS.length - 1) : 1
  return { box, dueAt: now + INTERVAL_DAYS[box] * DAY_MS, lapses: state.lapses + (solved ? 0 : 1) }
}

export function isDue(state: ReviewState, now: number): boolean {
  return state.dueAt <= now
}

/** Mastered items leave the queue but stay in history. */
export function isMastered(state: ReviewState): boolean {
  return state.box === INTERVAL_DAYS.length - 1
}
