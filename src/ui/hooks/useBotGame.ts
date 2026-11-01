import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { BotGameController, type BotGameOptions } from '../../core/game/botGameController'

const noopSubscribe = () => () => {}

/**
 * Owns one controller per `gameKey`. The controller is created inside the effect so that
 * StrictMode's mount → unmount → mount cycle never leaves the UI bound to a disposed instance.
 */
export function useBotGame(createOptions: () => BotGameOptions, gameKey: string): BotGameController | null {
  const factory = useRef(createOptions)
  useLayoutEffect(() => {
    factory.current = createOptions
  })
  const [controller, setController] = useState<BotGameController | null>(null)

  useEffect(() => {
    const c = new BotGameController(factory.current())
    setController(c)
    c.start()
    return () => {
      c.dispose()
      setController((prev) => (prev === c ? null : prev))
    }
  }, [gameKey])

  useSyncExternalStore(
    controller ? (cb) => controller.subscribe(cb) : noopSubscribe,
    () => controller?.getState() ?? null,
  )
  return controller
}
