import { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react'
import { createPortal } from 'react-dom'
import { useFloating, useClick, useDismiss, useInteractions, offset, flip } from '@floating-ui/react'
import { useCardStore } from '../../stores/cardStore'
import { useBoardStore } from '../../stores/boardStore'
import { useCanvasPresenceStore } from '../../stores/canvasPresenceStore'
import { useLibraryStore, type SortBy, type SearchMode } from '../../stores/libraryStore'
import { useViewStore } from '../../stores/viewStore'
import { useEmbeddingStore } from '../../stores/embeddingStore'
import { useTagStore } from '../../stores/tagStore'
import { useFlomoSyncStore } from '../../sync/flomoSync'
import { EmptyState } from './SharedUI'
import { CardEditDialog } from './CardEditDialog'
import { CardLibraryRelevanceButton } from './CardLibraryRelevanceButton'
import { buildCardPreviewSemantics } from './cardPreview/previewSemantics'
import { emit } from '../../stores/eventBus'
import { GalleryVerticalEnd, RefreshCw, Loader2, ChevronDown, X } from 'lucide-react'

interface CardLibraryViewProps {
  onOpenSettings?: () => void
  compact?: boolean
}

const COMPACT_CARD_RENDER_LIMIT = 80
let hasStartedInitialCardReveal = false

type OrdinarySortBy = Exclude<SortBy, 'related'>

const SORT_OPTIONS: { value: OrdinarySortBy; label: string }[] = [
  { value: 'updatedAt', label: '最近修改' },
  { value: 'createdAt', label: '创建时间' },
  { value: 'title', label: '标题' },
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
  isOnCanvas,
  onDragStart,
  onClick,
}: {
  card: { id: string; content: string; title?: string; previewHTML?: string; updatedAt?: number; createdAt: number }
  score: number | undefined
  isOnCanvas: boolean
  onDragStart: (e: React.DragEvent, cardId: string) => void
  onClick: (e: React.MouseEvent) => void
}) {
  const previewHTML = card.previewHTML || useCardStore.getState().getPreviewHTML(card.id) || ''
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set())
  const images = useMemo(() => extractImages(previewHTML), [previewHTML])
  const preview = useMemo(
    () => buildCardPreviewSemantics({
      content: card.content,
      title: card.title,
      previewHTML,
    }),
    [card.content, card.title, previewHTML],
  )
  const textHTML = useMemo(() => stripImages(preview.bodyHTML), [preview.bodyHTML])
  const relativeTime = formatRelativeTime(card.updatedAt ?? card.createdAt)
  const visibleImages = images.slice(0, 3).filter((_, i) => !failedImages.has(i))

  return (
    <div
      data-on-canvas={isOnCanvas ? 'true' : 'false'}
      aria-disabled={isOnCanvas}
      draggable={!isOnCanvas}
      title={isOnCanvas ? '已置入画布，点击定位' : undefined}
      onDragStart={(e) => {
        if (isOnCanvas) return
        onDragStart(e, card.id)
        document.documentElement.dataset.cardLibraryDragging = 'true'
        // 先 clone 再加虚线类，避免 ghost 复制到虚线样式
        const rect = e.currentTarget.getBoundingClientRect()
        const ghost = e.currentTarget.cloneNode(true) as HTMLElement
        // wrapper 提供阴影空间
        const PAD = 32
        const wrapper = document.createElement('div')
        wrapper.style.position = 'fixed'
        wrapper.style.left = `${rect.left - PAD}px`
        wrapper.style.top = `${rect.top - PAD}px`
        wrapper.style.width = `${rect.width + PAD * 2}px`
        wrapper.style.height = `${rect.height + PAD * 2}px`
        wrapper.style.padding = `${PAD}px`
        wrapper.style.margin = '0'
        wrapper.style.boxSizing = 'border-box'
        wrapper.style.pointerEvents = 'none'
        wrapper.style.background = 'transparent'
        // ghost 本体：实色、overflow visible、transition none
        ghost.style.position = 'relative'
        ghost.style.left = '0'
        ghost.style.top = '0'
        ghost.style.width = `${rect.width}px`
        ghost.style.height = `${rect.height}px`
        ghost.style.margin = '0'
        ghost.style.transform = 'none'
        ghost.style.transition = 'none'
        ghost.style.opacity = '1'
        ghost.style.borderStyle = 'solid'
        ghost.style.overflow = 'visible'
        ghost.style.boxShadow = '0 24px 60px rgba(0,0,0,0.08)'
        ghost.style.pointerEvents = 'none'
        wrapper.appendChild(ghost)
        document.body.appendChild(wrapper)
        const offsetX = Math.min(Math.max(e.clientX - rect.left, 0), rect.width) + PAD
        const offsetY = Math.min(Math.max(e.clientY - rect.top, 0), rect.height) + PAD
        e.dataTransfer.setDragImage(wrapper, offsetX, offsetY)
        requestAnimationFrame(() => document.body.removeChild(wrapper))
        // clone 完成后再让源卡片显示为虚线占位框
        ;(e.currentTarget as HTMLElement).classList.add('card-item-floating')
      }}
      onDragEnd={(e) => {
        if (isOnCanvas) return
        delete document.documentElement.dataset.cardLibraryDragging
        const el = e.currentTarget as HTMLElement
        el.classList.remove('card-item-floating')
        el.classList.add('card-item-returning')
        el.addEventListener('animationend', () => el.classList.remove('card-item-returning'), { once: true })
      }}
      onClick={onClick}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border border-line-default bg-surface-card p-2.5 transition-all duration-200 ${
        isOnCanvas
          ? 'cursor-default opacity-[0.48] grayscale-[0.55] hover:border-line-default'
          : 'hover:-translate-y-0.5 hover:border-line-hover active:translate-y-px active:cursor-grabbing'
      }`}
      style={{ aspectRatio: '1/1' }}
    >
      {/* Title row — truncate with ellipsis, time right */}
      {(preview.title || relativeTime) && (
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          {preview.title && (
            <span className="text-sm font-medium text-fg-primary leading-snug truncate">{preview.title}</span>
          )}
          {relativeTime && (
            <span className="text-[10px] shrink-0 text-fg-tertiary">{relativeTime}</span>
          )}
        </div>
      )}

      {/* Text body — fade via mask, self-adaptive */}
      <div
        className="min-h-0 flex-1 overflow-hidden card-library-preview text-xs leading-relaxed text-fg-secondary"
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
              className="rounded-sm"
              onLoad={() => {}}
              onError={() => setFailedImages(prev => new Set(prev).add(i))}
	              style={{
	                width: 0,
	                flex: '1 1 0%',
	                aspectRatio: '1/1',
	                objectFit: 'cover',
	                transform: `rotate(${IMAGE_ROTATIONS[i % 3]}deg)`,
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
          <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-surface-panel">
            {(score * 100).toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  )
})

export function CardLibraryView({ onOpenSettings, compact = false }: CardLibraryViewProps) {
  const cards = useCardStore(s => s.cards)
  const activeBoardId = useBoardStore(s => s.activeBoardId)
  const presenceBoardId = useCanvasPresenceStore(s => s.boardId)
  const canvasCardIds = useCanvasPresenceStore(s => s.cardIds)
  const syncing = useFlomoSyncStore(s => s.syncing)
  const accessToken = useFlomoSyncStore(s => s.accessToken)
  const sync = useFlomoSyncStore(s => s.sync)

  const sortBy = useLibraryStore(s => s.sortBy)
  const setSortBy = useLibraryStore(s => s.setSortBy)
  const activateRelatedSort = useLibraryStore(s => s.activateRelatedSort)
  const exitRelatedSort = useLibraryStore(s => s.exitRelatedSort)
  const relatedSourceCardId = useLibraryStore(s => s.relatedSourceCardId)
  const editingCardId = useViewStore(s => s.editingCardId)
  const activeRelatedCardId = relatedSourceCardId ?? editingCardId
  const searchMode = useLibraryStore(s => s.searchMode)
  const setSearchMode = useLibraryStore(s => s.setSearchMode)
  const tagFilter = useLibraryStore(s => s.tagFilter)
  const setTagFilter = useLibraryStore(s => s.setTagFilter)

  const tagStoreTags = useTagStore(s => s.tags)
  const getTagsSortedByUsage = useTagStore(s => s.getTagsSortedByUsage)

  const {
    indexed,
    indexing,
    progress,
    total,
    indexError,
    searching,
    searchScores,
    searchRelated,
    searchByText,
    clearResults,
  } = useEmbeddingStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [editingResultId, setEditingResultId] = useState<string | null>(null)
  const [sourceRect, setSourceRect] = useState<DOMRect | null>(null)
  const [modeMenuOpen, setModeMenuOpen] = useState(false)
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [tagMenuOpen, setTagMenuOpen] = useState(false)
  const [isInitialReveal, setIsInitialReveal] = useState(() => !hasStartedInitialCardReveal)
  const [compactHeader, setCompactHeader] = useState(false)
  const scrollRootRef = useRef<HTMLDivElement>(null)
  const scrollFrameRef = useRef<number | null>(null)
  const lastRelatedId = useRef<string | null>(null)

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

  const tagFloating = useFloating({
    open: tagMenuOpen,
    onOpenChange: setTagMenuOpen,
    placement: 'bottom-start',
    middleware: [offset(4), flip()],
  })
  const tagClick = useClick(tagFloating.context)
  const tagDismiss = useDismiss(tagFloating.context)
  const tagInteractions = useInteractions([tagClick, tagDismiss])

  useEffect(() => {
    if (sortBy === 'related') {
      if (!activeRelatedCardId) {
        exitRelatedSort()
        return
      }
      if (!indexed) {
        lastRelatedId.current = null
        clearResults()
        return
      }
      // 源卡片已删除（如 persist 恢复后指向已删卡片）：清除引用并回退排序，避免空查询
      if (!cards[activeRelatedCardId]) {
        exitRelatedSort()
        return
      }
      if (lastRelatedId.current === activeRelatedCardId) return
      lastRelatedId.current = activeRelatedCardId
      searchRelated(activeRelatedCardId)
    } else {
      lastRelatedId.current = null
      clearResults()
    }
  }, [sortBy, activeRelatedCardId, cards, indexed, searchRelated, clearResults, exitRelatedSort])

  useEffect(() => {
    if (searchMode === 'keyword') {
      clearResults()
    }
  }, [searchMode, clearResults])

  useEffect(() => {
    if (!isInitialReveal) return
    hasStartedInitialCardReveal = true
    const timer = window.setTimeout(() => setIsInitialReveal(false), 500)
    return () => window.clearTimeout(timer)
  }, [isInitialReveal])

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current)
  }, [])

  const handleLibraryScroll = useCallback(() => {
    if (scrollFrameRef.current !== null) return
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null
      const root = scrollRootRef.current
      if (!root) return
      const scrollTop = root.scrollTop
      setCompactHeader(current => current ? scrollTop > 8 : scrollTop > 40)
      // 接近底部时增量渲染（渐进渲染）
      if (scrollTop + root.clientHeight > root.scrollHeight - 600) {
        setRenderLimit(prev => Math.min(prev + RENDER_STEP, visibleCountRef.current))
      }
    })
  }, [])

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

if (tagFilter) {
	      filtered = filtered.filter(c => c.tags?.includes(tagFilter))
	    }

if (searchQuery.trim()) {
	      const query = searchQuery.toLowerCase()
	      filtered = filtered.filter(card =>
	        ((card.title ?? '')?.toLowerCase().includes(query) ||
	         (card.content ?? '')?.toLowerCase().includes(query) ||
	         card.tags?.some(t => t && t.toLowerCase().includes(query)))
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
  }, [cards, searchQuery, sortBy, searchScores, searchMode, tagFilter])

  // 渐进渲染：非 compact 模式先渲染前 INITIAL_RENDER_LIMIT 张，
  // 滚动接近底部或浏览器空闲时增量增加——几百上千张卡片一次渲染会卡顿。
  const INITIAL_RENDER_LIMIT = 48
  const RENDER_STEP = 32
  const [renderLimit, setRenderLimit] = useState(INITIAL_RENDER_LIMIT)
  const visibleCountRef = useRef(0)
  visibleCountRef.current = visibleCards.length

  // 筛选/搜索/排序条件变化时重置渲染上限
  useEffect(() => {
    setRenderLimit(INITIAL_RENDER_LIMIT)
  }, [tagFilter, searchQuery, searchMode, sortBy])

  const renderedCards = useMemo(
    () => compact
      ? visibleCards.slice(0, COMPACT_CARD_RENDER_LIMIT)
      : visibleCards.slice(0, renderLimit),
    [compact, visibleCards, renderLimit],
  )
  const hiddenCardCount = Math.max(0, visibleCards.length - renderedCards.length)

  // 浏览器空闲时渐进渲染更多卡片
  useEffect(() => {
    if (compact) return
    if (renderLimit >= visibleCountRef.current) return
    const id = requestIdleCallback(() => {
      setRenderLimit(prev => Math.min(prev + RENDER_STEP, visibleCountRef.current))
    }, { timeout: 400 })
    return () => cancelIdleCallback(id)
  }, [renderLimit, compact])

  // 可见卡片变化时，预生成缺少 previewHTML 的卡片 HTML（避免在 render 中调 getPreviewHTML 触发 flushSync 警告）。
  // 分批 + 空闲生成：一次性同步转换几百张卡（标签筛选/搜索后）会阻塞主线程造成卡顿。
  useEffect(() => {
    const missing = renderedCards.filter(c => !c.previewHTML && c.content).map(c => c.id)
    if (missing.length === 0) return
    const BATCH = 8
    let idx = 0
    let idleId: number | null = null
    let cancelled = false
    const generateNext = () => {
      if (cancelled) return
      const batch = missing.slice(idx, idx + BATCH)
      if (batch.length === 0) return
      idx += BATCH
      useCardStore.getState().ensurePreviewHTMLBatch(batch)
      if (idx < missing.length) {
        idleId = requestIdleCallback(generateNext)
      }
    }
    idleId = requestIdleCallback(generateNext)
    return () => {
      cancelled = true
      if (idleId !== null) cancelIdleCallback(idleId)
    }
  }, [renderedCards])

  const tagCloud = useMemo(() => {
    void tagStoreTags
    const tags = getTagsSortedByUsage().filter(t => t.count > 0)
    return compact ? tags.slice(0, 30) : tags
  }, [getTagsSortedByUsage, tagStoreTags, cards, compact])

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

  const handleClick = useCallback((e: React.MouseEvent, cardId: string, isOnCanvas: boolean) => {
    if (isOnCanvas) {
      emit('focus-card', { cardId })
      return
    }
    setSourceRect(e.currentTarget.getBoundingClientRect())
    setEditingResultId(cardId)
  }, [])

  const hasCurrentCanvasPresence = activeBoardId !== null && presenceBoardId === activeBoardId

  return (
    <div className="h-full w-full overflow-hidden">
      <style>{`
        .card-library-preview h1,
        .card-library-preview h2,
        .card-library-preview h3 {
          font-size: 1em !important;
          font-weight: 600 !important;
          margin: 0 !important;
          line-height: 1.4 !important;
        }
        .card-item-floating {
          opacity: 0.5;
          border-style: dashed !important;
          border-color: rgba(120,120,120,0.35) !important;
          border-width: 1.5px !important;
          box-shadow: none !important;
          background: transparent !important;
          transition: opacity 0.15s ease-out, border-style 0.15s ease-out, background 0.15s ease-out;
        }
        .card-item-floating > * {
          opacity: 0.3;
          filter: grayscale(0.6);
        }
        @keyframes card-return-settle {
          from { transform: translateY(4px); opacity: 0.72; }
          to { transform: translateY(0); opacity: 1; }
        }
        .card-item-returning {
          animation: card-return-settle 180ms var(--ease-out) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .card-item-returning { animation: none; transform: none; }
        }
      `}</style>
      <div className={`mx-auto flex h-full max-w-3xl flex-col ${compact ? 'px-3' : 'px-6'}`}>
        <div
          data-testid="card-library-header"
          data-compact={compactHeader ? 'true' : 'false'}
          className={`relative z-10 shrink-0 transition-[height] duration-200 ease-out motion-reduce:transition-none ${
            compactHeader ? 'h-[52px]' : 'h-[92px]'
          }`}
        >
          <h1 className={`${compact ? 'text-lg' : 'text-xl'} absolute left-0 top-3 whitespace-nowrap font-semibold text-fg-primary`}>卡片库</h1>
          {/* Search bar with mode switch */}
          <div
            data-testid="card-library-search"
            className={`absolute right-0 flex min-w-0 items-center gap-0 rounded-lg border border-line-default bg-surface-card px-2 transition-[left,top] duration-200 ease-out motion-reduce:transition-none ${
              compactHeader ? 'left-[72px] top-2' : 'left-0 top-12'
            }`}
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
              className="flex items-center gap-0.5 px-1.5 py-1 rounded text-[11px] font-medium text-fg-secondary hover:bg-surface-panel"
              title="切换搜索模式"
            >
              {searchModeLabels[searchMode]}
              <ChevronDown size={10} className="text-fg-secondary" />
            </button>
            {modeMenuOpen && (
              <div
                ref={modeFloating.refs.setFloating}
                {...modeInteractions.getFloatingProps()}
	              className="floating-menu z-50"
	                style={modeFloating.floatingStyles}
	              >
	                {(Object.keys(searchModeLabels) as SearchMode[]).map((mode) => (
	                  <button
	                    key={mode}
	                    aria-pressed={searchMode === mode}
	                    onClick={() => {
	                      setSearchMode(mode)
	                      setModeMenuOpen(false)
	                    }}
	                    className={`floating-menu-item ${searchMode === mode ? 'floating-menu-item-active' : ''}`}
	                  >
                    {searchModeLabels[mode]}
                  </button>
                ))}
              </div>
            )}
            </div>
	          <div className="w-px h-4 mx-2 bg-line-default shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchMode === 'semantic' ? '输入语义搜索内容，按回车触发...' : '搜索卡片...'}
              className="min-w-0 flex-1 bg-transparent py-2 text-sm text-fg-primary outline-none"
            />
          </div>

        </div>

        <div
          ref={scrollRootRef}
          data-testid="card-library-scroll-root"
          className={`min-h-0 flex-1 overflow-y-auto ${compact ? 'pb-3' : 'pb-6'}`}
          onScroll={handleLibraryScroll}
        >

        {tagCloud.length > 0 && !compact && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {tagCloud.map((t) => {
              const active = tagFilter === t.name
              return (
                <button
                  key={t.name}
                  aria-pressed={active}
                  onClick={() => setTagFilter(active ? null : t.name)}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                    active
                      ? 'bg-brand text-fg-inverse border-transparent'
                      : 'bg-surface-card text-fg-secondary border-line-default hover:bg-surface-card-hover hover:text-fg-primary'
                  }`}
                  title={`${t.count} 张卡片${t.flomoSynced ? ' · flomo' : ''}`}
                >
                  #{t.name}
                  <span className={`ml-1 ${active ? 'text-white/70' : 'text-fg-tertiary'}`}>
                    {t.count}
                  </span>
                  {t.flomoSynced && (
                    <span className={`ml-1 text-[9px] ${active ? 'text-white/70' : 'text-fg-tertiary'}`}>
                      flomo
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Library controls */}
        <div
          role="toolbar"
          aria-label="卡片库控制"
          className={`${compact ? 'mb-3' : 'mb-4'} flex min-w-0 items-center gap-2`}
        >
          <div
            data-testid="card-library-control-track"
            className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto"
          >
          <div className="relative shrink-0">
            <button
              ref={sortFloating.refs.setReference}
              {...sortInteractions.getReferenceProps()}
              className="flex shrink-0 items-center gap-1 whitespace-nowrap px-2 py-1.5 rounded-lg text-xs text-fg-secondary bg-surface-card border border-line-default hover:bg-surface-panel"
            >
              {sortBy === 'related' ? '排序' : sortLabels[sortBy]}
              <ChevronDown size={10} />
            </button>
            {sortMenuOpen && (
              <div
                ref={sortFloating.refs.setFloating}
                {...sortInteractions.getFloatingProps()}
	              className="floating-menu z-50"
	                style={sortFloating.floatingStyles}
	              >
	                {SORT_OPTIONS.map((opt) => (
	                  <button
	                    key={opt.value}
	                    aria-pressed={sortBy === opt.value}
	                    onClick={() => {
	                      setSortBy(opt.value)
	                      setSortMenuOpen(false)
	                    }}
	                    className={`floating-menu-item ${sortBy === opt.value ? 'floating-menu-item-active' : ''}`}
	                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative shrink-0">
            <button
                ref={tagFloating.refs.setReference}
                {...tagInteractions.getReferenceProps()}
                className="flex max-w-[120px] items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-fg-secondary bg-surface-card border border-line-default hover:bg-surface-panel"
                title="筛选标签"
              >
                <span className="truncate">{tagFilter ? `#${tagFilter}` : '全部标签'}</span>
                <ChevronDown size={10} className="shrink-0" />
              </button>
            {tagMenuOpen && (
                <div
                  ref={tagFloating.refs.setFloating}
                  {...tagInteractions.getFloatingProps()}
                  className="floating-menu z-50 max-h-72 overflow-y-auto"
                  style={tagFloating.floatingStyles}
                >
                  <button
                    aria-pressed={!tagFilter}
                    onClick={() => {
                      setTagFilter(null)
                      setTagMenuOpen(false)
                    }}
                    className={`floating-menu-item ${!tagFilter ? 'floating-menu-item-active' : ''}`}
                  >
                    全部标签
                  </button>
                  {tagCloud.map((t) => (
                    <button
                      key={t.name}
                      aria-pressed={tagFilter === t.name}
                      onClick={() => {
                        setTagFilter(t.name)
                        setTagMenuOpen(false)
                      }}
                      className={`floating-menu-item ${tagFilter === t.name ? 'floating-menu-item-active' : ''}`}
                    >
                      #{t.name}
                      <span className="ml-1 text-fg-tertiary">{t.count}</span>
                    </button>
                  ))}
                </div>
            )}
          </div>

          <CardLibraryRelevanceButton
            active={sortBy === 'related'}
            indexed={indexed}
            indexing={indexing}
            progress={progress}
            total={total}
            indexError={indexError}
            editingCardId={activeRelatedCardId}
            onActivate={sortBy === 'related' ? exitRelatedSort : activateRelatedSort}
          />
          </div>
          <button
            type="button"
            data-testid="card-library-flomo-sync"
            aria-label={accessToken ? '同步 Flomo' : '连接 Flomo'}
            title={accessToken ? '同步 Flomo' : '连接 Flomo'}
            onClick={handleSyncClick}
            disabled={syncing}
            className="btn-base flex size-8 shrink-0 items-center justify-center rounded-lg border border-line-default bg-surface-card text-fg-secondary hover:bg-surface-card-hover disabled:opacity-50"
          >
            <RefreshCw size={14} aria-hidden="true" className={syncing ? 'animate-spin' : ''} />
          </button>
        </div>

        {tagFilter && (
          <div className="mb-3 px-3 py-2 rounded-lg text-xs flex items-center justify-between gap-2 bg-surface-card text-fg-secondary border border-brand/30">
            <span className="flex items-center gap-1.5">
              按标签过滤：<span className="font-medium text-brand">#{tagFilter}</span>
              <span className="text-fg-tertiary">· {visibleCards.length} 条结果</span>
            </span>
            <button
              onClick={() => setTagFilter(null)}
              className="p-0.5 rounded hover:bg-surface-panel text-fg-tertiary hover:text-fg-primary"
              title="清除标签过滤"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Info bars */}
        {(searchMode === 'semantic' || searchMode === 'hybrid') && searchQuery.trim() && (
          <div className="mb-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2 bg-surface-card text-fg-secondary">
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
            icon={<GalleryVerticalEnd size={24} />}
            text={
              tagFilter
                ? `没有带 #${tagFilter} 标签的卡片`
                : sortBy === 'related' && !activeRelatedCardId
                  ? '请先选中一张卡片'
                  : sortBy === 'related' && !indexed
                    ? '请先在设置中向量化卡片'
                    : sortBy === 'related'
                      ? '未找到相似卡片'
                  : (searchQuery ? '未找到匹配的卡片' : '暂无卡片')
            }
          />
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {renderedCards.map((card, index) => {
              const isOnCanvas = hasCurrentCanvasPresence && canvasCardIds.has(card.id)
              return (
              <div
                key={card.id}
                className={isInitialReveal && index < 12 ? 'card-library-card-reveal' : undefined}
                style={isInitialReveal && index < 12 ? { animationDelay: `${index * 30}ms` } : undefined}
              >
                <CardItem
                  card={card}
                  score={searchScores[card.id]}
                  isOnCanvas={isOnCanvas}
                  onDragStart={handleDragStart}
                  onClick={(e) => handleClick(e, card.id, isOnCanvas)}
                />
              </div>
              )
            })}
          </div>
        )}

        {hiddenCardCount > 0 && (
          <div className="mt-3 px-3 py-2 text-[10px] text-center text-fg-secondary">
            已显示 {renderedCards.length} / {visibleCards.length}，继续搜索或筛选可缩小范围
          </div>
        )}

        <div className="px-3 py-2 text-[10px] text-center text-fg-secondary">
          拖拽到画布创建引用 · 按住 Alt 拖拽创建新实例
        </div>
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
