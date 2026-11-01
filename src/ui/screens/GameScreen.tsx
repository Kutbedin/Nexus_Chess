import { useEffect, useMemo, useRef, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { useTranslation } from 'react-i18next'
import type { BotPersonality } from '../../core/bots/types'
import type { EnginePort } from '../../core/engine/types'
import type { GameResult } from '../../core/progression/levelMap'
import type { Color, PlayedMove, Square } from '../../core/game/types'
import type { BotGameController } from '../../core/game/botGameController'
import { seededRng } from '../../core/random'
import { PromotionPicker } from '../components/PromotionPicker'
import { SpeechBubble } from '../components/SpeechBubble'
import { useBotGame } from '../hooks/useBotGame'
import { renderCoachMessage, useLocalizedSan } from '../i18nHelpers'

interface Props {
  bot: BotPersonality
  engine: EnginePort
  playerColor?: Color
  onFinished: (result: GameResult, moves: readonly PlayedMove[]) => void
  onExit: () => void
}

const LAST_MOVE_STYLE = { background: 'var(--highlight-last-move)' }
const SELECTED_STYLE = { background: 'var(--highlight-selected)' }
const TARGET_STYLE = { background: 'radial-gradient(circle, var(--highlight-target) 22%, transparent 24%)' }
const CHECK_STYLE = { background: 'radial-gradient(circle, var(--highlight-check) 40%, transparent 70%)' }

export function GameScreen(props: Props) {
  const { bot, engine, playerColor = 'w' } = props
  const [gameNo, setGameNo] = useState(0)
  const controller = useBotGame(
    () => ({ bot, engine, playerColor, rng: seededRng(Date.now()), minThinkMs: 400 }),
    `${bot.id}-${playerColor}-${gameNo}`,
  )
  if (!controller) return <div className="spinner" aria-busy="true" />
  return <GameView key={gameNo} {...props} playerColor={playerColor} controller={controller} onRestart={() => setGameNo((n) => n + 1)} />
}

interface GameViewProps extends Props {
  playerColor: Color
  controller: BotGameController
  onRestart: () => void
}

function GameView({ bot, playerColor, controller, onFinished, onExit, onRestart }: GameViewProps) {
  const { t } = useTranslation(['common', 'coach', 'bots'])
  const formatSan = useLocalizedSan()
  const [selected, setSelected] = useState<Square | null>(null)
  const state = controller.getState()
  const reported = useRef(false)

  const result: GameResult | null =
    state.outcome.kind === 'ongoing'
      ? null
      : state.outcome.kind === 'draw'
        ? 'draw'
        : state.outcome.winner === playerColor
          ? 'win'
          : 'loss'

  useEffect(() => {
    if (result && !reported.current) {
      reported.current = true
      onFinished(result, state.moves)
    }
  }, [result, onFinished, state.moves])

  const playersTurn = state.turn === playerColor && !state.botThinking && !result

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {}
    if (state.lastMove) {
      styles[state.lastMove.from] = LAST_MOVE_STYLE
      styles[state.lastMove.to] = LAST_MOVE_STYLE
    }
    if (selected) {
      styles[selected] = SELECTED_STYLE
      for (const sq of controller.legalTargets(selected)) styles[sq] = { ...styles[sq], ...TARGET_STYLE }
    }
    if (state.inCheck) {
      const king = controller.kingSquare(state.turn)
      if (king) styles[king] = { ...styles[king], ...CHECK_STYLE }
    }
    return styles
  }, [state, selected, controller])

  const handleSquareClick = (square: Square) => {
    if (!playersTurn) return
    if (selected && selected !== square && controller.legalTargets(selected).includes(square)) {
      controller.playerDrop(selected, square)
      setSelected(null)
      return
    }
    setSelected(controller.ownsPiece(square) ? square : null)
  }


  const botName = bot.name

  return (
    <div className="game-screen">
      <div className="game-toolbar">
        <button type="button" className="link-button" onClick={onExit}>
          {t('game.backToMap')}
        </button>
        <span className="you-play">{t('game.youPlay', { color: t(`game.color.${playerColor}`) })}</span>
      </div>

      <SpeechBubble bot={bot} reaction={state.reaction} variant={state.moves.length} />

      <div className="board-wrap">
        <Chessboard
          options={{
            id: 'main-board',
            position: state.fen,
            boardOrientation: playerColor === 'w' ? 'white' : 'black',
            allowDragging: playersTurn,
            canDragPiece: ({ piece }) => playersTurn && piece.pieceType[0] === playerColor,
            onPieceDrop: ({ sourceSquare, targetSquare }) => {
              setSelected(null)
              if (!targetSquare) return false
              return controller.playerDrop(sourceSquare as Square, targetSquare as Square)
            },
            onSquareClick: ({ square }) => handleSquareClick(square as Square),
            squareStyles,
            animationDurationInMs: 200,
          }}
        />
      </div>

      <p className="status-line" aria-live="polite">
        {result
          ? `${t(`game.result.${result}`)} · ${t(`game.reason.${state.outcome.kind === 'draw' ? state.outcome.reason : state.outcome.kind}`)}`
          : state.botThinking
            ? t('game.botThinking', { name: botName })
            : state.inCheck && playersTurn
              ? t('game.check')
              : playersTurn
                ? t('game.yourTurn')
                : ''}
      </p>

      <div className="game-actions">
        {result ? (
          <button type="button" className="primary-button" onClick={onRestart}>
            {t('game.playAgain')}
          </button>
        ) : (
          <button type="button" className="secondary-button" onClick={() => controller.resign()} disabled={state.moves.length === 0}>
            {t('game.resign')}
          </button>
        )}
      </div>

      {state.coach && (
        <section className="coach-panel" aria-labelledby="coach-title">
          <h2 id="coach-title">{t('coach:title')}</h2>
          <ul>
            {state.coach.map((msg, i) => (
              <li key={i}>{renderCoachMessage(t, msg, formatSan)}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="move-list" aria-labelledby="moves-title">
        <h2 id="moves-title">{t('game.moves')}</h2>
        <ol>
          {pairMoves(state.moves.map((m) => formatSan(m.san))).map(([w, b], i) => (
            <li key={i}>
              <span>{w}</span>
              {b && <span>{b}</span>}
            </li>
          ))}
        </ol>
      </section>

      {state.pendingPromotion && (
        <PromotionPicker color={playerColor} onPick={(p) => controller.choosePromotion(p)} onCancel={() => controller.cancelPromotion()} />
      )}
    </div>
  )
}

function pairMoves(sans: string[]): Array<[string, string | undefined]> {
  const pairs: Array<[string, string | undefined]> = []
  for (let i = 0; i < sans.length; i += 2) pairs.push([sans[i], sans[i + 1]])
  return pairs
}
