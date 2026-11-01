import { useTranslation } from 'react-i18next'
import { getBot } from '../../core/bots/roster'
import { isUnlocked, type LevelNode, type PlayerProgress } from '../../core/progression/levelMap'

interface Props {
  map: readonly LevelNode[]
  progress: PlayerProgress
  onSelect: (node: LevelNode) => void
}

/** Duolingo-style vertical path; nodes zig-zag via CSS using the index. */
export function LevelMap({ map, progress, onSelect }: Props) {
  const { t } = useTranslation(['common', 'bots'])
  return (
    <section className="level-map" aria-labelledby="map-title">
      <h2 id="map-title">{t('map.title')}</h2>
      <ol className="level-path">
        {map.map((node, i) => {
          const unlocked = isUnlocked(map, progress, node.id)
          const state = progress.nodes[node.id]
          const bot = node.botId ? getBot(node.botId) : null
          const label = bot ? t(`bots:${bot.id}.name`) : t('map.puzzles')
          return (
            <li key={node.id} className={`level-node kind-${node.kind}`} style={{ '--offset': i % 2 ? 1 : -1 } as React.CSSProperties}>
              <button
                type="button"
                className="level-button"
                disabled={!unlocked}
                onClick={() => onSelect(node)}
                aria-describedby={`${node.id}-desc`}
              >
                <span className="level-icon" aria-hidden="true">
                  {bot ? bot.avatar : '🧩'}
                </span>
              </button>
              <div className="level-label" id={`${node.id}-desc`}>
                <strong>{label}</strong>
                {node.kind === 'boss' && <span className="badge">{t('map.boss')}</span>}
                <span className="level-status">
                  {!unlocked ? t('map.locked') : state ? t('map.stars', { count: state.stars }) : bot ? t(`bots:${bot.id}.tagline`) : ''}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
