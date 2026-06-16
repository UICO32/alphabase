import { useCallback, lazy, Suspense, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useIsDarkMode } from '../../hooks/useIsDarkMode'
import { useCardStore } from '../../stores/cardStore'
import { useTrashStore } from '../../stores/trashStore'
import { X, Trash2 } from 'lucide-react'
import { clearProseMirrorSuppression } from '../editor/utils/editorHandleRegistry'
import { CARD_COLORS, type CardColor } from '../../types/card'

const LazyCardBlockNoteEditor = lazy(() =>
  import('../editor/BlockNoteEditor').then(m => ({ default: m.CardBlockNoteEditor }))
)

const MORPH_TRANSITION = {
  duration: 0.5,
  ease: [0.2, 0.8, 0.2, 1] as [number, number, number, number],
}
const FADE_TRANSITION = { duration: 0.25 }

interface CardEditDialogProps {
  cardId: string
  sourceRect: DOMRect | null
  onClose: () => void
}

export function CardEditDialog({ cardId, sourceRect, onClose }: CardEditDialogProps) {
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
    useCardStore.getState().recordCardContentSnapshot(cardId)
  }, [cardId])

  const handleCloseWithSnapshot = useCallback(() => {
    useCardStore.getState().recordCardContentSnapshot(cardId)
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

  if (!card) return null

  const dialogWidth = Math.min(700, window.innerWidth * 0.85)
  const dialogHeight = Math.min(600, window.innerHeight * 0.8)

  const centerX = (window.innerWidth - dialogWidth) / 2
  const centerY = (window.innerHeight - dialogHeight) / 2

  const initialStyle = sourceRect
    ? {
        top: sourceRect.top,
        left: sourceRect.left,
        width: sourceRect.width,
        height: sourceRect.height,
        borderRadius: 10,
      }
    : {
        top: centerY,
        left: centerX,
        width: dialogWidth,
        height: dialogHeight,
        borderRadius: 16,
      }

  const animateStyle = {
    top: centerY,
    left: centerX,
    width: dialogWidth,
    height: dialogHeight,
    borderRadius: 16,
  }

  const exitStyle = sourceRect
    ? {
        top: sourceRect.top,
        left: sourceRect.left,
        width: sourceRect.width,
        height: sourceRect.height,
        borderRadius: 10,
        opacity: 0,
      }
    : { opacity: 0 }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50">
        <motion.div
          className="fixed inset-0"
          style={{ backgroundColor: 'var(--surface-overlay)', backdropFilter: 'blur(4px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={FADE_TRANSITION}
          onClick={handleCloseWithSnapshot}
        />

        <motion.div
          className="fixed z-[60] overflow-hidden flex flex-col"
          initial={initialStyle}
          animate={animateStyle}
          exit={exitStyle}
          transition={MORPH_TRANSITION}
          style={{ boxShadow: 'var(--shadow-xl)', backgroundColor: 'var(--surface-card)' }}
        >
          <div
            className="flex items-center justify-between px-5 py-3 border-b shrink-0 border-border-default"
          >
            <span className="text-sm font-medium truncate text-text-primary">
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
                className="btn-base p-2 rounded-lg text-text-secondary"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-5 py-2 border-b border-border-default">
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
            <Suspense fallback={null}>
              <LazyCardBlockNoteEditor
                content={card.content}
                onChange={handleChange}
                onFocus={handleEditorFocus}
                editable={true}
                theme={isDarkMode ? 'dark' : 'light'}
              />
            </Suspense>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
