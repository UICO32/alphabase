import DOMPurify from 'dompurify'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useCardStore } from '../../stores/cardStore'
import { useLibraryStore, type SortBy } from '../../stores/libraryStore'
import { useEmbeddingStore } from '../../stores/embeddingStore'
import { usePanelSurface } from '../../hooks/usePanelSurface'
import { useFlomoSyncStore } from '../../sync/flomoSync'
import { SearchInput, EmptyState } from './SharedUI'
import { CardEditDialog } from './CardEditDialog'
import { Layers, RefreshCw, Loader2 } from 'lucide-react'

interface CardLibraryViewProps {
  onOpenSettings?: () => void
}

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'updatedAt', label: '最近修改' },
  { value: 'createdAt', label: '创建时间' },
  { value: 'title', label: '标题' },
  { value: 'related', label: '相关性' },
]

export function CardLibraryView({ onOpenSettings }: CardLibraryViewProps) {
  // 合并相关 selector 减少重渲染次数
  const cards = useCardStore(s => s.cards)
  const syncing = useFlomoSyncStore(s => s.syncing)
  const accessToken = useFlomoSyncStore(s => s.accessToken)
  const sync = useFlomoSyncStore(s => s.sync)

  const sortBy = useLibraryStore(s => s.sortBy)
  const setSortBy = useLibraryStore(s => s.setSortBy)
  const editingCardId = useLibraryStore(s => s.editingCardId)

  const { indexed, searching, searchScores, searchRelated, clearResults } = useEmbeddingStore()

  const surface = usePanelSurface()
  const [searchQuery, setSearchQuery] = useState('')
  const [editingResultId, setEditingResultId] = useState<string | null>(null)
  const [sourceRect, setSourceRect] = useState<DOMRect | null>(null)
  const lastRelatedId = useRef<string | null>(null)

  useEffect(() => {
    if (sortBy === 'related') {
      if (!indexed || !editingCardId) {
        setSortBy('updatedAt')
        return
      }
      if (lastRelatedId.current === editingCardId) return
      lastRelatedId.current = editingCardId
      searchRelated(editingCardId)
    } else {
      lastRelatedId.current = null
      clearResults()
    }
  }, [sortBy, editingCardId, indexed, searchRelated, clearResults, setSortBy])

  const visibleCards = useMemo(() => {
    const active = Object.values(cards).filter(c => !c.deletedAt)
    let filtered = active
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = active.filter(card =>
        (card.title?.toLowerCase().includes(query) ||
         card.content?.toLowerCase().includes(query))
      )
    }

    switch (sortBy) {
      case 'updatedAt':
        return filtered.sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
      case 'createdAt':
        return filtered.sort((a, b) => b.createdAt - a.createdAt)
      case 'title':
        return filtered.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'zh-CN'))
      case 'related':
        return filtered
          .filter(c => searchScores[c.id] !== undefined)
          .sort((a, b) => (searchScores[b.id] ?? 0) - (searchScores[a.id] ?? 0))
      default:
        return filtered
    }
  }, [cards, searchQuery, sortBy, searchScores])

  // memo 化 drag handler，避免每次渲染创建新函数
  const handleDragStart = useCallback((e: React.DragEvent, cardId: string) => {
    const isAltPressed = e.altKey
    const dragData = { type: 'card', cardId, isNewInstance: isAltPressed }
    e.dataTransfer.setData('application/json', JSON.stringify(dragData))
    e.dataTransfer.effectAllowed = 'copy'
  }, [])

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

          {/* Sort dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="btn-base px-2 py-1.5 rounded-lg text-xs cursor-pointer"
            style={{ color: surface.muted, backgroundColor: surface.surface, border: `1px solid ${surface.divider}` }}
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

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

        {/* Related mode info bar */}
        {sortBy === 'related' && editingCardId && (
          <div className="mb-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2" style={{ backgroundColor: surface.surface, color: surface.muted }}>
            {searching ? (
              <><Loader2 size={14} className="animate-spin" /> 搜索相关卡片中...</>
            ) : (
              <>基于「{cards[editingCardId]?.title || '无标题'}」按相关性排序 · {visibleCards.length} 条结果</>
            )}
          </div>
        )}

        {visibleCards.length === 0 ? (
          <EmptyState
            icon={<Layers size={24} />}
            text={sortBy === 'related' && !editingCardId ? '请先选中一张卡片' : (searchQuery ? '未找到匹配的卡片' : '暂无卡片')}
            surface={surface}
          />
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {visibleCards.map((card) => {
              const score = searchScores[card.id]
              return (
                <div
                  key={card.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, card.id)}
                  onClick={(e) => {
                    setSourceRect(e.currentTarget.getBoundingClientRect())
                    setEditingResultId(card.id)
                  }}
                  className="hepta-list-item group relative p-3 rounded-lg cursor-pointer active:cursor-grabbing overflow-hidden flex flex-col"
                  style={{
                    backgroundColor: surface.surface,
                    border: `1px solid ${surface.divider}`,
                    aspectRatio: '4/3',
                  }}
                >
                  {card.title && card.title !== '新卡片' ? (
                    <div className="text-sm font-medium mb-1 truncate" style={{ color: surface.text }}>
                      {card.title}
                    </div>
                  ) : null}
                  <div
                    className="text-xs line-clamp-3 card-preview-html overflow-hidden"
                    style={{ color: surface.muted }}
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(card.previewHTML || '') || '无内容' }}
                  />
                  <div className="mt-auto flex items-center justify-between text-[10px]" style={{ color: surface.muted }}>
                    <span>{new Date(card.createdAt).toLocaleDateString('zh-CN')}</span>
                    {score !== undefined && (
                      <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: surface.panelBg }}>
                        {(score * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div
          className="px-3 py-2 text-[10px] text-center"
          style={{ color: surface.muted }}
        >
          拖拽到画布创建引用 · 按住 Alt 拖拽创建新实例
        </div>
      </div>

      {editingResultId && createPortal(
        <CardEditDialog
          cardId={editingResultId}
          sourceRect={sourceRect}
          onClose={() => {
            setEditingResultId(null)
            setSourceRect(null)
          }}
        />,
        document.body
      )}
    </div>
  )
}