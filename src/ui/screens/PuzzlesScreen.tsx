import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  isPackUnlocked,
  nextPuzzle,
  solvedCountsByPack,
  type PackInfo,
  type PackManifest,
  type PackPuzzle,
} from '../../core/puzzles/packs'
import type { PuzzleStats } from '../../core/storage/storageAdapter'
import { loadManifest, loadPack } from '../../platform/puzzlePacks'
import { PuzzleSolver } from '../components/PuzzleSolver'

export type PuzzlesMode = { kind: 'browse' } | { kind: 'node'; nodeId: string; theme: string; count: number }

interface Props {
  mode: PuzzlesMode
  stats: PuzzleStats
  onSolved: (puzzle: PackPuzzle, packId: string, firstTry: boolean) => void
  onNodeComplete?: (nodeId: string) => void
  onExit: () => void
}

export function PuzzlesScreen({ mode, stats, onSolved, onNodeComplete, onExit }: Props) {
  const { t } = useTranslation('puzzles')
  const [manifest, setManifest] = useState<PackManifest | null>(null)
  const [error, setError] = useState(false)
  const [pack, setPack] = useState<{ info: PackInfo; puzzles: PackPuzzle[] } | null>(null)

  useEffect(() => {
    loadManifest().then(setManifest, () => setError(true))
  }, [])

  useEffect(() => {
    if (mode.kind !== 'node' || !manifest) return
    const first = manifest.packs[0]
    loadPack(first.file).then((puzzles) => setPack({ info: first, puzzles }), () => setError(true))
  }, [mode.kind, manifest])

  if (error) return <p className="status-line">{t('loadError')}</p>
  if (!manifest) return <div className="spinner" aria-busy="true" />

  if (pack) {
    return (
      <PackRunner
        key={pack.info.id}
        pack={pack.info}
        puzzles={pack.puzzles}
        stats={stats}
        theme={mode.kind === 'node' ? mode.theme : undefined}
        target={mode.kind === 'node' ? mode.count : undefined}
        onSolved={onSolved}
        onTargetReached={() => mode.kind === 'node' && onNodeComplete?.(mode.nodeId)}
        onExit={mode.kind === 'node' ? onExit : () => setPack(null)}
      />
    )
  }

  const solved = solvedCountsByPack(manifest, stats)
  return (
    <section className="puzzles-browse" aria-labelledby="puzzles-title">
      <div className="game-toolbar">
        <h2 id="puzzles-title">{t('title')}</h2>
        <span className="muted">{t('total', { count: manifest.total })}</span>
      </div>
      <p className="muted">{t('intro')}</p>
      <ol className="pack-list">
        {manifest.packs.map((info, i) => {
          const unlocked = isPackUnlocked(i, solved, manifest)
          return (
            <li key={info.id}>
              <button
                type="button"
                className="pack-card"
                disabled={!unlocked}
                onClick={() => loadPack(info.file).then((puzzles) => setPack({ info, puzzles }), () => setError(true))}
              >
                <strong>{t('pack.name', { n: i + 1 })}</strong>
                <span className="muted">{t('pack.rating', { min: info.minRating, max: info.maxRating })}</span>
                <span className="pack-progress">
                  {unlocked ? t('pack.progress', { solved: solved[i], count: info.count }) : t('pack.locked')}
                </span>
                <span className="pack-meter" aria-hidden="true">
                  <span style={{ inlineSize: `${(solved[i] / info.count) * 100}%` }} />
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="attribution">{t('attribution')}</p>
    </section>
  )
}

interface RunnerProps {
  pack: PackInfo
  puzzles: PackPuzzle[]
  stats: PuzzleStats
  theme?: string
  target?: number
  onSolved: Props['onSolved']
  onTargetReached: () => void
  onExit: () => void
}

function PackRunner({ pack, puzzles, stats, theme: fixedTheme, target, onSolved, onTargetReached, onExit }: RunnerProps) {
  const { t } = useTranslation('puzzles')
  const [theme, setTheme] = useState<string | undefined>(fixedTheme)
  const seen = useRef([] as string[])
  const [solvedHere, setSolvedHere] = useState(0)
  const [current, setCurrent] = useState(() => nextPuzzle(puzzles, stats, { theme }))
  const themes = Object.keys(pack.themeCounts)

  const advance = (nextTheme = theme) => {
    if (current) seen.current.push(current.id)
    setCurrent(nextPuzzle(puzzles, stats, { theme: nextTheme, exclude: new Set(seen.current) }))
  }

  const targetDone = target !== undefined && solvedHere >= target

  return (
    <section className="puzzle-screen" aria-labelledby="puzzle-title">
      <div className="game-toolbar">
        <button type="button" className="link-button" onClick={onExit}>
          {t(fixedTheme ? 'backToMap' : 'backToPacks')}
        </button>
        {target !== undefined && <span className="you-play">{t('nodeProgress', { solved: Math.min(solvedHere, target), count: target })}</span>}
      </div>
      <h2 id="puzzle-title" className="puzzle-heading">
        {theme ? t(`themes.${theme}`) : t('pack.name', { n: Number(pack.id) })}
        {current && <span className="rating-chip">{t('ratingChip', { rating: current.rating })}</span>}
      </h2>
      {!fixedTheme && (
        <label className="theme-filter">
          <span>{t('filter.label')}</span>
          <select
            value={theme ?? ''}
            onChange={(e) => {
              const next = e.target.value || undefined
              setTheme(next)
              advance(next)
            }}
          >
            <option value="">{t('filter.all')}</option>
            {themes.map((th) => (
              <option key={th} value={th}>
                {t(`themes.${th}`)}
              </option>
            ))}
          </select>
        </label>
      )}
      {targetDone ? (
        <div className="celebration">
          <p>{t('nodeDone')}</p>
          <button type="button" className="primary-button" onClick={onExit}>
            {t('backToMap')}
          </button>
        </div>
      ) : current ? (
        <PuzzleSolver
          key={current.id}
          puzzle={current}
          onFinished={({ solved, firstTry }) => {
            if (!solved) return
            onSolved(current, pack.id, firstTry)
            const n = solvedHere + 1
            setSolvedHere(n)
            if (target !== undefined && n >= target) onTargetReached()
          }}
          onNext={() => advance()}
        />
      ) : (
        <p className="status-line">{t('packDone')}</p>
      )}
    </section>
  )
}
