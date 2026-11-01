import { noopAnalytics, type AnalyticsEvent, type AnalyticsPort } from '../core/analytics/analytics'

/**
 * PostHog adapter, loaded lazily and only when VITE_POSTHOG_KEY is set.
 * Privacy defaults: no autocapture, no session recording, memory persistence until consent,
 * IP not stored (configure "Discard client IP data" in the PostHog project as well).
 */
export async function createAnalytics(): Promise<AnalyticsPort> {
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined
  if (!key) return noopAnalytics
  const { default: posthog } = await import('posthog-js')
  posthog.init(key, {
    api_host: (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://eu.i.posthog.com',
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: true,
    persistence: 'memory',
    ip: false,
    opt_out_capturing_by_default: true,
  })
  return {
    track: (event: AnalyticsEvent) => {
      const { name, ...props } = event
      posthog.capture(name, props)
    },
    setConsent: (granted) => {
      if (granted) {
        posthog.set_config({ persistence: 'localStorage' })
        posthog.opt_in_capturing()
      } else {
        posthog.opt_out_capturing()
      }
    },
  }
}
