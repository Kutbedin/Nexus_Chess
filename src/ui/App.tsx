import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AnalyticsPort } from '../core/analytics/analytics'
import { getBot } from '../core/bots/roster'
import type { EnginePort } from '../core/engine/types'
import {
  EMPTY_PROGRESS,
  WORLD_1,
  recordGameResult,
  type GameResult,
  type LevelNode,
  type PlayerProgress,
} from '../core/progression/levelMap'
import type { ProgressRepository } from '../platform/progressStore'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { LevelMap } from './components/LevelMap'
import { GameScreen } from './screens/GameScreen'

export interface AppServices {
  getEngine: () => EnginePort
  progress: ProgressRepository
  analytics: AnalyticsPort
}

type Screen = { name: 'map' } | { name: 'game'; node: LevelNode }

export function App({ services }: { services: AppServices }) {
  const { t } = useTranslation('common')
  const [screen, setScreen] = useState<Screen>({ name: 'map' })
  const [progress, setProgress] = useState<PlayerProgress>(EMPTY_PROGRESS)

  useEffect(() => {
    void services.progress.load().then(setProgress)
    services.analytics.track({ name: 'app_opened' })
  }, [services])

  const node = screen.name === 'game' ? screen.node : null

  const handleFinished = useCallback(
    (result: GameResult, plies: number) => {
      if (!node?.botId) return
      setProgress((prev) => {
        const next = recordGameResult(prev, node.id, result)
        void services.progress.save(next)
        if (result === 'win' && !prev.nodes[node.id]?.completed) {
          services.analytics.track({ name: 'level_completed', nodeId: node.id, stars: next.nodes[node.id].stars })
        }
        return next
      })
      services.analytics.track({ name: 'game_finished', botId: node.botId, nodeId: node.id, result, plies })
    },
    [node, services],
  )

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>{t('app.title')}</h1>
          <p className="tagline">{t('app.tagline')}</p>
        </div>
        <LanguageSwitcher onChange={(locale) => services.analytics.track({ name: 'language_changed', locale })} />
      </header>
      <main>
        {screen.name === 'map' && (
          <LevelMap
            map={WORLD_1}
            progress={progress}
            onSelect={(n) => {
              if (!n.botId) return
              services.analytics.track({ name: 'game_started', botId: n.botId, nodeId: n.id })
              setScreen({ name: 'game', node: n })
            }}
          />
        )}
        {screen.name === 'game' && screen.node.botId && (
          <GameScreen
            bot={getBot(screen.node.botId)}
            engine={services.getEngine()}
            onFinished={handleFinished}
            onExit={() => setScreen({ name: 'map' })}
          />
        )}
      </main>
    </div>
  )
}
