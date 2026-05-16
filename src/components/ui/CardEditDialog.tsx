import { useCallback } from 'react'
import { useLibraryStore } from '../../utils/libraryStore'
import { useCardStore } from '../../utils/cardStore'
import { useTrashStore } from '../../utils/trashStore'
import { getPanelSurface } from '../../theme'
import { CardBlockNoteEditor } from '../editor/BlockNoteEditor'
import { X, Trash2 } from 'lucide-react'
import { CARD_COLORS, type CardColor } from '../../types/card'

interface CardEditDialogProps {
  cardId: string
  onClose: () => void
}

export function CardEditDialog({ cardId, onClose }: CardEditDialogProps) {
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const surface = getPanelSurface(isDarkMode)
  const card = useCardStore(s => s.cards[cardId])
  const updateCard = useCardStore(s => s.updateCard)
  const softDeleteCard = useCardStore(s => s.softDeleteCard)
  const addItem = useTrashStore(s => s.addItem)

  const handleChange = useCallback((content: string) => {
    updateCard(cardId, { content })
  }, [cardId, updateCard])

  const handleColorChange = useCallback((color: CardColor) => {
    updateCard(cardId, { color })
  }, [cardId, updateCard])

  if (!card) return null

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center animate-fadeIn"
      style={{ backgroundColor: 'var(--surface-overlay)' }}
      onClick={onClose}
    >
      <div
        className="modal-content w-[700px] h-[600px] max-h-[85vh] rounded-xl flex flex-col animate-scaleIn"
        style={{
          backgroundColor: surface.panelBg,
          boxShadow: 'var(--shadow-xl)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-3 border-b shrink-0 transition-theme"
          style={{ borderColor: surface.divider }}
        >
          <span className="text-sm font-medium truncate" style={{ color: surface.text }}>
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
                  onClose()
                }
              }}
              className="btn-base btn-danger flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
            >
              <Trash2 size={14} />
              删除
            </button>
            <button
              onClick={onClose}
              className="btn-base p-2 rounded-lg"
              style={{ color: surface.muted }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-5 py-2 border-b" style={{ borderColor: surface.divider }}>
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
          <CardBlockNoteEditor
            content={card.content}
            onChange={handleChange}
            editable={true}
            theme={isDarkMode ? 'dark' : 'light'}
          />
        </div>
      </div>
    </div>
  )
}