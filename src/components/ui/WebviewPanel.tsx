import { useRef, useCallback, useEffect } from 'react'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { useLibraryStore } from '../../stores/libraryStore'

interface WebviewPanelProps {
  url: string
}

export function WebviewPanel({ url }: WebviewPanelProps) {
  const webviewRef = useRef<Electron.WebviewTag>(null)
  const setWebviewUrl = useLibraryStore(s => s.setWebviewUrl)

  const handleBack = useCallback(() => {
    setWebviewUrl(null)
  }, [setWebviewUrl])

  const handleOpenExternal = useCallback(async () => {
    const currentUrl = webviewRef.current?.src || url
    try {
      await window.electronAPI.openExternal(currentUrl)
    } catch {
      window.open(currentUrl, '_blank')
    }
  }, [url])

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return
    const handler = (e: Electron.IpcMessageEvent) => {
      if (e.channel === 'will-navigate') {
        e.preventDefault()
      }
    }
    webview.addEventListener('will-navigate', handler as EventListener)
    return () => {
      webview.removeEventListener('will-navigate', handler as EventListener)
    }
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-default shrink-0">
        <button
          onClick={handleBack}
          className="flex items-center justify-center w-6 h-6 rounded hover:bg-surface-card-hover text-text-secondary"
          title="返回编辑器"
        >
          <ArrowLeft size={14} />
        </button>
        <div className="flex-1 px-2 py-1 rounded text-xs text-text-secondary bg-surface-card truncate select-all" title={url}>
          {url}
        </div>
        <button
          onClick={handleOpenExternal}
          className="flex items-center justify-center w-6 h-6 rounded hover:bg-surface-card-hover text-text-secondary"
          title="在浏览器中打开"
        >
          <ExternalLink size={14} />
        </button>
      </div>
      <div className="flex-1">
        <webview
          ref={webviewRef as any}
          src={url}
          style={{ width: '100%', height: '100%' }}
          partition="webview"
        />
      </div>
    </div>
  )
}
