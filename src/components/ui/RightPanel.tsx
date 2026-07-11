import { useCallback, useRef, lazy, Suspense } from 'react'
import { useViewStore } from '../../stores/viewStore'
import { usePanelStore } from '../../stores/panelStore'
import { useLibraryStore } from '../../stores/libraryStore'
import { useCardStore, useCard } from '../../stores/cardStore'
import { useIsDarkMode } from '../../hooks/useIsDarkMode'
import { CollapseButton } from './SharedUI'
import { GalleryVerticalEnd, FileText, ArrowLeftToLine, Globe, Compass } from 'lucide-react'
import { WebviewPanel } from './WebviewPanel'
import { AgentReachPanel } from './AgentReachPanel'

const LazyCardBlockNoteEditor = lazy(() =>
  import('../editor/BlockNoteEditor').then(m => ({ default: m.CardBlockNoteEditor }))
)

const CardLibraryView = lazy(() =>
  import('./CardLibraryView').then(m => ({ default: m.CardLibraryView }))
)

interface RightPanelProps {
  integratedSurface?: boolean
  onOpenSettings?: () => void
}

export function RightPanel({ integratedSurface = false, onOpenSettings }: RightPanelProps) {
  const rightPanelCollapsed = usePanelStore(s => s.rightPanelCollapsed)
  const setRightPanelCollapsed = usePanelStore(s => s.setRightPanelCollapsed)
  const rightPanelActiveTab = usePanelStore(s => s.rightPanelActiveTab)
  const setRightPanelActiveTab = usePanelStore(s => s.setRightPanelActiveTab)
  const rightPanelWidth = usePanelStore(s => s.rightPanelWidth)
  const setRightPanelWidth = usePanelStore(s => s.setRightPanelWidth)
  const viewMode = useViewStore(s => s.viewMode)
  const editingCardId = useViewStore(s => s.editingCardId)
  const webviewUrl = useLibraryStore(s => s.webviewUrl)
  const setWebviewUrl = useLibraryStore(s => s.setWebviewUrl)
  const editingCard = useCard(editingCardId ?? '')
  const isClipCard = !!(editingCard?.sourceUrl)

  const isDragging = useRef(false)

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    isDragging.current = true
    const startX = e.clientX
    const startWidth = rightPanelWidth
    const onMove = (ev: PointerEvent) => {
      if (!isDragging.current) return
      const delta = startX - ev.clientX
      setRightPanelWidth(startWidth + delta)
    }
    const onUp = () => {
      isDragging.current = false
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [rightPanelWidth, setRightPanelWidth])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation()
  }, [])

  if (viewMode !== 'board') return null

  const showEditorTab = rightPanelActiveTab === 'editor' || !!editingCardId
  const showEditorContent = !rightPanelCollapsed && rightPanelActiveTab === 'editor' && editingCardId

  return (
    <>
      <div
        className={`absolute right-0 top-0 bottom-0 z-10 flex flex-col overflow-hidden ${integratedSurface ? 'workspace-integrated-panel' : 'glass-panel-large'}`}
        style={{ width: rightPanelWidth, transform: `translateX(${rightPanelCollapsed ? rightPanelWidth : 0}px)`, transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
        onWheel={handleWheel}
      >
        <div
          className="absolute left-0 top-0 bottom-0 z-20 cursor-col-resize"
          style={{ width: 4 }}
          onPointerDown={handleResizeStart}
        />

      <div className="flex items-center justify-between px-2.5 py-2 transition-theme">
	        <div
	          className="segmented"
	          style={{
	            '--active-index': rightPanelActiveTab === 'library' ? 0 : rightPanelActiveTab === 'channels' ? 1 : 2,
	            '--seg-count': showEditorTab ? 3 : 2,
	          } as React.CSSProperties}
	        >
	          <button
	            onClick={() => setRightPanelActiveTab('library')}
	            className={`segmented-item cursor-pointer w-[84px] justify-center whitespace-nowrap ${rightPanelActiveTab === 'library' ? 'segmented-item-active' : ''}`}
	          >
	            <GalleryVerticalEnd size={14} />
	            卡片库
	          </button>
	          <button
	            onClick={() => setRightPanelActiveTab('channels')}
	            className={`segmented-item cursor-pointer w-[84px] justify-center whitespace-nowrap ${rightPanelActiveTab === 'channels' ? 'segmented-item-active' : ''}`}
	          >
	            <Compass size={14} />
	            频道
	          </button>
	          {showEditorTab && (
	            <button
	              onClick={() => setRightPanelActiveTab('editor')}
	              className={`segmented-item cursor-pointer w-[84px] justify-center whitespace-nowrap ${rightPanelActiveTab === 'editor' ? 'segmented-item-active' : ''}`}
	            >
	              <FileText size={14} />
	              编辑
	            </button>
	          )}
	        </div>
	        <CollapseButton direction="right" onClick={() => setRightPanelCollapsed(true)} />
	      </div>

      <div className="flex-1 overflow-y-auto">
        {rightPanelActiveTab === 'channels' ? (
          <AgentReachPanel />
        ) : rightPanelActiveTab === 'library' ? (
          !rightPanelCollapsed && <Suspense fallback={null}><CardLibraryView onOpenSettings={onOpenSettings} compact /></Suspense>
        ) : showEditorContent ? (
	          <div key={editingCardId} className="h-full animate-fadeIn">
	            <ClipAwareEditorView
	              cardId={editingCardId!}
	              isClipCard={isClipCard}
	              sourceUrl={editingCard?.sourceUrl}
	              webviewUrl={webviewUrl}
	              setWebviewUrl={setWebviewUrl}
	            />
	          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full animate-fadeIn text-fg-secondary">
            <FileText size={48} className="mb-4 opacity-30" />
            <p className="text-sm">选择卡片进行编辑</p>
          </div>
        )}
      </div>
    </div>

    {rightPanelCollapsed && (
      <button
        onClick={() => setRightPanelCollapsed(false)}
        className="action-icon-btn workspace-panel-expand-button fixed top-9 right-3 z-50 rounded-lg"
      >
        <ArrowLeftToLine size={16} />
      </button>
    )}
  </>
  )
}

function ClipAwareEditorView({ cardId, isClipCard, sourceUrl, webviewUrl, setWebviewUrl }: {
  cardId: string
  isClipCard: boolean
  sourceUrl?: string
  webviewUrl: string | null
  setWebviewUrl: (url: string | null, cardId?: string | null) => void
}) {
  const card = useCardStore(s => s.cards[cardId])
  const updateCard = useCardStore(s => s.updateCard)
  const isDarkMode = useIsDarkMode()

  const handleChange = useCallback((content: string) => {
    updateCard(cardId, { content })
  }, [cardId, updateCard])

  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center h-full animate-fadeIn text-fg-secondary">
        <p className="text-sm">卡片不存在或已被删除</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {isClipCard && (
        <div className="flex justify-center px-6 pt-3">
          <div className="segmented">
            <button
              onClick={() => { setWebviewUrl(null); updateCard(cardId, { viewMode: 'editor' }) }}
              className={`segmented-item text-[11px] cursor-pointer ${!webviewUrl ? 'segmented-item-active' : ''}`}
            >
              <FileText size={11} />
              剪藏
            </button>
            <button
              onClick={() => { setWebviewUrl(sourceUrl!, cardId); updateCard(cardId, { viewMode: 'web' }) }}
              className={`segmented-item text-[11px] cursor-pointer ${webviewUrl ? 'segmented-item-active' : ''}`}
            >
              <Globe size={11} />
              网页
            </button>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-auto p-6">
        {webviewUrl ? (
          <WebviewPanel url={webviewUrl} embedded />
        ) : (
          <Suspense fallback={null}>
            <LazyCardBlockNoteEditor
              key={cardId}
              content={card.content}
              onChange={handleChange}
              editable={true}
              cardId={cardId}
              theme={isDarkMode ? 'dark' : 'light'}
            />
          </Suspense>
        )}
      </div>
    </div>
  )
}
