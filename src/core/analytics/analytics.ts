/**
 * Product analytics port. Events carry no personal data: no names, no free text, no FEN/PGN.
 * Retention (D1/D7/D30) is derived server-side from `app_opened` per anonymous distinct id.
 */
export type AnalyticsEvent =
  | { name: 'app_opened' }
  | { name: 'game_started'; botId: string; nodeId: string }
  | { name: 'game_finished'; botId: string; nodeId: string; result: 'win' | 'draw' | 'loss'; plies: number }
  | { name: 'level_completed'; nodeId: string; stars: number }
  | { name: 'puzzle_solved'; source: 'lichess' | 'revenge'; firstTry: boolean }
  | { name: 'language_changed'; locale: string }

export interface AnalyticsPort {
  track(event: AnalyticsEvent): void
  /** Must be honoured before anything is sent (KVKK/GDPR). */
  setConsent(granted: boolean): void
}

export const noopAnalytics: AnalyticsPort = {
  track: () => {},
  setConsent: () => {},
}
