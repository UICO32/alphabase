import { useState, useEffect, useCallback } from 'react'
import { ReactFlowCanvas } from './components/canvas/ReactFlowCanvas'
import { LeftPanel } from './components/ui/LeftPanel'
import { LeftPanelCollapsed } from './components/ui/LeftPanelCollapsed'
import { RightPanel } from './components/ui/RightPanel'
import { RightPanelCollapsed } from './components/ui/RightPanelCollapsed'
import { BoardLibraryView } from './components/ui/BoardLibraryView'
import { CardLibraryView } from './components/ui/CardLibraryView'
import { TrashBinPanel } from './components/ui/TrashBinPanel'
import { SettingsDialog } from './components/ui/SettingsDialog'
import { WorkspacePicker } from './components/ui/WorkspacePicker'
import { Toolbar } from './components/ui/Toolbar'
import { useLibraryStore } from './utils/libraryStore'
import { useCardStore } from './utils/cardStore'
import { useBoardStore } from './utils/boardStore'

function App() {
  const leftPanelCollapsed = useLibraryStore(s => s.leftPanelCollapsed)
  const rightPanelCollapsed = useLibraryStore(s => s.rightPanelCollapsed)
  const viewMode = useLibraryStore(s => s.viewMode)
  const [showTrash, setShowTrash] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showWorkspacePicker, setShowWorkspacePicker] = useState(false)

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
      variant: 'solid',
      createdAt: Date.now(),
      title: '新卡片',
    })

    window.dispatchEvent(new CustomEvent('hepta-add-card-node', { detail: { cardId, color: 'blue', variant: 'solid' } }))

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
    <div className="w-full h-full flex">
      {leftPanelCollapsed ? (
        <LeftPanelCollapsed />
      ) : (
        <LeftPanel
          onOpenSettings={() => setShowSettings(true)}
          onOpenTrash={() => setShowTrash(true)}
        />
      )}

      <main className="flex-1 relative">
        {renderMainContent()}
      </main>

      {viewMode === 'board' && (
        rightPanelCollapsed ? (
          <RightPanelCollapsed />
        ) : (
          <RightPanel />
        )
      )}

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
