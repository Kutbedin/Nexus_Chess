import { useMemo, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { useTranslation } from 'react-i18next'
import { parseUci } from '../../core/game/gameSession'
import type { PromotionPiece, Square } from '../../core/game/types'
import { PuzzleSession } from '../../core/puzzles/puzzleSession'
import { PromotionPicker } from './PromotionPicker'

export interface SolverPuzzle {
  id: string
  fen: string
  moves: readonly string[]
  /** Opponent's move that led to the position, highlighted at the start. */
  setup?: string
}

interface Props {
  puzzle: SolverPuzzle
  /** Called once: solved=true when finished, firstTry=false if any mistake or hint. */
  onFinished: (result: { solved: boolean; firstTry: boolean }) => void
  onNext?: () => void
}

type Feedback = 'idle' | 'wrong' | 'correct' | 'solved' | 'revealed'

const LAST_MOVE = { background: 'var(--highlight-last-move)' }
const SELECTED = { background: 'var(--highlight-selected)' }
const TARGET = { background: 'radial-gradient(circle, var(--highlight-target) 22%, transparent 24%)' }
const HINT = { boxShadow: 'inset 0 0 0 4px var(--accent)' }

/** Remount with `key={puzzle.id}` to start a new puzzle. */
export function PuzzleSolver({ puzzle, onFinished, onNext }: Props) {
  const { t } = useTranslation('puzzles')
  const [session] = useState(() => new PuzzleSession(puzzle.fen, puzzle.moves))
  const [fen, setFen] = useState(session.fen)
  const [selected, setSelected] = useState<Square | null>(null)
  const [feedback, setFeedback] = useState<Feedback>('idle')
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null)
  const [hint, setHint] = useState<Square | null>(null)
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(puzzle.setup ? parseUci(puzzle.setup) : null)
  const [reported, setReported] = useState(false)
  const orientation = session.solver === 'w' ? 'white' : 'black'
  const done = feedback === 'solved' || feedback === 'revealed'

  const finish = (solved: boolean) => {
    if (reported) return
    setReported(true)
    onFinished({ solved, firstTry: solved && session.firstTry })
  }

  const attempt = (from: Square, to: Square, promotion?: PromotionPiece): boolean => {
    if (done) return false
    const r = session.tryMove(from, to, promotion)
    setSelected(null)
    setHint(null)
    switch (r.status) {
      case 'illegal':
        return false
      case 'needs-promotion':
        setPendingPromotion({ from, to })
        return false
      case 'wrong':
        setFeedback('wrong')
        return false
      case 'correct':
      case 'solved':
        setFen(session.fen)
        setLastMove(session.lastMove)
        setFeedback(r.status)
        if (r.status === 'solved') finish(true)
        return true
    }
  }

  const reveal = () => {
    const h = session.hint()
    if (h) setHint(h.from)
  }

  const giveUp = () => {
    setFeedback('revealed')
    const expected = session.expectedMove
    if (expected) {
      const { from, to } = parseUci(expected)
      setHint(from)
      setLastMove({ from, to })
    }
    finish(false)
  }

  const squareStyles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {}
    if (lastMove) {
      s[lastMove.from] = LAST_MOVE
      s[lastMove.to] = LAST_MOVE
    }
    if (selected) {
      s[selected] = SELECTED
      for (const sq of session.legalTargets(selected)) s[sq] = { ...s[sq], ...TARGET }
    }
    if (hint) s[hint] = { ...s[hint], ...HINT }
    return s
  }, [lastMove, selected, hint, session])

  const onSquareClick = (square: Square) => {
    if (done) return
    if (selected && selected !== square && session.legalTargets(selected).includes(square)) {
      attempt(selected, square)
      return
    }
    setSelected(session.ownsPiece(square) ? square : null)
  }

  return (
    <div className="puzzle-solver">
      <p className={`puzzle-feedback is-${feedback}`} aria-live="polite">
        {feedback === 'idle' && t(session.solver === 'w' ? 'solver.whiteToMove' : 'solver.blackToMove')}
        {feedback === 'wrong' && t('solver.wrong')}
        {feedback === 'correct' && t('solver.correct')}
        {feedback === 'solved' && t(session.firstTry ? 'solver.solvedFirstTry' : 'solver.solved')}
        {feedback === 'revealed' && t('solver.revealed')}
      </p>
      <div className="board-wrap">
        <Chessboard
          options={{
            // react-chessboard builds CSS selectors from the id, so keep it selector-safe.
            id: `puzzle-${puzzle.id.replace(/[^\w-]/g, '-')}`,
            position: fen,
            boardOrientation: orientation,
            allowDragging: !done,
            canDragPiece: ({ piece }) => !done && piece.pieceType[0] === session.solver,
            onPieceDrop: ({ sourceSquare, targetSquare }) => (targetSquare ? attempt(sourceSquare as Square, targetSquare as Square) : false),
            onSquareClick: ({ square }) => onSquareClick(square as Square),
            squareStyles,
            animationDurationInMs: 200,
          }}
        />
      </div>
      <div className="game-actions">
        {!done && (
          <>
            <button type="button" className="secondary-button" onClick={reveal}>
              {t('solver.hint')}
            </button>
            <button type="button" className="secondary-button" onClick={giveUp}>
              {t('solver.showSolution')}
            </button>
          </>
        )}
        {done && onNext && (
          <button type="button" className="primary-button" onClick={onNext}>
            {t('solver.next')}
          </button>
        )}
      </div>
      {pendingPromotion && (
        <PromotionPicker
          color={session.solver}
          onPick={(p) => {
            setPendingPromotion(null)
            attempt(pendingPromotion.from, pendingPromotion.to, p)
          }}
          onCancel={() => setPendingPromotion(null)}
        />
      )}
    </div>
  )
}
