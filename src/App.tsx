import { useState, useEffect, useCallback } from 'react'
import { ReactFlowCanvas } from './components/canvas/ReactFlowCanvas'
import { LeftPanel } from './components/ui/LeftPanel'
import { RightPanel } from './components/ui/RightPanel'
import { BoardLibraryView } from './components/ui/BoardLibraryView'
import { CardLibraryView } from './components/ui/CardLibraryView'
import { TrashBinPanel } from './components/ui/TrashBinPanel'
import { SettingsDialog } from './components/ui/SettingsDialog'
import { WorkspacePicker } from './components/ui/WorkspacePicker'
import { Toolbar } from './components/ui/Toolbar'
import { useLibraryStore } from './utils/libraryStore'
import { useCardStore } from './utils/cardStore'
import { useBoardStore } from './utils/boardStore'
import { useTrashStore } from './utils/trashStore'
import { useWorkspaceStore } from './utils/workspace/workspaceStore'
import { stopActiveSyncEngine } from './utils/syncEngineRef'
import { useWorkspaceDataLoader } from './hooks/useWorkspaceDataLoader'

function App() {
  const viewMode = useLibraryStore(s => s.viewMode)
  const leftPanelCollapsed = useLibraryStore(s => s.leftPanelCollapsed)
  const [showTrash, setShowTrash] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showWorkspacePicker, setShowWorkspacePicker] = useState(false)
  const currentWorkspace = useWorkspaceStore(s => s.currentWorkspace)
  const { dataReady } = useWorkspaceDataLoader()

  useEffect(() => {
    if (dataReady) {
      window.dispatchEvent(new CustomEvent('hepta-data-ready'))
    }
  }, [dataReady])

  useEffect(() => {
    const savedPath = localStorage.getItem('hepta-last-workspace-path')
    if (savedPath && !currentWorkspace) {
      const name = savedPath.split(/[\\/]/).filter(Boolean).pop() || '未命名工作区'
      useWorkspaceStore.getState().setCurrentWorkspace({
        path: savedPath,
        name,
        lastOpened: Date.now(),
      })
      useWorkspaceStore.getState().addRecentWorkspace({
        path: savedPath,
        name,
        lastOpened: Date.now(),
      })
    }
  }, [])

  useEffect(() => {
    if (!currentWorkspace) {
      setShowWorkspacePicker(true)
    }
  }, [currentWorkspace])

  useEffect(() => {
    const handleBoardSwitch = (e: Event) => {
      const boardId = (e as CustomEvent).detail?.boardId
      if (boardId) {
        useBoardStore.getState().setActiveBoard(boardId)
      }
    }
    window.addEventListener('hepta-switch-board', handleBoardSwitch)
    return () => window.removeEventListener('hepta-switch-board', handleBoardSwitch)
  }, [])

  useEffect(() => {
    const handleWorkspaceChanged = () => {
      stopActiveSyncEngine()
      useCardStore.setState({ cards: {}, isLoaded: false })
      useBoardStore.setState({ boards: [], activeBoardId: null, isLoaded: false, boardData: {} })
      useTrashStore.setState({ items: [] })
      window.dispatchEvent(new CustomEvent('hepta-reinit-workspace'))
    }
    window.addEventListener('hepta-workspace-changed', handleWorkspaceChanged)
    return () => window.removeEventListener('hepta-workspace-changed', handleWorkspaceChanged)
  }, [])

  useEffect(() => {
    const handleSelectFolder = async () => {
      try {
        let folderPath: string | null = null

        const electronAPI = (window as any).electronAPI
        if (electronAPI?.dialog?.openDirectory) {
          const result = await electronAPI.dialog.openDirectory()
          if (result) {
            folderPath = typeof result === 'string' ? result : result.canceled ? null : result.filePaths?.[0] || null
          }
        }

        if (!folderPath && typeof (window as any).showDirectoryPicker === 'function') {
          try {
            const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
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
          window.dispatchEvent(new CustomEvent('hepta-workspace-changed', { detail: { path: folderPath } }))
        }
      } catch (e) {
        console.error('Failed to select folder:', e)
      }
    }
    window.addEventListener('hepta-select-folder', handleSelectFolder as EventListener)
    return () => window.removeEventListener('hepta-select-folder', handleSelectFolder as EventListener)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && !e.repeat) {
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
      color: 'blue',
      createdAt: Date.now(),
      title: '新卡片',
    })

    window.dispatchEvent(new CustomEvent('hepta-add-card-node', { detail: { cardId, color: 'blue' } }))

    useLibraryStore.getState().setEditingCardId(cardId)
    useLibraryStore.getState().setRightPanelActiveTab('editor')
  }, [])

  const renderMainContent = () => {
    switch (viewMode) {
      case 'boardLibrary':
        return <BoardLibraryView />
      case 'cards':
        return <CardLibraryView />
      case 'board':
      default:
        return (
          <>
            <ReactFlowCanvas />
            <Toolbar onAddCard={handleAddCard} />
          </>
        )
    }
  }

  return (
    <div className="w-full h-full flex relative transition-theme" style={{ backgroundColor: 'var(--surface-app)' }}>
      <LeftPanel
        onOpenSettings={() => setShowSettings(true)}
        onOpenTrash={() => setShowTrash(true)}
        onOpenWorkspacePicker={() => setShowWorkspacePicker(true)}
      />

      <main
        className="flex-1 relative"
        style={{
          paddingLeft: viewMode !== 'board' && !leftPanelCollapsed ? 260 : 0,
        }}
      >
        {renderMainContent()}
      </main>

      {viewMode === 'board' && <RightPanel />}

      {showTrash && (
        <TrashBinPanel onClose={() => setShowTrash(false)} />
      )}
      {showSettings && (
        <SettingsDialog onClose={() => setShowSettings(false)} />
      )}
      {showWorkspacePicker && (
        <WorkspacePicker onClose={() => setShowWorkspacePicker(false)} />
      )}
    </div>
  )
}

export default App