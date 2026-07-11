import { useRef, useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react'
import { useLibraryStore } from '../../stores/libraryStore'

interface WebviewPanelProps {
  url: string
  embedded?: boolean
}

function isSafeWebviewUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function WebviewPanel({ url, embedded = false }: WebviewPanelProps) {
  const webviewRef = useRef<Electron.WebviewTag>(null)
  const setWebviewUrl = useLibraryStore(s => s.setWebviewUrl)
  const [loading, setLoading] = useState(true)

  const handleBack = useCallback(() => {
    setWebviewUrl(null)
  }, [setWebviewUrl])

  const handleOpenExternal = useCallback(async () => {
    const currentUrl = webviewRef.current?.src || url
    try {
      await window.electronAPI.shell.openExternal(currentUrl)
    } catch {
      window.open(currentUrl, '_blank')
    }
  }, [url])

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    const onDidStartLoading = () => setLoading(true)
    const onDidStopLoading = () => setLoading(false)
    const onDomReady = () => setLoading(false)

    webview.addEventListener('did-start-loading', onDidStartLoading)
    webview.addEventListener('did-stop-loading', onDidStopLoading)
    webview.addEventListener('dom-ready', onDomReady)

    return () => {
      webview.removeEventListener('did-start-loading', onDidStartLoading)
      webview.removeEventListener('did-stop-loading', onDidStopLoading)
      webview.removeEventListener('dom-ready', onDomReady)
    }
  }, [url])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-line-default shrink-0">
        {!embedded && (
          <button
            onClick={handleBack}
            className="flex items-center justify-center w-6 h-6 rounded hover:bg-surface-card-hover text-fg-secondary"
            title="返回编辑器"
          >
            <ArrowLeft size={14} />
          </button>
        )}
        {!embedded && (
          <div className="flex-1 px-2 py-1 rounded text-xs text-fg-secondary bg-surface-card truncate select-all" title={url}>
            {url}
          </div>
        )}
        {embedded && <div className="flex-1" />}
        {loading && <Loader2 size={14} className="animate-spin text-fg-secondary shrink-0" />}
        <button
          onClick={handleOpenExternal}
          className="flex items-center justify-center w-6 h-6 rounded hover:bg-surface-card-hover text-fg-secondary"
          title="在浏览器中打开"
        >
          <ExternalLink size={14} />
        </button>
      </div>
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-panel z-10">
            <Loader2 size={24} className="animate-spin text-fg-secondary" />
          </div>
        )}
        {isSafeWebviewUrl(url) ? (
          <webview
            ref={webviewRef as any}
            src={url}
            style={{ width: '100%', height: '100%' }}
            partition="persist:webview"
            preload={undefined}
            httpreferrer=""
            useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
          />
        ) : (
          <div className="p-3 text-sm text-fg-secondary">不支持打开此链接</div>
        )}
      </div>
    </div>
  )
}
