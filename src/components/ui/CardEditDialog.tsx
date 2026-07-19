import { useCallback, useLayoutEffect, useRef } from 'react'
import { useIsDarkMode } from '../../hooks/useIsDarkMode'
import { useCardStore } from '../../stores/cardStore'
import { useEditorHistoryStore } from '../../stores/editorHistoryStore'
import { useTrashStore } from '../../stores/trashStore'
import { X, Trash2 } from 'lucide-react'
import { clearProseMirrorSuppression } from '../editor/utils/editorHandleRegistry'
import { CARD_COLORS, type CardColor } from '../../types/card'
import { CardEditorEntry } from '../editor/CardEditorEntry'
import { Dialog, DialogContent, DialogTitle } from './shadcn/dialog'

const MORPH_DURATION_MS = 220
const MORPH_EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

interface CardEditDialogProps {
  cardId: string
  sourceRect: DOMRect | null
  onClose: () => void
}

export function CardEditDialog({ cardId, sourceRect, onClose }: CardEditDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null)
  const isDarkMode = useIsDarkMode()
  const card = useCardStore(s => s.cards[cardId])
  const updateCard = useCardStore(s => s.updateCard)
  const softDeleteCard = useCardStore(s => s.softDeleteCard)
  const addItem = useTrashStore(s => s.addItem)

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
  const hasCard = card !== undefined

  const finalDialogStyle = {
    top: centerY,
    left: centerX,
    width: dialogWidth,
    height: dialogHeight,
    borderRadius: 16,
  }

  useLayoutEffect(() => {
    if (!hasCard) return
    const dialog = dialogRef.current
    if (!dialog || typeof dialog.animate !== 'function') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!sourceRect) return

    const animation = dialog.animate(
        [
          {
            opacity: 0.92,
            transform: `translate(${sourceRect.left - centerX}px, ${sourceRect.top - centerY}px) scale(${sourceRect.width / dialogWidth}, ${sourceRect.height / dialogHeight})`,
            borderRadius: '10px',
          },
          {
            opacity: 1,
            transform: 'translate(0, 0) scale(1)',
            borderRadius: '16px',
          },
        ],
        { duration: MORPH_DURATION_MS, easing: MORPH_EASING, fill: 'both' },
      )

    return () => animation.cancel()
  }, [centerX, centerY, dialogHeight, dialogWidth, hasCard, sourceRect])

  if (!card) return null

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleCloseWithSnapshot() }}>
      <DialogContent
        ref={dialogRef}
        size="lg"
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex max-w-none flex-col gap-0 overflow-hidden p-0"
        style={{
          ...finalDialogStyle,
          maxWidth: 'none',
          translate: 'none',
          transform: 'none',
          transformOrigin: 'top left',
          boxShadow: 'var(--shadow-xl)',
          backgroundColor: 'var(--surface-card)',
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          requestAnimationFrame(() => returnFocusRef.current?.focus())
        }}
      >
          <div
            className="flex items-center justify-between px-5 py-3 border-b shrink-0 border-line-default"
          >
            <DialogTitle className="truncate text-sm font-medium text-fg-primary">
              {card.title || '无标题'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <button
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
                className="btn-base btn-danger flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
              >
                <Trash2 size={14} />
                删除
              </button>
              <button
                onClick={handleCloseWithSnapshot}
                className="btn-base p-2 rounded-lg text-fg-secondary"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-5 py-2 border-b border-line-default">
            {(Object.keys(CARD_COLORS) as CardColor[]).map((color) => (
              <button
                key={color}
                onClick={() => handleColorChange(color)}
                className="w-6 h-6 rounded-full border-2 transition-all cursor-pointer"
                style={{
                  backgroundColor: isDarkMode ? CARD_COLORS[color].fillDark : CARD_COLORS[color].fillLight,
                  borderColor: card.color === color ? CARD_COLORS[color].stroke : 'transparent',
                  boxShadow: card.color === color ? `0 0 0 2px ${CARD_COLORS[color].stroke}` : 'none',
                }}
              />
            ))}
          </div>

          <div className="flex-1 overflow-auto p-4">
            <CardEditorEntry
              entryKey={cardId}
              cardId={cardId}
              content={card.content}
              previewHTML={card.previewHTML}
              onChange={handleChange}
              onFocus={handleEditorFocus}
              editable
              theme={isDarkMode ? 'dark' : 'light'}
            />
          </div>
      </DialogContent>
    </Dialog>
  )
}
