import { useState, useMemo } from 'react'
import { useLibraryStore } from '../../utils/libraryStore'
import { useCardStore } from '../../utils/cardStore'
import { getPanelSurface } from '../../theme'
import { SearchInput, EmptyState } from './SharedUI'
import { CardEditDialog } from './CardEditDialog'
import { Layers, GripVertical } from 'lucide-react'

export function CardLibraryView() {
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const cards = useCardStore(s => s.cards)

  const surface = getPanelSurface(isDarkMode)
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

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: surface.panelBg }}>
      <div className="p-2">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="搜索卡片..."
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2">
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
                className="list-item group relative p-3 rounded-lg cursor-pointer active:cursor-grabbing"
                style={{
                  backgroundColor: surface.surface,
                  border: `1px solid ${surface.divider}`,
                }}
              >
                <div
                  className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-theme"
                  style={{ color: surface.muted }}
                >
                  <GripVertical size={14} />
                </div>

                <div className="pl-4">
                  {card.title ? (
                    <div className="text-sm font-medium mb-1" style={{ color: surface.text }}>
                      {card.title}
                    </div>
                  ) : null}
                  <div
                    className="text-xs line-clamp-3"
                    style={{ color: surface.muted }}
                    dangerouslySetInnerHTML={{ __html: card.previewHTML || '无内容' }}
                  />
                  <div className="mt-2 text-[10px]" style={{ color: surface.muted }}>
                    {new Date(card.createdAt).toLocaleDateString('zh-CN')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className="px-3 py-2 text-[10px] text-center"
        style={{ color: surface.muted }}
      >
        拖拽到画布创建引用 · 按住 Alt 拖拽创建新实例
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
