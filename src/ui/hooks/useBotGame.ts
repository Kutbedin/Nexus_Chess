import { useEffect, useState, useSyncExternalStore } from 'react'
import { BotGameController, type BotGameOptions } from '../../core/game/botGameController'

/** Creates a controller per `gameKey` and subscribes React to it. */
export function useBotGame(createOptions: () => BotGameOptions, gameKey: string): BotGameController {
  const [current, setCurrent] = useState(() => ({ key: gameKey, controller: new BotGameController(createOptions()) }))
  if (current.key !== gameKey) {
    // Recreate during render so the new game is visible on the same commit.
    setCurrent({ key: gameKey, controller: new BotGameController(createOptions()) })
  }
  const { controller } = current

  useEffect(() => {
    controller.start()
    return () => controller.dispose()
  }, [controller])

  useSyncExternalStore(
    (cb) => controller.subscribe(cb),
    () => controller.getState(),
  )
  return controller
}
