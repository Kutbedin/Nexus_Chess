import { useTranslation } from 'react-i18next'
import type { Color, PromotionPiece } from '../../core/game/types'

const GLYPHS: Record<Color, Record<PromotionPiece, string>> = {
  w: { q: '♕', r: '♖', b: '♗', n: '♘' },
  b: { q: '♛', r: '♜', b: '♝', n: '♞' },
}
const ORDER: PromotionPiece[] = ['q', 'r', 'b', 'n']

interface Props {
  color: Color
  onPick: (piece: PromotionPiece) => void
  onCancel: () => void
}

export function PromotionPicker({ color, onPick, onCancel }: Props) {
  const { t } = useTranslation('common')
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="promotion-title">
      <div className="modal">
        <h2 id="promotion-title">{t('game.promotionTitle')}</h2>
        <div className="promotion-options">
          {ORDER.map((p) => (
            <button key={p} type="button" className="promotion-option" onClick={() => onPick(p)} aria-label={t(`pieces.${p}`)}>
              <span aria-hidden="true">{GLYPHS[color][p]}</span>
            </button>
          ))}
        </div>
        <button type="button" className="link-button" onClick={onCancel}>
          {t('game.cancel')}
        </button>
      </div>
    </div>
  )
}
