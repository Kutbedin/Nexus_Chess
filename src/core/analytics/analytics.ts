/**
 * Product analytics port. Events carry no personal data: no names, no free text, no FEN/PGN.
 * Retention (D1/D7/D30) is computed from `app_opened` properties, not from a persistent user id:
 * the client sends how many days ago it was first opened, so no identifier needs to be stored remotely.
 */
export type AnalyticsEvent =
  | { name: 'app_opened'; daysSinceFirstOpen: number; firstOpenWeek: string }
  | { name: 'game_started'; botId: string; nodeId: string }
  | { name: 'game_finished'; botId: string; nodeId: string; result: 'win' | 'draw' | 'loss'; plies: number }
  | { name: 'level_completed'; nodeId: string; stars: number }
  | { name: 'puzzle_solved'; source: 'pack' | 'revenge'; firstTry: boolean; rating?: number }
  | { name: 'revenge_created'; count: number }
  | { name: 'language_changed'; locale: string }
  | { name: 'translation_report_opened'; locale: string }

export interface AnalyticsPort {
  track(event: AnalyticsEvent): void
}

export const noopAnalytics: AnalyticsPort = {
  track: () => {},
}

const DAY_MS = 86_400_000

/** ISO week label (e.g. "2026-W44") used as an anonymous retention cohort. */
export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - yearStart) / DAY_MS + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function appOpenedEvent(firstOpenAt: number, now: number): AnalyticsEvent {
  return {
    name: 'app_opened',
    daysSinceFirstOpen: Math.max(0, Math.floor((now - firstOpenAt) / DAY_MS)),
    firstOpenWeek: isoWeek(new Date(firstOpenAt)),
  }
}
