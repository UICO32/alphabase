import { useMemo } from 'react'
import { useLibraryStore } from '../../utils/libraryStore'
import { useCardStore } from '../../utils/cardStore'
import { useTrashStore } from '../../utils/trashStore'
import { getPanelSurface } from '../../theme'
import { EmptyState } from './SharedUI'
import { Trash2, RotateCcw, Trash, X } from 'lucide-react'

interface TrashBinPanelProps {
  onClose: () => void
}

export function TrashBinPanel({ onClose }: TrashBinPanelProps) {
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const surface = getPanelSurface(isDarkMode)
  const cards = useCardStore(s => s.cards)
  const restoreCard = useCardStore(s => s.restoreCard)
  const deleteCard = useCardStore(s => s.deleteCard)
  const removeTrashItem = useTrashStore(s => s.removeItem)

  const deletedCards = useMemo(() =>
    Object.values(cards).filter(c => c.deletedAt),
    [cards]
  )

  const handleRestore = (id: string) => {
    restoreCard(id)
    removeTrashItem(id)
  }

  const handlePermanentDelete = (id: string) => {
    const card = cards[id]
    if (!card) return
    if (window.confirm(`确定永久删除「${card.title || '无标题'}」？此操作不可撤销。`)) {
      removeTrashItem(id)
      deleteCard(id)
    }
  }

  const handleEmptyTrash = () => {
    if (deletedCards.length === 0) return
    if (window.confirm('确定清空回收站？此操作不可撤销。')) {
      deletedCards.forEach(c => {
        removeTrashItem(c.id)
        deleteCard(c.id)
      })
    }
  }

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center animate-fadeIn"
      style={{ backgroundColor: 'var(--surface-overlay)' }}
      onClick={onClose}
    >
      <div
        className="modal-content w-[600px] max-h-[80vh] rounded-xl flex flex-col animate-scaleIn"
        style={{
          backgroundColor: surface.panelBg,
          boxShadow: 'var(--shadow-xl)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-4 border-b transition-theme"
          style={{ borderColor: surface.divider }}
        >
          <div className="flex items-center gap-3">
            <Trash2 size={20} style={{ color: surface.text }} />
            <span className="font-semibold" style={{ color: surface.text }}>
              回收站
            </span>
            <span
              className="text-sm px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: surface.surface,
                color: surface.muted,
              }}
            >
              {deletedCards.length} 项
            </span>
          </div>
          <div className="flex items-center gap-2">
            {deletedCards.length > 0 && (
              <button
                onClick={handleEmptyTrash}
                className="btn-base btn-danger px-3 py-1.5 rounded-lg text-sm"
              >
                清空回收站
              </button>
            )}
            <button
              onClick={onClose}
              className="btn-base p-2 rounded-lg"
              style={{ color: surface.muted }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {deletedCards.length === 0 ? (
            <EmptyState
              icon={<Trash2 size={48} />}
              text="回收站为空"
              surface={surface}
            />
          ) : (
            <div className="space-y-2">
              {deletedCards.map((card) => (
                <div
                  key={card.id}
                  className="list-item flex items-center justify-between p-3 rounded-lg"
                  style={{
                    backgroundColor: surface.surface,
                    border: `1px solid ${surface.divider}`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: surface.panelBg }}
                    >
                      <Trash2 size={14} style={{ color: surface.muted }} />
                    </div>
                    <div>
                      <div className="text-sm font-medium" style={{ color: surface.text }}>
                        {card.title || '无标题'}
                      </div>
                      <div className="text-xs" style={{ color: surface.muted }}>
                        删除于 {card.deletedAt ? new Date(card.deletedAt).toLocaleString('zh-CN') : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRestore(card.id)}
                      className="btn-base flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
                      style={{
                        backgroundColor: surface.panelBg,
                        color: surface.text,
                      }}
                    >
                      <RotateCcw size={14} />
                      恢复
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(card.id)}
                      className="btn-base btn-danger flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
                    >
                      <Trash size={14} />
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
