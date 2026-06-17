import DOMPurify from 'dompurify'
import { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react'
import { createPortal } from 'react-dom'
import { useFloating, useClick, useDismiss, useInteractions, offset, flip } from '@floating-ui/react'
import { useCardStore } from '../../stores/cardStore'
import { useLibraryStore, type SortBy, type SearchMode } from '../../stores/libraryStore'
import { useViewStore } from '../../stores/viewStore'
import { useEmbeddingStore } from '../../stores/embeddingStore'
import { useFlomoSyncStore } from '../../sync/flomoSync'
import { EmptyState } from './SharedUI'
import { CardEditDialog } from './CardEditDialog'
import { Layers, RefreshCw, Loader2, ChevronDown } from 'lucide-react'

interface CardLibraryViewProps {
  onOpenSettings?: () => void
}

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'updatedAt', label: '最近修改' },
  { value: 'createdAt', label: '创建时间' },
  { value: 'title', label: '标题' },
  { value: 'related', label: '相关性' },
]

function extractImages(html: string): string[] {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const imgs = doc.querySelectorAll('img')
    return Array.from(imgs).map((img) => img.src).filter(Boolean)
  } catch {
    return []
  }
}

function stripImages(html: string): string {
  return html.replace(/<img[^>]*>/gi, '')
}

function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return ''
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}个月前`
  return `${Math.floor(months / 12)}年前`
}

const IMAGE_ROTATIONS = [0, -6, 6]

const CardItem = memo(function CardItem({
  card,
  score,
  onDragStart,
  onClick,
}: {
  card: { id: string; title?: string; previewHTML?: string; updatedAt?: number; createdAt: number }
  score: number | undefined
  onDragStart: (e: React.DragEvent, cardId: string) => void
  onClick: (e: React.MouseEvent) => void
}) {
  const previewHTML = card.previewHTML || ''
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set())
  const images = useMemo(() => extractImages(previewHTML), [previewHTML])
  const textHTML = useMemo(() => stripImages(DOMPurify.sanitize(previewHTML, { ALLOWED_URI_REGEXP: /^(?:(?:hepta-media|https?|mailto|tel|data):|[^a-zA-Z]|[^a-zA-Z]javascript:)/i })), [previewHTML])
  const relativeTime = formatRelativeTime(card.updatedAt ?? card.createdAt)
  const visibleImages = images.slice(0, 3).filter((_, i) => !failedImages.has(i))

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, card.id)}
      onClick={onClick}
      className="hepta-list-item group relative p-2.5 rounded-lg cursor-pointer active:cursor-grabbing overflow-hidden flex flex-col bg-surface-card border border-border-default"
      style={{ aspectRatio: '1/1' }}
    >
      {/* Title row — truncate with ellipsis, time right */}
      <div className="flex items-baseline justify-between gap-2 mb-0.5">
        {card.title && card.title !== '新卡片' ? (
          <span className="text-sm font-medium text-text-primary leading-snug truncate">{card.title}</span>
        ) : (
          <span className="text-sm font-medium text-text-tertiary leading-snug truncate">无标题</span>
        )}
        {relativeTime && (
          <span className="text-[10px] shrink-0 text-text-tertiary">{relativeTime}</span>
        )}
      </div>

      {/* Text body — fade via mask, self-adaptive */}
      <div
        className="min-h-0 flex-1 overflow-hidden card-library-preview text-xs leading-relaxed text-text-secondary"
        style={{
          WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)',
        }}
        dangerouslySetInnerHTML={{ __html: textHTML || '无内容' }}
      />

      {/* Images — horizontal row, spread across width */}
      {visibleImages.length > 0 && (
        <div className="flex shrink-0 mt-2">
          {visibleImages.map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              width={200}
              height={200}
              loading="lazy"
              className="rounded"
              onLoad={() => {}}
              onError={() => setFailedImages(prev => new Set(prev).add(i))}
              style={{
                width: 0,
                flex: '1 1 0%',
                aspectRatio: '1/1',
                objectFit: 'cover',
                transform: `rotate(${IMAGE_ROTATIONS[i % 3]}deg)`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                marginLeft: i === 0 ? 0 : -5,
                zIndex: 3 - i,
                backfaceVisibility: 'hidden',
              }}
            />
          ))}
        </div>
      )}

      {/* Score badge */}
      {score !== undefined && (
        <div className="absolute top-2 right-2">
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface-panel">
            {(score * 100).toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  )
})

export function CardLibraryView({ onOpenSettings }: CardLibraryViewProps) {
  const cards = useCardStore(s => s.cards)
  const syncing = useFlomoSyncStore(s => s.syncing)
  const accessToken = useFlomoSyncStore(s => s.accessToken)
  const sync = useFlomoSyncStore(s => s.sync)

  const sortBy = useLibraryStore(s => s.sortBy)
  const setSortBy = useLibraryStore(s => s.setSortBy)
  const editingCardId = useViewStore(s => s.editingCardId)
  const searchMode = useLibraryStore(s => s.searchMode)
  const setSearchMode = useLibraryStore(s => s.setSearchMode)

  const { indexed, searching, searchScores, searchRelated, searchByText, clearResults } = useEmbeddingStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [editingResultId, setEditingResultId] = useState<string | null>(null)
  const [sourceRect, setSourceRect] = useState<DOMRect | null>(null)
  const [modeMenuOpen, setModeMenuOpen] = useState(false)
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const lastRelatedId = useRef<string | null>(null)
  const pendingRelatedSort = useRef(false)

  const searchModeLabels: Record<SearchMode, string> = {
    hybrid: '混合',
    keyword: '关键词',
    semantic: '语义',
  }

  const sortLabels: Record<SortBy, string> = {
    updatedAt: '最近修改',
    createdAt: '创建时间',
    title: '标题',
    related: '相关性',
  }

  const modeFloating = useFloating({
    open: modeMenuOpen,
    onOpenChange: setModeMenuOpen,
    placement: 'bottom-start',
    middleware: [offset(4), flip()],
  })
  const modeClick = useClick(modeFloating.context)
  const modeDismiss = useDismiss(modeFloating.context)
  const modeInteractions = useInteractions([modeClick, modeDismiss])

  const sortFloating = useFloating({
    open: sortMenuOpen,
    onOpenChange: setSortMenuOpen,
    placement: 'bottom-start',
    middleware: [offset(4), flip()],
  })
  const sortClick = useClick(sortFloating.context)
  const sortDismiss = useDismiss(sortFloating.context)
  const sortInteractions = useInteractions([sortClick, sortDismiss])

  useEffect(() => {
    if (sortBy === 'related') {
      if (!indexed || !editingCardId) {
        if (!indexed) pendingRelatedSort.current = true
        setSortBy('updatedAt')
        return
      }
      pendingRelatedSort.current = false
      if (lastRelatedId.current === editingCardId) return
      lastRelatedId.current = editingCardId
      searchRelated(editingCardId)
    } else {
      lastRelatedId.current = null
      clearResults()
    }
  }, [sortBy, editingCardId, indexed, searchRelated, clearResults, setSortBy])

  useEffect(() => {
    if (indexed && pendingRelatedSort.current && editingCardId) {
      pendingRelatedSort.current = false
      setSortBy('related')
    }
  }, [indexed, editingCardId, setSortBy])

  useEffect(() => {
    if (searchMode === 'keyword') {
      clearResults()
    }
  }, [searchMode, clearResults])

  const handleSearchSubmit = useCallback(() => {
    const trimmed = searchQuery.trim()
    if (!trimmed) {
      clearResults()
      return
    }
    if (searchMode === 'semantic' || searchMode === 'hybrid') {
      if (!indexed) return
      searchByText(trimmed)
    }
  }, [searchQuery, searchMode, indexed, searchByText, clearResults])

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

    if ((searchMode === 'semantic' || searchMode === 'hybrid') && searchQuery.trim()) {
      const scored = filtered
        .filter(c => searchScores[c.id] !== undefined)
        .sort((a, b) => (searchScores[b.id] ?? 0) - (searchScores[a.id] ?? 0))
      if (scored.length > 0) return scored
      return filtered
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
  }, [cards, searchQuery, sortBy, searchScores, searchMode])

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

  const handleClick = useCallback((e: React.MouseEvent, cardId: string) => {
    setSourceRect(e.currentTarget.getBoundingClientRect())
    setEditingResultId(cardId)
  }, [])

  return (
    <div className="w-full h-full overflow-y-auto">
      <style>{`
        .card-library-preview h1,
        .card-library-preview h2,
        .card-library-preview h3 {
          font-size: 1em !important;
          font-weight: 600 !important;
          margin: 0 !important;
          line-height: 1.4 !important;
        }
      `}</style>
      <div className="p-4">
        {/* Search bar with mode switch */}
        <div
          className="mb-3 flex items-center gap-0 rounded-lg bg-surface-card border border-border-default px-2"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && searchMode !== 'keyword') {
              handleSearchSubmit()
            }
          }}
        >
          <div className="relative shrink-0">
            <button
              ref={modeFloating.refs.setReference}
              {...modeInteractions.getReferenceProps()}
              className="flex items-center gap-0.5 px-1.5 py-1 rounded text-[11px] font-medium text-text-secondary hover:bg-surface-panel"
              title="切换搜索模式"
            >
              {searchModeLabels[searchMode]}
              <ChevronDown size={10} className="text-text-secondary" />
            </button>
            {modeMenuOpen && (
              <div
                ref={modeFloating.refs.setFloating}
                {...modeInteractions.getFloatingProps()}
                className="py-1.5 rounded-lg min-w-[80px] glass-panel border border-border-default z-50"
                style={{
                  ...modeFloating.floatingStyles,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
                }}
              >
                {(Object.keys(searchModeLabels) as SearchMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setSearchMode(mode)
                      setModeMenuOpen(false)
                    }}
                    className={`flex items-center w-full px-3 py-2 text-left text-xs rounded ${
                      searchMode === mode
                        ? 'text-text-primary bg-surface-panel font-medium'
                        : 'text-text-secondary hover:bg-surface-panel'
                    }`}
                  >
                    {searchModeLabels[mode]}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="w-px h-4 mx-2 bg-border-default shrink-0" />
          <input
   type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchMode === 'semantic' ? '输入语义搜索内容，按回车触发...' : '搜索卡片...'}
            className="flex-1 py-2 text-sm outline-none bg-transparent text-text-primary"
          />
        </div>

        {/* Sort + Flomo sync */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="relative">
            <button
              ref={sortFloating.refs.setReference}
              {...sortInteractions.getReferenceProps()}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-text-secondary bg-surface-card border border-border-default hover:bg-surface-panel"
            >
              {sortLabels[sortBy]}
              {sortBy === 'related' && !indexed ? ' (向量化中...)' : ''}
              <ChevronDown size={10} />
            </button>
            {sortMenuOpen && (
              <div
                ref={sortFloating.refs.setFloating}
                {...sortInteractions.getFloatingProps()}
                className="py-1.5 rounded-lg min-w-[120px] glass-panel border border-border-default z-50"
                style={{
                  ...sortFloating.floatingStyles,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
                }}
              >
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setSortBy(opt.value)
                      setSortMenuOpen(false)
                    }}
                    className={`flex items-center w-full px-3 py-2 text-left text-xs rounded ${
                      sortBy === opt.value
                        ? 'text-text-primary bg-surface-panel font-medium'
                        : 'text-text-secondary hover:bg-surface-panel'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleSyncClick}
            disabled={syncing}
            className="btn-base flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-text-secondary bg-surface-card border border-border-default hover:bg-surface-card-hover"
            title={accessToken ? '同步 Flomo' : '连接 Flomo'}
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            同步 Flomo
          </button>
        </div>

        {/* Info bars */}
        {sortBy === 'related' && editingCardId && (
          <div className="mb-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2 bg-surface-card text-text-secondary">
            {searching ? (
              <><Loader2 size={14} className="animate-spin" /> 搜索相关卡片中...</>
            ) : (
              <>基于「{cards[editingCardId]?.title || '无标题'}」按相关性排序 · {visibleCards.length} 条结果</>
            )}
          </div>
        )}

        {(searchMode === 'semantic' || searchMode === 'hybrid') && searchQuery.trim() && (
          <div className="mb-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2 bg-surface-card text-text-secondary">
            {searching ? (
              <><Loader2 size={14} className="animate-spin" /> 语义搜索中...</>
            ) : (
              <>
                {Object.keys(searchScores).length > 0
                  ? `语义搜索完成 · ${visibleCards.length} 条结果`
                  : (indexed ? '未找到语义相关卡片' : '请先在设置中向量化卡片')}
              </>
            )}
          </div>
        )}

        {visibleCards.length === 0 ? (
          <EmptyState
            icon={<Layers size={24} />}
            text={sortBy === 'related' && !editingCardId ? '请先选中一张卡片' : (searchQuery ? '未找到匹配的卡片' : '暂无卡片')}
          />
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {visibleCards.map((card) => (
              <CardItem
                key={card.id}
                card={card}
                score={searchScores[card.id]}
                onDragStart={handleDragStart}
                onClick={(e) => handleClick(e, card.id)}
              />
            ))}
          </div>
        )}

        <div className="px-3 py-2 text-[10px] text-center text-text-secondary">
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