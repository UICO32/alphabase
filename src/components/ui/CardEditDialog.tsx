import { useCallback } from 'react'
import { useLibraryStore } from '../../utils/libraryStore'
import { useCardStore } from '../../utils/cardStore'
import { getPanelSurface } from '../../theme/panelSurface'
import { CardBlockNoteEditor } from '../editor/BlockNoteEditor'
import { X, Trash2 } from 'lucide-react'

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

  const handleChange = useCallback((content: string) => {
    updateCard(cardId, { content })
  }, [cardId, updateCard])

  if (!card) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-[700px] h-[600px] max-h-[85vh] rounded-xl shadow-2xl flex flex-col"
        style={{ backgroundColor: surface.panelBg }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-3 border-b shrink-0"
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
                  onClose()
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors hover:opacity-80"
              style={{ backgroundColor: '#ef444420', color: '#ef4444' }}
            >
              <Trash2 size={14} />
              删除
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors hover:opacity-70"
              style={{ color: surface.muted }}
            >
              <X size={18} />
            </button>
          </div>
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
