import { useState, useCallback, useEffect, useRef } from 'react'
import { Search, Loader2, Scissors, Flame, Trophy } from 'lucide-react'
import { clipUrl } from '../../utils/clipper'
import { htmlToBlocks } from '../../converters/htmlToBlocks'
import { useCardStore } from '../../stores/cardStore'
import { useViewStore } from '../../stores/viewStore'
import { usePanelStore } from '../../stores/panelStore'
import { useLibraryStore } from '../../stores/libraryStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { emit } from '../../stores/eventBus'

type Platform = 'bilibili' | 'xiaohongshu'
type Action = 'hot' | 'rank' | 'search'

interface BrowseItem {
  id: string
  title: string
  author?: string
  url: string
  thumbnail?: string
  description?: string
  stats?: Record<string, string | number>
  duration?: string
}

const PLATFORM_CONFIG: Record<Platform, { label: string; actions: Action[] }> = {
  bilibili: { label: 'B站', actions: ['hot', 'rank', 'search'] },
  xiaohongshu: { label: '小红书', actions: ['hot', 'search'] },
}

const ACTION_CONFIG: Record<Action, { label: string; icon: typeof Flame }> = {
  hot: { label: '热门', icon: Flame },
  rank: { label: '排行', icon: Trophy },
  search: { label: '搜索', icon: Search },
}

function formatNumber(n: number | string): string {
  const num = typeof n === 'string' ? parseInt(n, 10) : n
  if (isNaN(num)) return String(n)
  if (num >= 10000) return `${(num / 10000).toFixed(1)}万`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`
  return String(num)
}

function isVideoUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname
    return hostname.includes('bilibili.com') || hostname.includes('b23.tv') || hostname.includes('youtube.com') || hostname.includes('youtu.be')
  } catch { return false }
}

// Simple in-memory cache for browse results
const browseCache = new Map<string, { items: BrowseItem[]; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function AgentReachPanel() {
  const [platform, setPlatform] = useState<Platform>('bilibili')
  const [action, setAction] = useState<Action>('hot')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<BrowseItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasLoaded, setHasLoaded] = useState(false)
  const [clippingId, setClippingId] = useState<string | null>(null)

  const workspacePath = useWorkspaceStore((s) => s.currentWorkspace?.path)
  const inputRef = useRef<HTMLInputElement>(null)

  const getCacheKey = (p: Platform, a: Action, q?: string) => `${p}:${a}:${q || ''}`

  const browse = useCallback(async (browsePlatform: Platform, browseAction: Action, browseQuery?: string) => {
    const cacheKey = getCacheKey(browsePlatform, browseAction, browseQuery)
    const cached = browseCache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setItems(cached.items)
      setAction(browseAction)
      setHasLoaded(true)
      return
    }

    setLoading(true)
    setError('')
    setItems([])

    try {
      const electronAPI = (window as any).electronAPI
      if (!electronAPI?.clipper?.agentReachBrowse) {
        setError('频道浏览仅在 Electron 桌面端可用，请通过 electron:dev / electron:start 启动')
        setHasLoaded(true)
        return
      }

      const result = await electronAPI.clipper.agentReachBrowse({
        platform: browsePlatform,
        action: browseAction,
        query: browseQuery,
        limit: 20,
        workspacePath,
      })
      setItems(result.items)
      setAction(browseAction)
      browseCache.set(cacheKey, { items: result.items, ts: Date.now() })
    } catch (err: any) {
      const msg = err.message || '加载失败'
      setError(msg)
    } finally {
      setHasLoaded(true)
      setLoading(false)
    }
  }, [workspacePath])

  useEffect(() => {
    browse('bilibili', 'hot')
  }, [browse])

  const handleClip = useCallback(async (item: BrowseItem) => {
    setClippingId(item.id)

    const cardId = crypto.randomUUID()
    const isVideo = isVideoUrl(item.url)
    useCardStore.getState().addCard({
      id: cardId,
      content: JSON.stringify([
        { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: '剪藏中…', styles: {} }] },
        { type: 'paragraph', content: [{ type: 'text', text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', styles: {} }] },
        { type: 'paragraph', content: [{ type: 'link', href: item.url, content: [{ type: 'text', text: item.url, styles: {} }] }] },
      ]),
      color: 'blue',
      sourceUrl: item.url,
      createdAt: Date.now(),
      title: '剪藏中…',
      ...(isVideo ? { viewMode: 'web' as const } : {}),
    })

    emit('add-card-node', { cardId, color: 'blue' })

    // For video clips, open webview in right panel immediately
    if (isVideo) {
      useLibraryStore.getState().setWebviewUrl(item.url, cardId)
      usePanelStore.getState().setRightPanelActiveTab('editor')
      usePanelStore.getState().setRightPanelCollapsed(false)
    }

    try {
      const result = await clipUrl(item.url, workspacePath)
      const blocks = htmlToBlocks(result.html)
      blocks.unshift({
        type: 'heading',
        props: { level: 2 },
        content: [{ type: 'text', text: result.title, styles: {} }],
      })
      blocks.splice(1, 0, {
        type: 'paragraph',
        content: [{ type: 'link', href: result.sourceUrl, content: [{ type: 'text', text: `来源: ${result.sourceName}`, styles: {} }] }],
      })

      useCardStore.getState().updateCard(cardId, {
        content: JSON.stringify(blocks),
        color: 'white',
        title: result.title,
      })
      useViewStore.getState().setEditingCardId(cardId)
      usePanelStore.getState().setRightPanelActiveTab('editor')
    } catch {
      useCardStore.getState().updateCard(cardId, {
        content: JSON.stringify([
          { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: '剪藏失败', styles: {} }] },
          { type: 'paragraph', content: [{ type: 'link', href: item.url, content: [{ type: 'text', text: item.url, styles: {} }] }] },
        ]),
        color: 'yellow',
        title: '剪藏失败',
      })
    } finally {
      setClippingId(null)
    }
  }, [workspacePath, emit])

  const handlePlatformChange = (p: Platform) => {
    setPlatform(p)
    setItems([])
    setError('')
    const firstAction = PLATFORM_CONFIG[p].actions[0]
    setAction(firstAction)
    if (firstAction !== 'search') {
      browse(p, firstAction)
    }
  }

  const config = PLATFORM_CONFIG[platform]

  return (
    <div className="flex flex-col h-full">
      {/* Platform tabs */}
      <div className="flex gap-1 px-3 pt-1 pb-1.5">
        {(Object.entries(PLATFORM_CONFIG) as [Platform, typeof config][]).map(([p, c]) => (
          <button
            key={p}
            onClick={() => handlePlatformChange(p)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${platform === p ? 'bg-surface-card text-fg-primary' : 'text-fg-secondary hover:text-fg-primary'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-1.5 px-3 pb-2">
        {config.actions.filter(a => a !== 'search').map((a) => {
          const ac = ACTION_CONFIG[a]
          const Icon = ac.icon
          return (
            <button
              key={a}
              onClick={() => browse(platform, a)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors ${action === a ? 'bg-surface-card text-fg-primary' : 'text-fg-secondary hover:text-fg-primary'}`}
            >
              <Icon size={12} />
              {ac.label}
            </button>
          )
        })}

        {config.actions.includes('search') && (
          <div className="flex items-center gap-1 ml-auto flex-1 max-w-[200px]">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && query.trim()) browse(platform, 'search', query.trim()) }}
              placeholder="搜索..."
              className="flex-1 px-2 py-1 rounded-md text-xs bg-surface-card border border-line-default outline-none text-fg-primary"
            />
            <button
              onClick={() => { if (query.trim()) browse(platform, 'search', query.trim()) }}
              className="p-1 rounded-md text-fg-secondary hover:text-fg-primary"
            >
              <Search size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-fg-secondary" />
          </div>
        )}

        {error && (
          <div className="px-4 py-8 text-center text-xs text-fg-secondary whitespace-pre-line">{error}</div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-fg-secondary">
            {hasLoaded ? '暂无内容' : '选择操作或搜索以浏览内容'}
          </div>
        )}

        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => handleClip(item)}
            className="flex items-start gap-2 mx-2 rounded-lg px-2 py-2 hover:bg-surface-card-hover transition-colors cursor-pointer"
          >
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-fg-primary truncate">{item.title}</div>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-fg-secondary">
                {item.author && <span>{item.author}</span>}
                {item.duration && <span>{item.duration}</span>}
                {item.stats && Object.entries(item.stats).map(([k, v]) => (
                  <span key={k}>{k} {formatNumber(v)}</span>
                ))}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleClip(item) }}
              disabled={clippingId === item.id}
              className="shrink-0 p-1.5 rounded-md text-fg-secondary hover:text-fg-primary hover:bg-surface-card transition-colors disabled:opacity-50"
              title="剪藏到画布"
            >
              {clippingId === item.id
                ? <Loader2 size={14} className="animate-spin" />
                : <Scissors size={14} />
              }
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
