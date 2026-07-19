import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useIsDarkMode } from '../../hooks/useIsDarkMode'
import { useCardStore } from '../../stores/cardStore'
import { useEditorHistoryStore } from '../../stores/editorHistoryStore'
import { useTrashStore } from '../../stores/trashStore'
import { X, Trash2 } from 'lucide-react'
import { clearProseMirrorSuppression } from '../editor/utils/editorHandleRegistry'
import { CARD_COLORS, type CardColor } from '../../types/card'
import { CardEditorEntry } from '../editor/CardEditorEntry'
import { editorTrace } from '../editor/editorTrace'
import { Dialog, DialogContent, DialogTitle } from './shadcn/dialog'

type DialogPhase = 'morphing' | 'settling' | 'editing'
const MORPH_FALLBACK_MS = 420
const DIALOG_PHASE_ORDER: Record<DialogPhase, number> = {
  morphing: 0,
  settling: 1,
  editing: 2,
}

interface CardEditDialogProps {
  cardId: string
  sourceRect: DOMRect | null
  onClose: () => void
}

export function CardEditDialog({ cardId, sourceRect, onClose }: CardEditDialogProps) {
  const returnFocusRef = useRef<HTMLElement | null>(typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null)
  const traceLabel = `dialog:${cardId}`
  const isDarkMode = useIsDarkMode()
  const card = useCardStore(s => s.cards[cardId])
  const updateCard = useCardStore(s => s.updateCard)
  const softDeleteCard = useCardStore(s => s.softDeleteCard)
  const addItem = useTrashStore(s => s.addItem)
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [phase, setPhase] = useState<DialogPhase>(() => prefersReducedMotion ? 'editing' : 'morphing')
  const phaseRef = useRef(phase)
  const initialDialogTraceRef = useRef({
    cardPresent: Boolean(card),
    contentLength: card?.content.length ?? 0,
    previewHTMLLength: card?.previewHTML?.length ?? 0,
  })

  const advancePhase = useCallback((nextPhase: DialogPhase, reason: string) => {
    const currentPhase = phaseRef.current
    const accepted = DIALOG_PHASE_ORDER[nextPhase] > DIALOG_PHASE_ORDER[currentPhase]
    editorTrace(traceLabel, 'dialog-phase-transition-requested', {
      from: currentPhase,
      to: nextPhase,
      reason,
      accepted,
    })
    if (!accepted) return
    phaseRef.current = nextPhase
    setPhase(nextPhase)
  }, [traceLabel])

  useEffect(() => {
    editorTrace(traceLabel, 'dialog-mounted', {
      cardId,
      prefersReducedMotion,
      ...initialDialogTraceRef.current,
      sourceRect: sourceRect ? {
        x: sourceRect.x,
        y: sourceRect.y,
        width: sourceRect.width,
        height: sourceRect.height,
      } : null,
    })
    return () => editorTrace(traceLabel, 'dialog-unmounted', { cardId })
  }, [cardId, prefersReducedMotion, sourceRect, traceLabel])

  useEffect(() => {
    if (phase !== 'morphing') return
    const timer = window.setTimeout(() => {
      editorTrace(traceLabel, 'dialog-morph-fallback-fired')
      advancePhase('settling', 'morph-fallback')
    }, MORPH_FALLBACK_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [advancePhase, phase, traceLabel])

  useEffect(() => {
    if (phase !== 'settling') return

    let idleId: number | null = null
    const frameId = window.requestAnimationFrame(() => {
      idleId = window.requestIdleCallback(
        (deadline) => {
          editorTrace(traceLabel, 'dialog-editor-idle-fired', {
            didTimeout: deadline.didTimeout,
            timeRemaining: Number(deadline.timeRemaining().toFixed(2)),
          })
          advancePhase('editing', 'idle-editor-mount')
        },
        { timeout: 240 },
      )
    })

    return () => {
      window.cancelAnimationFrame(frameId)
      if (idleId !== null) window.cancelIdleCallback(idleId)
    }
  }, [advancePhase, phase, traceLabel])

  const handleMorphEnd = useCallback((event: React.AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.animationName !== 'card-edit-dialog-source-morph') return
    editorTrace(traceLabel, 'dialog-morph-animation-ended', {
      animationName: event.animationName,
      elapsedTimeMs: Number((event.elapsedTime * 1000).toFixed(2)),
    })
    advancePhase('settling', 'morph-animation-end')
  }, [advancePhase, traceLabel])

  const handleChange = useCallback((content: string) => {
    clearProseMirrorSuppression(cardId)
    updateCard(cardId, { content })
  }, [cardId, updateCard])

  const handleEditorFocus = useCallback(() => {
    const content = useCardStore.getState().cards[cardId]?.content
    if (content) useEditorHistoryStore.getState().recordSnapshot(cardId, content)
  }, [cardId])

  const handleCloseWithSnapshot = useCallback(() => {
    const content = useCardStore.getState().cards[cardId]?.content
    if (content) useEditorHistoryStore.getState().recordSnapshot(cardId, content)
    onClose()
  }, [cardId, onClose])

  const handleColorChange = useCallback((color: CardColor) => {
    updateCard(cardId, { color })
  }, [cardId, updateCard])

  const dialogWidth = Math.min(700, window.innerWidth * 0.85)
  const dialogHeight = Math.min(600, window.innerHeight * 0.8)

  const centerX = (window.innerWidth - dialogWidth) / 2
  const centerY = (window.innerHeight - dialogHeight) / 2
  const sourceTransform = sourceRect
    ? `translate(${sourceRect.left - centerX}px, ${sourceRect.top - centerY}px) scale(${sourceRect.width / dialogWidth}, ${sourceRect.height / dialogHeight})`
    : 'translate(0, 8px) scale(0.98)'

  const finalDialogStyle: CSSProperties & { '--card-dialog-source-transform': string } = {
    top: centerY,
    left: centerX,
    width: dialogWidth,
    height: dialogHeight,
    borderRadius: 16,
    '--card-dialog-source-transform': sourceTransform,
  }

  if (!card) return null
  const visibleTitle = card.title?.trim()

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleCloseWithSnapshot() }}>
      <DialogContent
        size="lg"
        showCloseButton={false}
        aria-describedby={undefined}
        data-card-dialog-phase={phase}
        className="card-edit-dialog-motion flex max-w-none flex-col gap-0 overflow-hidden p-0"
        onAnimationEnd={handleMorphEnd}
        style={{
          ...finalDialogStyle,
          maxWidth: 'none',
          translate: 'none',
          transform: 'none',
          transformOrigin: 'top left',
          boxShadow: 'var(--shadow-xl)',
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          requestAnimationFrame(() => returnFocusRef.current?.focus())
        }}
      >
          <div className={`card-edit-dialog-toolbar ${visibleTitle ? '' : 'card-edit-dialog-toolbar-no-title'}`}>
            {visibleTitle ? (
              <DialogTitle className="card-edit-dialog-title">{visibleTitle}</DialogTitle>
            ) : (
              <DialogTitle className="sr-only">编辑卡片</DialogTitle>
            )}
            <div className="card-edit-dialog-actions">
              <div className="card-edit-dialog-palette" role="group" aria-label="卡片颜色">
                {(Object.keys(CARD_COLORS) as CardColor[]).map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`切换为 ${color} 色`}
                    aria-pressed={card.color === color}
                    onClick={() => handleColorChange(color)}
                    className="card-edit-dialog-swatch"
                    style={{
                      backgroundColor: isDarkMode ? CARD_COLORS[color].fillDark : CARD_COLORS[color].fillLight,
                      borderColor: CARD_COLORS[color].stroke,
                      color: CARD_COLORS[color].stroke,
                    }}
                  />
                ))}
              </div>
              <span className="card-edit-dialog-toolbar-divider" aria-hidden="true" />
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`确定删除卡片「${card.title || '无标题'}」？`)) {
                    softDeleteCard(cardId)
                    addItem({
                      id: `trash-${cardId}`,
                      cardId,
                      title: card.title || '无标题',
                      content: card.content,
                      color: card.color,
                      createdAt: card.createdAt,
                      enforceInitialHeading: card.enforceInitialHeading,
                      fixedHeight: card.fixedHeight,
                      collapsed: card.collapsed,
                    })
                    handleCloseWithSnapshot()
                  }
                }}
                className="btn-base btn-danger card-edit-dialog-delete"
              >
                <Trash2 size={14} />
                <span className="card-edit-dialog-delete-label">删除</span>
              </button>
              <button
                type="button"
                onClick={handleCloseWithSnapshot}
                className="btn-base card-edit-dialog-close"
                aria-label="关闭"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          <div className="card-edit-dialog-body">
            <CardEditorEntry
              entryKey={cardId}
              cardId={cardId}
              content={card.content}
              previewHTML={card.previewHTML}
              onChange={handleChange}
              onFocus={handleEditorFocus}
              mountEditor={phase === 'editing'}
              revealAfterPaint
              debugTraceLabel={traceLabel}
              editable
              theme={isDarkMode ? 'dark' : 'light'}
            />
          </div>
      </DialogContent>
    </Dialog>
  )
}
