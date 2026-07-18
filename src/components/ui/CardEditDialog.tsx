import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useIsDarkMode } from '../../hooks/useIsDarkMode'
import { useCardStore } from '../../stores/cardStore'
import { useEditorHistoryStore } from '../../stores/editorHistoryStore'
import { useTrashStore } from '../../stores/trashStore'
import { X, Trash2 } from 'lucide-react'
import { clearProseMirrorSuppression } from '../editor/utils/editorHandleRegistry'
import { CARD_COLORS, type CardColor } from '../../types/card'
import { CardEditorEntry } from '../editor/CardEditorEntry'

const MORPH_DURATION_MS = 500
const FADE_DURATION_MS = 250
const MORPH_EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

interface CardEditDialogProps {
  cardId: string
  sourceRect: DOMRect | null
  onClose: () => void
}

export function CardEditDialog({ cardId, sourceRect, onClose }: CardEditDialogProps) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCloseWithSnapshot()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleCloseWithSnapshot])

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
    const backdrop = backdropRef.current
    const dialog = dialogRef.current
    if (!backdrop || !dialog || typeof backdrop.animate !== 'function') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const animations = [
      backdrop.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: FADE_DURATION_MS, easing: 'ease-out', fill: 'both' },
      ),
    ]

    if (sourceRect) {
      animations.push(dialog.animate(
        [
          {
            top: `${sourceRect.top}px`,
            left: `${sourceRect.left}px`,
            width: `${sourceRect.width}px`,
            height: `${sourceRect.height}px`,
            borderRadius: '10px',
          },
          {
            top: `${centerY}px`,
            left: `${centerX}px`,
            width: `${dialogWidth}px`,
            height: `${dialogHeight}px`,
            borderRadius: '16px',
          },
        ],
        { duration: MORPH_DURATION_MS, easing: MORPH_EASING, fill: 'both' },
      ))
    }

    return () => animations.forEach(animation => animation.cancel())
  }, [centerX, centerY, dialogHeight, dialogWidth, hasCard, sourceRect])

  if (!card) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        ref={backdropRef}
        className="fixed inset-0"
        style={{ backgroundColor: 'var(--surface-overlay)', backdropFilter: 'blur(4px)' }}
        onClick={handleCloseWithSnapshot}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className="fixed z-[60] overflow-hidden flex flex-col"
        style={{ ...finalDialogStyle, boxShadow: 'var(--shadow-xl)', backgroundColor: 'var(--surface-card)' }}
      >
          <div
            className="flex items-center justify-between px-5 py-3 border-b shrink-0 border-line-default"
          >
            <span className="text-sm font-medium truncate text-fg-primary">
              {card.title || '无标题'}
            </span>
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
      </div>
    </div>
  )
}
