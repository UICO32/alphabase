import { useState, useRef, useEffect } from 'react'
import { Scissors, X, Loader2 } from 'lucide-react'
import { IconButton } from './IconButton'
import { Button } from './Button'
import { clipUrl, isValidHttpUrl } from '../../utils/clipper'

function isVideoUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname
    return hostname.includes('bilibili.com') || hostname.includes('b23.tv') || hostname.includes('youtube.com') || hostname.includes('youtu.be')
  } catch { return false }
}
import { htmlToBlocks } from '../../converters/htmlToBlocks'
import { useCardStore } from '../../stores/cardStore'
import { useViewStore } from '../../stores/viewStore'
import { usePanelStore } from '../../stores/panelStore'
import { useLibraryStore } from '../../stores/libraryStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { emit } from '../../stores/eventBus'

interface ClipUrlBarProps {
  open: boolean
  onClose: () => void
}

export function ClipUrlBar({ open, onClose }: ClipUrlBarProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const workspacePath = useWorkspaceStore((s) => s.currentWorkspace?.path)

  useEffect(() => {
    if (open) {
      setUrl('')
      setError('')
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  if (!open) return null

  const handleClip = async () => {
    const trimmed = url.trim()
    if (!isValidHttpUrl(trimmed)) {
      setError('请输入有效的 HTTP/HTTPS 链接')
      return
    }

    setLoading(true)
    setError('')

    const cardId = crypto.randomUUID()
    const isVideo = isVideoUrl(trimmed)

    useCardStore.getState().addCard({
      id: cardId,
      content: JSON.stringify([
        { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: '剪藏中…', styles: {} }] },
        { type: 'paragraph', content: [{ type: 'text', text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', styles: {} }] },
        { type: 'paragraph', content: [{ type: 'text', text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', styles: {} }] },
        { type: 'paragraph', content: [{ type: 'text', text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', styles: {} }] },
        { type: 'paragraph', content: [{ type: 'link', href: trimmed, content: [{ type: 'text', text: trimmed, styles: {} }] }] },
      ]),
      color: 'blue',
      sourceUrl: trimmed,
      createdAt: Date.now(),
      title: '剪藏中…',
      ...(isVideo ? { viewMode: 'web' as const } : {}),
    })

    emit('add-card-node', { cardId, color: 'blue' })

    try {
      const result = await clipUrl(trimmed, workspacePath)

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

      // For video clips, open webview in right panel
      if (isVideo) {
        useLibraryStore.getState().setWebviewUrl(trimmed, cardId)
      }

      onClose()
    } catch (err: unknown) {
      const code = (err as Record<string, unknown>)?.code as string | undefined
      const msg = err instanceof Error ? err.message : '未知错误'
      const errorMessage =
        code === 'TIMEOUT' ? '请求超时，请检查网络后重试'
        : code === 'NO_CONTENT' ? '该页面无法提取有效内容'
        : code === 'WECHAT_CAPTCHA' ? '微信反爬验证拦截，请在浏览器中打开文章后重试'
        : code === 'FETCH_ERROR' ? `无法访问该页面 (${msg})`
        : code === 'CLI_NOT_FOUND' ? '所需工具未安装，请先配置 Agent Reach'
        : code === 'CLI_TIMEOUT' ? '提取超时，内容可能较大'
        : code === 'CLI_ERROR' ? `工具执行失败: ${msg}`
        : `剪藏失败: ${msg}`

      useCardStore.getState().updateCard(cardId, {
        content: JSON.stringify([
          { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: '剪藏失败', styles: {} }] },
          { type: 'paragraph', content: [{ type: 'text', text: errorMessage, styles: {} }] },
          { type: 'paragraph', content: [{ type: 'link', href: trimmed, content: [{ type: 'text', text: trimmed, styles: {} }] }] },
        ]),
        color: 'yellow',
        title: '剪藏失败',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-2 rounded-xl z-50 animate-fadeInUp glass-panel"
      style={{
        width: 420,
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <Scissors size={16} className="text-fg-primary shrink-0" />
      <input
        ref={inputRef}
        value={url}
        onChange={(e) => { setUrl(e.target.value); setError('') }}
        onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleClip() }}
        placeholder="粘贴网页链接..."
        disabled={loading}
        className="flex-1 bg-transparent outline-none text-sm text-fg-primary"
      />
      {loading ? (
        <Loader2 size={16} className="animate-spin text-fg-secondary shrink-0" />
      ) : url ? (
        <Button variant="primary" size="sm" onClick={handleClip} className="shrink-0">
          剪藏
        </Button>
      ) : null}
      <IconButton size="sm" variant="ghost" onClick={onClose} className="shrink-0">
        <X size={14} />
      </IconButton>
      {error && (
        <span className="text-xs" style={{ color: 'var(--fg-danger)' }}>{error}</span>
      )}
    </div>
  )
}
