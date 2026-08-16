import { useEffect, useCallback, lazy, Suspense, useState } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ReactFlowCanvas } from './components/canvas/ReactFlowCanvas'
import { LeftPanel } from './components/ui/LeftPanel'
import { RightPanel } from './components/ui/RightPanel'
import { Toolbar } from './components/ui/Toolbar'
import { ClipUrlBar } from './components/ui/ClipUrlBar'
import { TitleBar } from './components/ui/TitleBar'
import { WorkspaceChromeSurface } from './components/ui/WorkspaceChromeSurface'
import { useViewStore } from './stores/viewStore'
import { usePanelStore } from './stores/panelStore'
import { useCardStore } from './stores/cardStore'
import { useBoardStore } from './stores/boardStore'
import { useTrashStore } from './stores/trashStore'
import { useWorkspaceStore } from './stores/workspaceStore'
import { emit } from './stores/eventBus'
import { useEvent } from './hooks/useEvent'
import { flushActiveSyncEngine, stopActiveSyncEngine } from './sync/syncEngineRef'
import { cleanupSubscriptions } from './sync/subscriptionManager'
import { useWorkspaceDataLoader } from './hooks/useWorkspaceDataLoader'
import { useAppDialogs } from './hooks/useAppDialogs'
import { useAppEvents } from './hooks/useAppEvents'
import { preloadCardEditor } from './components/editor/cardEditorLoader'
import { LazyCardLibraryView } from './components/ui/lazyCardLibraryView'
import { setupAIListeners } from './stores/aiStore'
import { Toaster } from '@/components/ui/shadcn/sonner'
import { useWorkspaceLayout } from './hooks/useWorkspaceLayout'
import { TopicBar } from './components/project/TopicBar'

const LEFT_PANEL_WIDTH = 260
const TITLE_BAR_HEIGHT = 24
const CANVAS_CHROME_GAP = 8

const BoardLibraryView = lazy(() => import('./components/ui/BoardLibraryView').then(m => ({ default: m.BoardLibraryView })))
const TrashBinPanel = lazy(() => import('./components/ui/TrashBinPanel').then(m => ({ default: m.TrashBinPanel })))
const SettingsDialog = lazy(() => import('./components/ui/SettingsDialog').then(m => ({ default: m.SettingsDialog })))
const WorkspacePicker = lazy(() => import('./components/ui/WorkspacePicker').then(m => ({ default: m.WorkspacePicker })))
const WorkspaceConflictDialog = lazy(() => import('./components/ui/WorkspaceConflictDialog').then(m => ({ default: m.WorkspaceConflictDialog })))
const TopographyView = lazy(() => import('./components/topography/TopographyView').then(m => ({ default: m.TopographyView })))

function App() {
  const viewMode = useViewStore(s => s.viewMode)
  const [showTopography, setShowTopography] = useState(false)
  const workspaceLayout = useWorkspaceLayout()

  useEffect(() => { setupAIListeners() }, [])

  const {
    showTrash, setShowTrash,
    showSettings, setShowSettings,
    showWorkspacePicker, setShowWorkspacePicker,
    showClipUrlBar, setShowClipUrlBar,
  } = useAppDialogs()
  const { dataReady, conflict, hasBackup, latestBackupSummary, handleConflictChoice } = useWorkspaceDataLoader()

  useAppEvents({ dataReady, setShowWorkspacePicker })

  useEvent('switch-board', (detail) => {
    if (detail.boardId) {
      useBoardStore.getState().setActiveBoard(detail.boardId)
    }
  })

  useEvent('workspace-changed', async () => {
    emit('save-current-board', undefined)

    await new Promise(r => setTimeout(r, 50))
    await flushActiveSyncEngine()
    cleanupSubscriptions()

    useViewStore.getState().setViewMode('board')
    await stopActiveSyncEngine()
    useCardStore.setState({ cards: {}, isLoaded: false })
    useBoardStore.setState({ boards: [], activeBoardId: null, isLoaded: false, boardData: {} })
    useTrashStore.setState({ items: [] })
    emit('reinit-workspace', undefined)
  })

  useEvent('select-folder', async () => {
    try {
      let folderPath: string | null = null

      const electronAPI = window.electronAPI
      if (electronAPI?.dialog?.openDirectory) {
        const result = await electronAPI.dialog.openDirectory()
        if (result) {
          folderPath = result
        }
      }

      if (!folderPath && typeof (window as unknown as { showDirectoryPicker?: (options?: { mode?: string }) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker === 'function') {
        try {
          const dirHandle = await (window as unknown as { showDirectoryPicker: (options?: { mode?: string }) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ mode: 'readwrite' })
          folderPath = dirHandle.name
        } catch {
          // User cancelled
        }
      }

      if (folderPath) {
        const name = folderPath.split(/[\\/]/).filter(Boolean).pop() || '未命名工作区'
        const workspaceMeta = {
          path: folderPath,
          name,
          lastOpened: Date.now(),
        }
        useWorkspaceStore.getState().setCurrentWorkspace(workspaceMeta)
        useWorkspaceStore.getState().addRecentWorkspace(workspaceMeta)
        localStorage.setItem('hepta-last-workspace-path', folderPath)
        setShowWorkspacePicker(false)
        emit('workspace-changed', { path: folderPath })
      }
    } catch (e) {
      console.error('Failed to select folder:', e)
    }
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && !e.repeat) {
        if (document.querySelector('[role="dialog"][data-state="open"]')) return
        if (useViewStore.getState().editingCardId) return
        const el = document.activeElement
        if (el && el.closest('.card-blocknote-editor')) return
        e.preventDefault()
        workspaceLayout.toggleAllPanels()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [workspaceLayout.toggleAllPanels])

  const handleAddCard = useCallback(() => {
    const cardId = crypto.randomUUID()
    useCardStore.getState().addCard({
      id: cardId,
      content: '[{"type":"paragraph","content":[{"type":"text","text":""}]}]',
      color: 'white',
      createdAt: Date.now(),
      title: '新卡片',
    })

    emit('add-card-node', { cardId, color: 'white' })

    useViewStore.getState().setEditingCardId(cardId)
    usePanelStore.getState().setRightPanelActiveTab('editor')
  }, [emit])

  const renderMainContent = () => {
    switch (viewMode) {
      case 'boardLibrary':
        return <Suspense fallback={null}><BoardLibraryView /></Suspense>
      case 'cards':
        return <Suspense fallback={null}><LazyCardLibraryView onOpenSettings={() => setShowSettings(true)} /></Suspense>
      case 'board':
      default:
        if (showTopography) {
          return <Suspense fallback={null}><TopographyView /></Suspense>
        }
        return <ReactFlowCanvas />
    }
  }

  const isBoardView = viewMode === 'board'
  const rightPanelWidth = usePanelStore(s => s.rightPanelWidth)
  // 非画板视图下，左侧面板展开时主内容向右平移 260px，与 LeftPanel translateX 同步动画
  const mainPaddingLeft = (!isBoardView && workspaceLayout.mode !== 'narrow' && workspaceLayout.leftOpen) ? LEFT_PANEL_WIDTH : 0
  const immersiveCanvas = isBoardView && !workspaceLayout.leftOpen && !workspaceLayout.rightOpen
  const embeddedCanvas = isBoardView && !immersiveCanvas
  const titleBarVisible = !isBoardView || embeddedCanvas
  const contentTop = titleBarVisible ? TITLE_BAR_HEIGHT : 0
  const chromeInsets = {
    top: CANVAS_CHROME_GAP,
    right: workspaceLayout.mode === 'narrow' || !workspaceLayout.rightOpen ? CANVAS_CHROME_GAP : rightPanelWidth + CANVAS_CHROME_GAP,
    bottom: CANVAS_CHROME_GAP,
    left: workspaceLayout.mode === 'narrow' || !workspaceLayout.leftOpen ? CANVAS_CHROME_GAP : LEFT_PANEL_WIDTH + CANVAS_CHROME_GAP,
  }

  useEffect(() => {
    if (!dataReady) return
    preloadCardEditor()
    // Delay topography prefetch so it doesn't compete with initial canvas render
    const timer = setTimeout(() => {
      import('./components/topography/useClusterData').then(m => m.prefetchTopography())
    }, 1500)
    return () => clearTimeout(timer)
  }, [dataReady])

  if (!dataReady) return null

  return (
    <ErrorBoundary>
    <div className="relative w-full h-full overflow-hidden" style={{ backgroundColor: 'var(--surface-panel)' }}>
      <Toaster position="bottom-center" richColors visibleToasts={1} duration={5000} />
      <div
        className={`group absolute left-0 right-0 top-0 z-50 overflow-visible transition-[height] duration-150 ${immersiveCanvas ? 'h-2 hover:h-6' : 'h-6 workspace-chrome-piece'}`}
      >
        <div className={`transition-opacity duration-150 ${immersiveCanvas ? 'workspace-chrome-piece opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
          <TitleBar />
        </div>
      </div>
      <div
        className="absolute left-0 right-0 bottom-0"
        style={{
          top: contentTop,
          transition: 'top 0.16s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <LeftPanel
          integratedSurface={embeddedCanvas}
          mode={workspaceLayout.mode}
          open={workspaceLayout.leftOpen}
          onOpen={() => workspaceLayout.openPanel('left')}
          onClose={() => workspaceLayout.closePanel('left')}
          onOpenSettings={() => setShowSettings(true)}
          onOpenTrash={() => setShowTrash(true)}
          onOpenWorkspacePicker={() => setShowWorkspacePicker(true)}
        />

        <main
          className="absolute left-0 right-0 bottom-0 top-0 overflow-hidden"
          style={{
            backgroundColor: (isBoardView && showTopography) ? '#0a0f2e' : 'var(--surface-app)',
            transition: 'background-color 0.4s ease, padding-left 0.16s cubic-bezier(0.4, 0, 0.2, 1)',
            paddingLeft: mainPaddingLeft,
          }}
        >
          {/* 顶部主题栏：悬浮按钮方案——悬浮胶囊浮在画布上方，不占布局，画布圆角完整保留 */}
          {isBoardView && !showTopography && <TopicBar />}

          {renderMainContent()}
        </main>

        {embeddedCanvas && (
          <WorkspaceChromeSurface {...chromeInsets} />
        )}

        {isBoardView && (
          <RightPanel
            integratedSurface={embeddedCanvas}
            mode={workspaceLayout.mode}
            open={workspaceLayout.rightOpen}
            onOpen={() => workspaceLayout.openPanel('right')}
            onClose={() => workspaceLayout.closePanel('right')}
            onOpenSettings={() => setShowSettings(true)}
          />
        )}
      </div>

      {isBoardView && (
        <Toolbar
          onAddCard={handleAddCard}
          onClipUrl={() => setShowClipUrlBar(true)}
          showTopography={showTopography}
          onToggleTopography={() => setShowTopography(v => !v)}
          onOpenRightPanel={() => workspaceLayout.openPanel('right')}
        />
      )}

      {showTrash && (
        <Suspense fallback={null}><TrashBinPanel onClose={() => setShowTrash(false)} /></Suspense>
      )}
      <Suspense fallback={null}><SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} /></Suspense>
      {showWorkspacePicker && (
        <Suspense fallback={null}><WorkspacePicker onClose={() => setShowWorkspacePicker(false)} /></Suspense>
      )}
      {isBoardView && <ClipUrlBar open={showClipUrlBar} onClose={() => setShowClipUrlBar(false)} />}

      {conflict && (
        <Suspense fallback={null}>
          <WorkspaceConflictDialog
            conflict={conflict}
            hasBackup={hasBackup}
            latestBackup={latestBackupSummary}
            onChoice={handleConflictChoice}
          />
        </Suspense>
      )}
    </div>
    </ErrorBoundary>
  )
}

export default App
