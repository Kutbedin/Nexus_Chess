import { noopAnalytics, type AnalyticsEvent, type AnalyticsPort } from '../core/analytics/analytics'

export interface AnalyticsConfig {
  key: string | undefined
  host?: string
  /** School/student mode: analytics fully off; PostHog is never downloaded. */
  schoolMode: boolean
}

/**
 * PostHog (EU), cookieless and anonymous by default: no cookies or localStorage ids,
 * no person profiles, no autocapture, no session recording. Loaded lazily, and only
 * when a key is configured and school mode is off.
 */
export async function createAnalytics(config: AnalyticsConfig): Promise<AnalyticsPort> {
  if (config.schoolMode || !config.key) return noopAnalytics
  const { default: posthog } = await import('posthog-js')
  posthog.init(config.key, {
    api_host: config.host ?? 'https://eu.i.posthog.com',
    cookieless_mode: 'always',
    persistence: 'memory',
    person_profiles: 'never',
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    disable_surveys: true,
    ip: false,
  })
  return {
    track: (event: AnalyticsEvent) => {
      const { name, ...props } = event
      posthog.capture(name, props)
    },
  }
}
