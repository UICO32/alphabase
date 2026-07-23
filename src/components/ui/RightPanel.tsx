import { useCallback, useEffect, useRef, Suspense } from 'react'
import { useViewStore } from '../../stores/viewStore'
import { SIDEBAR_WIDTH_MAX, SIDEBAR_WIDTH_MIN, usePanelStore } from '../../stores/panelStore'
import { useLibraryStore } from '../../stores/libraryStore'
import { useCardStore, useCard } from '../../stores/cardStore'
import { useIsDarkMode } from '../../hooks/useIsDarkMode'
import { CollapseButton } from './SharedUI'
import { GalleryVerticalEnd, FileText, ArrowLeftToLine, Globe, Compass } from 'lucide-react'
import { WebviewPanel } from './WebviewPanel'
import { CardEditorEntry } from '../editor/CardEditorEntry'
import { LazyAgentReachPanel, preloadAgentReachPanel } from './lazyAgentReachPanel'
import { LazyCardLibraryView } from './lazyCardLibraryView'
import { CardLibrarySkeleton } from './CardLibrarySkeleton'
import { ResponsiveSidePanel } from './ResponsiveSidePanel'
import type { WorkspaceLayoutMode } from '../../hooks/workspaceLayout'


interface RightPanelProps {
  integratedSurface?: boolean
  mode?: WorkspaceLayoutMode
  open?: boolean
  onOpen?: () => void
  onClose?: () => void
  onOpenSettings?: () => void
}

interface BeginRightPanelResizeOptions {
  startX: number
  startWidth: number
  panel: HTMLElement
  onWidthChange: (width: number) => void
  onEnd?: () => void
}

const RESIZING_CHROME_SELECTOR = [
  '.workspace-chrome-strip',
  '.workspace-chrome-corner',
  '.workspace-canvas-aperture',
].join(', ')

const clampRightPanelWidth = (width: number) => Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, width))

export function beginRightPanelResize({ startX, startWidth, panel, onWidthChange, onEnd }: BeginRightPanelResizeOptions) {
  let active = true
  let frameId: number | null = null
  let latestWidth = startWidth
  const chromeSurface = document.querySelector<HTMLElement>('.workspace-chrome-surface')
  const panelContent = panel.querySelector<HTMLElement>('[data-right-panel-content]')
  const initialChromeRight = chromeSurface
    ? Number.parseFloat(getComputedStyle(chromeSurface).getPropertyValue('--workspace-chrome-right'))
    : Number.NaN
  const transitionElements = [panel, ...Array.from(document.querySelectorAll<HTMLElement>(RESIZING_CHROME_SELECTOR))]
  const previousTransitions = transitionElements.map((element) => element.style.transition)

  document.documentElement.dataset.rightPanelResizing = 'true'
  panel.dataset.rightPanelResizing = 'true'
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  transitionElements.forEach((element) => { element.style.transition = 'none' })
  if (panelContent) {
    panelContent.style.width = `${startWidth}px`
    panelContent.style.marginLeft = 'auto'
    panelContent.style.contain = 'layout paint'
  }

  const previewWidth = () => {
    frameId = null
    if (!active) return
    panel.style.width = `${latestWidth}px`
    if (chromeSurface && Number.isFinite(initialChromeRight)) {
      chromeSurface.style.setProperty(
        '--workspace-chrome-right',
        `${initialChromeRight + latestWidth - startWidth}px`,
      )
    }
  }

  const onMove = (event: PointerEvent) => {
    if (!active) return
    latestWidth = clampRightPanelWidth(startWidth + startX - event.clientX)
    if (frameId === null) frameId = requestAnimationFrame(previewWidth)
  }

  const finish = () => {
    if (!active) return
    if (frameId !== null) {
      cancelAnimationFrame(frameId)
      frameId = null
      previewWidth()
    }
    active = false
    onWidthChange(latestWidth)
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', finish)
    document.removeEventListener('pointercancel', finish)
    transitionElements.forEach((element, index) => { element.style.transition = previousTransitions[index] })
    if (panelContent) {
      panelContent.style.width = ''
      panelContent.style.marginLeft = ''
      panelContent.style.contain = ''
    }
    delete document.documentElement.dataset.rightPanelResizing
    delete panel.dataset.rightPanelResizing
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    onEnd?.()
  }

  document.addEventListener('pointermove', onMove)
  document.addEventListener('pointerup', finish)
  document.addEventListener('pointercancel', finish)
  return finish
}

export function RightPanel({ integratedSurface = false, mode = 'wide', open, onOpen, onClose, onOpenSettings }: RightPanelProps) {
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
  const panelOpen = open ?? !rightPanelCollapsed
  const openPanel = onOpen ?? (() => setRightPanelCollapsed(false))
  const closePanel = onClose ?? (() => setRightPanelCollapsed(true))

  const isDragging = useRef(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const expandButtonRef = useRef<HTMLButtonElement>(null)
  const resizeCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => () => resizeCleanupRef.current?.(), [])

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    if (mode === 'narrow' || !panelRef.current) return
    resizeCleanupRef.current?.()
    isDragging.current = true
    resizeCleanupRef.current = beginRightPanelResize({
      startX: e.clientX,
      startWidth: rightPanelWidth,
      panel: panelRef.current,
      onWidthChange: setRightPanelWidth,
      onEnd: () => {
        isDragging.current = false
        resizeCleanupRef.current = null
      },
    })
  }, [mode, rightPanelWidth, setRightPanelWidth])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation()
  }, [])

  if (viewMode !== 'board') return null

  const showEditorTab = rightPanelActiveTab === 'editor' || !!editingCardId
  const showEditorContent = panelOpen && rightPanelActiveTab === 'editor' && editingCardId

  return (
    <>
      <ResponsiveSidePanel
        side="right"
        mode={mode}
        open={panelOpen}
        width={rightPanelWidth}
        label="右侧工作区面板"
        triggerRef={expandButtonRef}
        panelRef={panelRef}
        className={`flex flex-col overflow-hidden ${integratedSurface ? 'workspace-integrated-panel' : 'glass-panel-large'}`}
        style={{ transition: isDragging.current ? 'none' : 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
        onOpenChange={(nextOpen) => nextOpen ? openPanel() : closePanel()}
        onWheel={handleWheel}
      >
        {mode !== 'narrow' && <div
          className="absolute -left-1 top-0 bottom-0 z-20 cursor-col-resize"
          style={{ width: 8 }}
          onPointerDown={handleResizeStart}
        />}

      <div data-right-panel-content className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between px-2.5 py-2 transition-theme">
	        <div
	          className="segmented"
              role="tablist"
              aria-label="右侧面板内容"
	          style={{
	            '--active-index': rightPanelActiveTab === 'library' ? 0 : rightPanelActiveTab === 'channels' ? 1 : 2,
	            '--seg-count': showEditorTab ? 3 : 2,
	          } as React.CSSProperties}
	        >
	          <button
	            onClick={() => setRightPanelActiveTab('library')}
                role="tab"
                aria-selected={rightPanelActiveTab === 'library'}
	            className={`segmented-item cursor-pointer w-[84px] justify-center whitespace-nowrap ${rightPanelActiveTab === 'library' ? 'segmented-item-active' : ''}`}
	          >
	            <GalleryVerticalEnd size={14} />
	            卡片库
	          </button>
	          <button
	            onClick={() => setRightPanelActiveTab('channels')}
                role="tab"
                aria-selected={rightPanelActiveTab === 'channels'}
	            onPointerEnter={preloadAgentReachPanel}
	            onFocus={preloadAgentReachPanel}
	            className={`segmented-item cursor-pointer w-[84px] justify-center whitespace-nowrap ${rightPanelActiveTab === 'channels' ? 'segmented-item-active' : ''}`}
	          >
	            <Compass size={14} />
	            频道
	          </button>
	          {showEditorTab && (
	            <button
	              onClick={() => setRightPanelActiveTab('editor')}
                  role="tab"
                  aria-selected={rightPanelActiveTab === 'editor'}
	              className={`segmented-item cursor-pointer w-[84px] justify-center whitespace-nowrap ${rightPanelActiveTab === 'editor' ? 'segmented-item-active' : ''}`}
	            >
	              <FileText size={14} />
	              编辑
	            </button>
	          )}
	        </div>
        <CollapseButton direction="right" onClick={closePanel} />
	      </div>

      <div className="flex-1 overflow-y-auto">
        {rightPanelActiveTab === 'channels' ? (
          panelOpen && (
            <Suspense
              fallback={(
                <div role="status" aria-label="正在加载频道" className="flex h-full items-center justify-center text-sm text-text-tertiary">
                  正在加载频道…
                </div>
              )}
            >
              <LazyAgentReachPanel />
            </Suspense>
          )
        ) : rightPanelActiveTab === 'library' ? (
          panelOpen && (
            <Suspense fallback={<CardLibrarySkeleton compact />}>
              <LazyCardLibraryView onOpenSettings={onOpenSettings} compact />
            </Suspense>
          )
        ) : showEditorContent ? (
	          <div key={editingCardId} className="h-full">
	            <ClipAwareEditorView
	              cardId={editingCardId!}
	              isClipCard={isClipCard}
	              sourceUrl={editingCard?.sourceUrl}
	              webviewUrl={webviewUrl}
	              setWebviewUrl={setWebviewUrl}
	            />
	          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full animate-fadeIn text-fg-secondary px-6 text-center">
            <FileText size={48} className="mb-4 opacity-30" />
            <p className="text-sm mb-1">选择卡片进行编辑</p>
            <p className="text-xs text-fg-tertiary">拖拽或点击画布上的卡片即可开始编辑</p>
          </div>
        )}
      </div>
      </div>
    </ResponsiveSidePanel>

    {!panelOpen && (
      <button
        ref={expandButtonRef}
        onClick={openPanel}
        aria-label="打开右侧面板"
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
          <CardEditorEntry
            key={cardId}
            entryKey={cardId}
            cardId={cardId}
            content={card.content}
            previewHTML={card.previewHTML}
            onChange={handleChange}
            editable
            theme={isDarkMode ? 'dark' : 'light'}
          />
        )}
      </div>
    </div>
  )
}
