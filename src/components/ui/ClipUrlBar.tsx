import { useState, useRef, useEffect } from 'react'
import { Scissors, X, Loader2 } from 'lucide-react'
import { clipUrl, isValidHttpUrl } from '../../utils/clipper'
import { htmlToBlocks } from '../../converters/htmlToBlocks'
import { useCardStore } from '../../stores/cardStore'
import { useLibraryStore } from '../../stores/libraryStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { usePanelSurface } from '../../hooks/usePanelSurface'

interface ClipUrlBarProps {
  open: boolean
  onClose: () => void
}

export function ClipUrlBar({ open, onClose }: ClipUrlBarProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const surface = usePanelSurface()
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
      createdAt: Date.now(),
      title: '剪藏中…',
    })

    window.dispatchEvent(new CustomEvent('hepta-add-card-node', { detail: { cardId, color: 'blue' } }))

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

      useLibraryStore.getState().setEditingCardId(cardId)
      useLibraryStore.getState().setRightPanelActiveTab('editor')

      onClose()
    } catch (err: any) {
      const errorMessage =
        err.code === 'TIMEOUT' ? '请求超时，请检查网络后重试'
        : err.code === 'NO_CONTENT' ? '该页面无法提取有效内容'
        : err.code === 'WECHAT_CAPTCHA' ? '微信反爬验证拦截，请在浏览器中打开文章后重试'
        : err.code === 'FETCH_ERROR' ? `无法访问该页面 (${err.message})`
        : `剪藏失败: ${err.message || '未知错误'}`

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
      className="fixed bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-2 rounded-xl z-50 animate-fadeInUp"
      style={{
        backgroundColor: surface.panelBg,
        border: `1px solid ${surface.divider}`,
        boxShadow: surface.shadow,
        width: 420,
      }}
    >
      <Scissors size={16} style={{ color: surface.text, flexShrink: 0 }} />
      <input
        ref={inputRef}
        value={url}
        onChange={(e) => { setUrl(e.target.value); setError('') }}
        onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleClip() }}
        placeholder="粘贴网页链接..."
        disabled={loading}
        className="flex-1 bg-transparent outline-none text-sm"
        style={{ color: surface.text }}
      />
      {loading ? (
        <Loader2 size={16} className="animate-spin" style={{ color: surface.muted, flexShrink: 0 }} />
      ) : url ? (
        <button
          onClick={handleClip}
          className="text-xs px-2 py-1 rounded-md font-medium"
          style={{ backgroundColor: surface.accentBg, color: surface.accentText, flexShrink: 0 }}
        >
          剪藏
        </button>
      ) : null}
      <button
        onClick={onClose}
        className="p-1 rounded-md hover:opacity-70"
        style={{ color: surface.muted, flexShrink: 0 }}
      >
        <X size={14} />
      </button>
      {error && (
        <span className="text-xs" style={{ color: '#ef4444' }}>{error}</span>
      )}
    </div>
  )
}
