import { useTranslation } from 'react-i18next'
import type { BotPersonality, ReactionEvent } from '../../core/bots/types'

interface Props {
  bot: BotPersonality
  reaction: ReactionEvent | null
  /** Changes whenever a new line should be picked (e.g. move count). */
  variant: number
}

export function SpeechBubble({ bot, reaction, variant }: Props) {
  const { t } = useTranslation('bots')
  const name = bot.name
  const lines = reaction ? t(`${bot.id}.lines.${reaction}`, { returnObjects: true }) : null
  const text = Array.isArray(lines) && lines.length > 0 ? String(lines[variant % lines.length]) : null

  return (
    <div className={`bot-header${bot.isBoss ? ' is-boss' : ''}`}>
      <span className="bot-avatar" aria-hidden="true">
        {bot.avatar}
      </span>
      <div className="bot-meta">
        <strong lang="tr">{name}</strong> <span className="bot-title">{t(`${bot.id}.title`)}</span>
        {text && (
          <p className="speech-bubble" aria-live="polite" aria-label={t('common:a11y.speechBubble', { name })}>
            {text}
          </p>
        )}
      </div>
    </div>
  )
}
