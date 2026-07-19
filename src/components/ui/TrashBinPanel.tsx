import { useMemo } from 'react'
import { useCardStore } from '../../stores/cardStore'
import { useTrashStore } from '../../stores/trashStore'
import { EmptyState } from './SharedUI'
import { Trash2, RotateCcw, Trash, X } from 'lucide-react'
import { Dialog, DialogClose, DialogContent, DialogTitle } from './shadcn/dialog'

interface TrashBinPanelProps {
  onClose: () => void
}

export function TrashBinPanel({ onClose }: TrashBinPanelProps) {
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
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent size="lg" showCloseButton={false} className="flex max-h-[80vh] flex-col gap-0 overflow-hidden p-0 glass-panel">
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-line-default transition-theme"
        >
          <div className="flex items-center gap-3">
            <Trash2 size={20} className="text-fg-primary" />
            <DialogTitle className="font-semibold text-fg-primary">
              回收站
            </DialogTitle>
            <span
              className="text-sm px-2 py-0.5 rounded-full bg-surface-card text-fg-secondary"
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
            <DialogClose asChild>
              <button aria-label="关闭回收站" className="btn-base interactive-control focus-ring p-2 rounded-lg text-fg-secondary">
                <X size={18} />
              </button>
            </DialogClose>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {deletedCards.length === 0 ? (
            <EmptyState
              icon={<Trash2 size={48} />}
              text="回收站为空"
            />
          ) : (
            <div className="space-y-2">
              {deletedCards.map((card) => (
                <div
                  key={card.id}
                  className="hepta-list-item flex items-center justify-between p-3 rounded-lg bg-surface-card border border-line-default"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-panel"
                    >
                      <Trash2 size={14} className="text-fg-secondary" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-fg-primary">
                        {card.title || '无标题'}
                      </div>
                      <div className="text-xs text-fg-secondary">
                        删除于 {card.deletedAt ? new Date(card.deletedAt).toLocaleString('zh-CN') : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRestore(card.id)}
                      className="btn-base flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-surface-panel text-fg-primary"
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
      </DialogContent>
    </Dialog>
  )
}
