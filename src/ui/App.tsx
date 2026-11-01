import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appOpenedEvent, type AnalyticsPort } from '../core/analytics/analytics'
import { getBot } from '../core/bots/roster'
import type { EngineProvider } from '../core/engine/provider'
import type { PlayedMove } from '../core/game/types'
import {
  EMPTY_PROGRESS,
  WORLD_1,
  recordGameResult,
  recordPuzzleNodeCompleted,
  type GameResult,
  type LevelNode,
  type PlayerProgress,
} from '../core/progression/levelMap'
import { recordPuzzleSolved, type PackPuzzle } from '../core/puzzles/packs'
import { findRevengePuzzles } from '../core/revenge/analysis'
import { addRevengePuzzles, dueRevenge, recordRevengeAttempt, type RevengeEntry } from '../core/revenge/revenge'
import { EMPTY_PUZZLE_STATS, type PuzzleStats, type StorageAdapter } from '../core/storage/storageAdapter'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { LevelMap } from './components/LevelMap'
import { AboutScreen } from './screens/AboutScreen'
import { GameScreen } from './screens/GameScreen'
import { PuzzlesScreen, type PuzzlesMode } from './screens/PuzzlesScreen'
import { RevengeScreen } from './screens/RevengeScreen'

export interface AppServices {
  engines: EngineProvider
  storage: StorageAdapter
  analytics: AnalyticsPort
  firstOpenAt: number
  now?: () => number
}

type Screen =
  | { name: 'map' }
  | { name: 'game'; node: LevelNode }
  | { name: 'puzzles'; mode: PuzzlesMode }
  | { name: 'revenge' }
  | { name: 'about' }

export function App({ services }: { services: AppServices }) {
  const { t } = useTranslation('common')
  const now = services.now ?? Date.now
  const [screen, setScreen] = useState<Screen>({ name: 'map' })
  const [progress, setProgress] = useState<PlayerProgress>(EMPTY_PROGRESS)
  const [puzzleStats, setPuzzleStats] = useState<PuzzleStats>(EMPTY_PUZZLE_STATS)
  const [revenge, setRevenge] = useState<RevengeEntry[]>([])
  const [analysing, setAnalysing] = useState(0)
  const [newRevenge, setNewRevenge] = useState(0)

  useEffect(() => {
    void services.storage.loadProgress().then(setProgress)
    void services.storage.loadPuzzleStats().then(setPuzzleStats)
    void services.storage.loadRevenge().then(setRevenge)
    services.analytics.track(appOpenedEvent(services.firstOpenAt, Date.now()))
  }, [services])

  const node = screen.name === 'game' ? screen.node : null

  const analyseForRevenge = useCallback(
    (botId: string, moves: readonly PlayedMove[]) => {
      setAnalysing((n) => n + 1)
      const at = now()
      findRevengePuzzles(moves, 'w', services.engines.get('analysis'), { gameId: String(at), botId, now: at })
        .then((puzzles) => {
          if (puzzles.length === 0) return
          setRevenge((prev) => {
            const next = addRevengePuzzles(prev, puzzles)
            void services.storage.saveRevenge(next)
            return next
          })
          setNewRevenge((n) => n + puzzles.length)
          services.analytics.track({ name: 'revenge_created', count: puzzles.length })
        })
        .catch(() => {})
        .finally(() => setAnalysing((n) => n - 1))
    },
    [services, now],
  )

  const handleFinished = useCallback(
    (result: GameResult, moves: readonly PlayedMove[]) => {
      if (!node?.botId) return
      setProgress((prev) => {
        const next = recordGameResult(prev, node.id, result)
        void services.storage.saveProgress(next)
        if (result === 'win' && !prev.nodes[node.id]?.completed) {
          services.analytics.track({ name: 'level_completed', nodeId: node.id, stars: next.nodes[node.id].stars })
        }
        return next
      })
      services.analytics.track({ name: 'game_finished', botId: node.botId, nodeId: node.id, result, plies: moves.length })
      if (moves.length >= 4) analyseForRevenge(node.botId, moves)
    },
    [node, services, analyseForRevenge],
  )

  const handlePuzzleSolved = useCallback(
    (puzzle: PackPuzzle, packId: string, firstTry: boolean) => {
      setPuzzleStats((prev) => {
        const next = recordPuzzleSolved(prev, puzzle.id, packId, firstTry, now())
        void services.storage.savePuzzleStats(next)
        return next
      })
      services.analytics.track({ name: 'puzzle_solved', source: 'pack', firstTry, rating: puzzle.rating })
    },
    [services, now],
  )

  const handleNodeComplete = useCallback(
    (nodeId: string) => {
      setProgress((prev) => {
        if (prev.nodes[nodeId]?.completed) return prev
        const next = recordPuzzleNodeCompleted(prev, nodeId)
        void services.storage.saveProgress(next)
        services.analytics.track({ name: 'level_completed', nodeId, stars: 3 })
        return next
      })
    },
    [services],
  )

  const handleRevengeAttempt = useCallback(
    (id: string, solved: boolean) => {
      setRevenge((prev) => {
        const next = recordRevengeAttempt(prev, id, solved, now())
        void services.storage.saveRevenge(next)
        return next
      })
      services.analytics.track({ name: 'puzzle_solved', source: 'revenge', firstTry: solved })
    },
    [services, now],
  )

  const dueCount = dueRevenge(revenge, now()).length
  const goMap = () => setScreen({ name: 'map' })

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>{t('app.title')}</h1>
          <p className="tagline">{t('app.tagline')}</p>
        </div>
        <LanguageSwitcher
          screen={screen.name}
          onChange={(locale) => services.analytics.track({ name: 'language_changed', locale })}
          onReportOpened={(locale) => services.analytics.track({ name: 'translation_report_opened', locale })}
        />
      </header>
      <nav className="main-nav" aria-label={t('nav.label')}>
        <button type="button" aria-current={screen.name === 'map' ? 'page' : undefined} onClick={goMap}>
          {t('nav.map')}
        </button>
        <button
          type="button"
          aria-current={screen.name === 'puzzles' ? 'page' : undefined}
          onClick={() => setScreen({ name: 'puzzles', mode: { kind: 'browse' } })}
        >
          {t('nav.puzzles')}
        </button>
        <button
          type="button"
          aria-current={screen.name === 'revenge' ? 'page' : undefined}
          onClick={() => {
            setNewRevenge(0)
            setScreen({ name: 'revenge' })
          }}
        >
          {t('nav.revenge')}
          {dueCount > 0 && <span className="nav-badge">{dueCount}</span>}
        </button>
        <button type="button" aria-current={screen.name === 'about' ? 'page' : undefined} onClick={() => setScreen({ name: 'about' })}>
          {t('nav.about')}
        </button>
      </nav>
      {(analysing > 0 || newRevenge > 0) && screen.name !== 'revenge' && (
        <p className="toast" role="status">
          {analysing > 0 ? t('revengeToast.analysing') : t('revengeToast.ready', { count: newRevenge })}
        </p>
      )}
      <main>
        {screen.name === 'map' && (
          <LevelMap
            map={WORLD_1}
            progress={progress}
            onSelect={(n) => {
              if (n.kind === 'puzzles' && n.puzzleTheme) {
                setScreen({ name: 'puzzles', mode: { kind: 'node', nodeId: n.id, theme: n.puzzleTheme, count: n.puzzleCount ?? 3 } })
                return
              }
              if (!n.botId) return
              services.analytics.track({ name: 'game_started', botId: n.botId, nodeId: n.id })
              setScreen({ name: 'game', node: n })
            }}
          />
        )}
        {screen.name === 'game' && screen.node.botId && (
          <GameScreen bot={getBot(screen.node.botId)} engine={services.engines.get('play')} onFinished={handleFinished} onExit={goMap} />
        )}
        {screen.name === 'puzzles' && (
          <PuzzlesScreen
            mode={screen.mode}
            stats={puzzleStats}
            onSolved={handlePuzzleSolved}
            onNodeComplete={handleNodeComplete}
            onExit={goMap}
          />
        )}
        {screen.name === 'revenge' && <RevengeScreen entries={revenge} now={now()} onAttempt={handleRevengeAttempt} onExit={goMap} />}
        {screen.name === 'about' && <AboutScreen engine={services.engines.info} onExit={goMap} />}
      </main>
    </div>
  )
}
