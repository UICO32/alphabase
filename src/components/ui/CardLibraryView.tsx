import { useState, useMemo } from 'react'
import { useCardStore } from '../../stores/cardStore'
import { usePanelSurface } from '../../hooks/usePanelSurface'
import { useFlomoSyncStore } from '../../utils/flomoSync'
import { SearchInput, EmptyState } from './SharedUI'
import { CardEditDialog } from './CardEditDialog'
import { Layers, RefreshCw } from 'lucide-react'

interface CardLibraryViewProps {
  onOpenSettings?: () => void
}

export function CardLibraryView({ onOpenSettings }: CardLibraryViewProps) {
  const cards = useCardStore(s => s.cards)
  const syncing = useFlomoSyncStore(s => s.syncing)
  const accessToken = useFlomoSyncStore(s => s.accessToken)
  const sync = useFlomoSyncStore(s => s.sync)

  const surface = usePanelSurface()
  const [searchQuery, setSearchQuery] = useState('')
  const [editingCardId, setEditingCardId] = useState<string | null>(null)

  const visibleCards = useMemo(() => {
    const active = Object.values(cards).filter(c => !c.deletedAt)
    if (!searchQuery.trim()) return active
    const query = searchQuery.toLowerCase()
    return active.filter(card =>
      (card.title?.toLowerCase().includes(query) ||
       card.content?.toLowerCase().includes(query))
    )
  }, [cards, searchQuery])

  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    const isAltPressed = e.altKey
    const dragData = { type: 'card', cardId, isNewInstance: isAltPressed }
    e.dataTransfer.setData('application/json', JSON.stringify(dragData))
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleSyncClick = () => {
    if (!accessToken) {
      onOpenSettings?.()
      return
    }
    sync()
  }

  return (
    <div className="w-full h-full overflow-y-auto" style={{ backgroundColor: surface.panelBg }}>
      <div className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex-1">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="搜索卡片..."
            />
          </div>
          <button
            onClick={handleSyncClick}
            disabled={syncing}
            className="btn-base p-2 rounded-lg shrink-0"
            style={{ color: surface.muted }}
            title={accessToken ? '同步 Flomo' : '连接 Flomo'}
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
          </button>
        </div>

        {visibleCards.length === 0 ? (
          <EmptyState
            icon={<Layers size={24} />}
            text={searchQuery ? '未找到匹配的卡片' : '暂无卡片'}
            surface={surface}
          />
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {visibleCards.map((card) => (
              <div
                key={card.id}
                draggable
                onDragStart={(e) => handleDragStart(e, card.id)}
                onClick={() => setEditingCardId(card.id)}
                className="hepta-list-item group relative p-3 rounded-lg cursor-pointer active:cursor-grabbing"
                style={{
                  backgroundColor: surface.surface,
                  border: `1px solid ${surface.divider}`,
                }}
              >
                {card.title && card.title !== '新卡片' ? (
                  <div className="text-sm font-medium mb-1" style={{ color: surface.text }}>
                    {card.title}
                  </div>
                ) : null}
                <div
                  className="text-xs line-clamp-3 card-preview-html"
                  style={{ color: surface.muted }}
                  dangerouslySetInnerHTML={{ __html: card.previewHTML || '无内容' }}
                />
                <div className="mt-2 text-[10px]" style={{ color: surface.muted }}>
                  {new Date(card.createdAt).toLocaleDateString('zh-CN')}
                </div>
              </div>
            ))}
          </div>
        )}

        <div
          className="px-3 py-2 text-[10px] text-center"
          style={{ color: surface.muted }}
        >
          拖拽到画布创建引用 · 按住 Alt 拖拽创建新实例
        </div>
      </div>

      {editingCardId && (
        <CardEditDialog
          cardId={editingCardId}
          onClose={() => setEditingCardId(null)}
        />
      )}
    </div>
  )
}
