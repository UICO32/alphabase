import { useEffect, useCallback, lazy, Suspense, useState } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ReactFlowCanvas } from './components/canvas/ReactFlowCanvas'
import { LeftPanel } from './components/ui/LeftPanel'
import { RightPanel } from './components/ui/RightPanel'
import { Toolbar } from './components/ui/Toolbar'
import { ClipUrlBar } from './components/ui/ClipUrlBar'
import { TitleBar } from './components/ui/TitleBar'
import { useLibraryStore } from './stores/libraryStore'
import { useCardStore } from './stores/cardStore'
import { useBoardStore } from './stores/boardStore'
import { useTrashStore } from './stores/trashStore'
import { useWorkspaceStore } from './stores/workspaceStore'
import { useEventBus } from './stores/eventBus'
import { useEvent } from './hooks/useEvent'
import { flushActiveSyncEngine, stopActiveSyncEngine } from './sync/syncEngineRef'
import { useWorkspaceDataLoader } from './hooks/useWorkspaceDataLoader'
import { useAppDialogs } from './hooks/useAppDialogs'
import { useAppEvents } from './hooks/useAppEvents'
import { preloadCardEditor } from './components/canvas/card/CardContent'
import { setupAIListeners } from './stores/aiStore'
import { Toaster } from '@/components/ui/shadcn/sonner'

const BoardLibraryView = lazy(() => import('./components/ui/BoardLibraryView').then(m => ({ default: m.BoardLibraryView })))
const CardLibraryView = lazy(() => import('./components/ui/CardLibraryView').then(m => ({ default: m.CardLibraryView })))
const TrashBinPanel = lazy(() => import('./components/ui/TrashBinPanel').then(m => ({ default: m.TrashBinPanel })))
const SettingsDialog = lazy(() => import('./components/ui/SettingsDialog').then(m => ({ default: m.SettingsDialog })))
const WorkspacePicker = lazy(() => import('./components/ui/WorkspacePicker').then(m => ({ default: m.WorkspacePicker })))
const WorkspaceConflictDialog = lazy(() => import('./components/ui/WorkspaceConflictDialog').then(m => ({ default: m.WorkspaceConflictDialog })))
const TopographyView = lazy(() => import('./components/topography/TopographyView').then(m => ({ default: m.TopographyView })))

function App() {
  const viewMode = useLibraryStore(s => s.viewMode)
  const [showTopography, setShowTopography] = useState(false)

  useEffect(() => { setupAIListeners() }, [])

  const {
    showTrash, setShowTrash,
    showSettings, setShowSettings,
    showWorkspacePicker, setShowWorkspacePicker,
    showClipUrlBar, setShowClipUrlBar,
  } = useAppDialogs()
  const { dataReady, conflict, hasBackup, handleConflictChoice } = useWorkspaceDataLoader()

  useAppEvents({ dataReady, setShowWorkspacePicker })

  const emit = useEventBus(s => s.emit)

  useEvent('switch-board', (detail) => {
    if (detail.boardId) {
      useBoardStore.getState().setActiveBoard(detail.boardId)
    }
  })

  useEvent('workspace-changed', async () => {
    emit('save-current-board', undefined)

    await new Promise(r => setTimeout(r, 50))
    await flushActiveSyncEngine()

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
        if (useLibraryStore.getState().editingCardId) return
        const el = document.activeElement
        if (el && el.closest('.card-blocknote-editor')) return
        e.preventDefault()
        useLibraryStore.getState().toggleAllSidebars()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

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

    useLibraryStore.getState().setEditingCardId(cardId)
    useLibraryStore.getState().setRightPanelActiveTab('editor')
  }, [emit])

  const renderMainContent = () => {
    switch (viewMode) {
      case 'boardLibrary':
        return <Suspense fallback={null}><BoardLibraryView /></Suspense>
      case 'cards':
        return <Suspense fallback={null}><CardLibraryView onOpenSettings={() => setShowSettings(true)} /></Suspense>
      case 'board':
      default:
        if (showTopography) {
          return <Suspense fallback={null}><TopographyView /></Suspense>
        }
        return <ReactFlowCanvas />
    }
  }

  const isBoardView = viewMode === 'board'

  useEffect(() => {
    if (!dataReady) return
    preloadCardEditor()
    // Prefetch topography cache so 3D view opens instantly
    import('./components/topography/useClusterData').then(m => m.prefetchTopography())
  }, [dataReady])

  if (!dataReady) return null

  return (
    <ErrorBoundary>
    <div className="w-full h-full flex flex-col" style={{ backgroundColor: 'var(--surface-panel)' }}>
      <Toaster position="bottom-center" richColors />
      <TitleBar />
      <div className={`flex-1 min-h-0 ${isBoardView ? 'relative' : 'flex'}`}>
        <LeftPanel
          onOpenSettings={() => setShowSettings(true)}
          onOpenTrash={() => setShowTrash(true)}
          onOpenWorkspacePicker={() => setShowWorkspacePicker(true)}
        />

        <main
          className={`${isBoardView ? 'absolute inset-0 rounded-lg mx-0.5 mb-0.5' : 'flex-1 rounded-lg m-0.5'} overflow-hidden`}
          style={{ backgroundColor: (isBoardView && showTopography) ? '#0a0f2e' : 'var(--surface-app)', transition: 'background-color 0.4s ease', borderRadius: 0 }}
        >
          {renderMainContent()}
        </main>

        {isBoardView && <RightPanel onOpenSettings={() => setShowSettings(true)} />}
      </div>

      {isBoardView && (
        <Toolbar
          onAddCard={handleAddCard}
          onClipUrl={() => setShowClipUrlBar(true)}
          showTopography={showTopography}
          onToggleTopography={() => setShowTopography(v => !v)}
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
            onChoice={handleConflictChoice}
          />
        </Suspense>
      )}
    </div>
    </ErrorBoundary>
  )
}

export default App