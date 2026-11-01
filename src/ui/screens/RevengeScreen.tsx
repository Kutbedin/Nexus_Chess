import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getBot } from '../../core/bots/roster'
import { dueRevenge, type RevengeEntry } from '../../core/revenge/revenge'
import { PuzzleSolver } from '../components/PuzzleSolver'
import { useLocalizedSan } from '../i18nHelpers'

interface Props {
  entries: readonly RevengeEntry[]
  now: number
  onAttempt: (id: string, solved: boolean) => void
  onExit: () => void
}

export function RevengeScreen({ entries, now, onAttempt, onExit }: Props) {
  const { t } = useTranslation('puzzles')
  const formatSan = useLocalizedSan()
  // Snapshot the queue when the screen opens so solved items don't vanish mid-session.
  const [queue] = useState(() => dueRevenge(entries, now))
  const [index, setIndex] = useState(0)
  const current = queue[index]

  return (
    <section className="puzzle-screen" aria-labelledby="revenge-title">
      <div className="game-toolbar">
        <button type="button" className="link-button" onClick={onExit}>
          {t('backToMap')}
        </button>
        {queue.length > 0 && <span className="you-play">{t('revenge.progress', { n: Math.min(index + 1, queue.length), count: queue.length })}</span>}
      </div>
      <h2 id="revenge-title">{t('revenge.title')}</h2>

      {!current ? (
        <div className="empty-state">
          <p>{entries.length === 0 ? t('revenge.emptyNever') : t('revenge.emptyAllDone')}</p>
          <p className="muted">{t('revenge.explainer')}</p>
        </div>
      ) : (
        <>
          <div className="story-card">
            <span className="bot-avatar" aria-hidden="true">
              {getBot(current.puzzle.botId).avatar}
            </span>
            <p>
              {t(`revenge.story.${current.puzzle.kind}`, {
                bot: getBot(current.puzzle.botId).name,
                moveNumber: current.puzzle.moveNumber,
                san: formatSan(current.puzzle.playedSan),
                count: current.puzzle.mateIn ?? 1,
              })}
            </p>
          </div>
          <PuzzleSolver
            key={current.puzzle.id}
            puzzle={{ id: current.puzzle.id, fen: current.puzzle.fen, moves: [current.puzzle.solutionUci] }}
            onFinished={({ firstTry }) => onAttempt(current.puzzle.id, firstTry)}
            onNext={() => setIndex((i) => i + 1)}
          />
        </>
      )}
    </section>
  )
}
