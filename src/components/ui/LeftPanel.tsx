import { useCallback } from 'react'
import { usePanelStore } from '../../stores/panelStore'
import { useViewStore } from '../../stores/viewStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useBoardActions } from '../../hooks/useBoardActions'
import { CollapseButton, PanelSeparator } from './SharedUI'
import { BoardList } from './BoardList'
import {
  Layers,
  GalleryVerticalEnd,
  Trash2,
  Bolt,
  Birdhouse,
  ArrowRightToLine,
} from 'lucide-react'

const SIDEBAR_WIDTH = 260

interface LeftPanelProps {
  onOpenSettings?: () => void
  onOpenTrash?: () => void
  onOpenWorkspacePicker?: () => void
}

export function LeftPanel({ onOpenSettings, onOpenTrash, onOpenWorkspacePicker }: LeftPanelProps) {
  const leftPanelCollapsed = usePanelStore(s => s.leftPanelCollapsed)
  const viewMode = useViewStore(s => s.viewMode)
  const setLeftPanelCollapsed = usePanelStore(s => s.setLeftPanelCollapsed)
  const setViewMode = useViewStore(s => s.setViewMode)

  const currentWorkspace = useWorkspaceStore(s => s.currentWorkspace)

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation()
  }, [])

  const {
    boards,
    activeBoardId,
    createBoard,
    renameBoard,
    deleteBoard,
    duplicateBoard,
    switchBoard,
    openInExplorer,
  } = useBoardActions()

  return (
    <>
      <div
        className="absolute left-0 top-0 bottom-0 z-10"
        style={{ width: SIDEBAR_WIDTH, transform: `translateX(${leftPanelCollapsed ? -SIDEBAR_WIDTH : 0}px)`, transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
      >
        <div
          className={`flex flex-col overflow-hidden glass-panel-large h-full ${viewMode !== 'board' ? 'glass-panel-flat' : ''}`}
          onWheel={handleWheel}
        >
          <div className="flex items-center justify-between px-4 py-4 border-b border-line-default transition-theme">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div
                className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer transition-theme hover:opacity-80"
                onClick={onOpenWorkspacePicker}
              >
                <Birdhouse size={18} className="text-fg-secondary" />
                <span className="text-sm font-medium truncate text-fg-primary">
                  {currentWorkspace?.name || '未选择工作区'}
                </span>
              </div>
              <button
                className="p-1.5 rounded-lg cursor-pointer transition-theme hover:opacity-80 text-fg-secondary"
                onClick={onOpenSettings}
              >
                <Bolt size={16} />
              </button>
            </div>
            <CollapseButton direction="left" onClick={() => setLeftPanelCollapsed(true)} />
          </div>

          <div className="segmented m-2">
            <ViewModeButton
              active={viewMode === 'boardLibrary'}
              onClick={() => setViewMode('boardLibrary')}
              icon={<Layers size={14} />}
              label="画板库"
            />
            <ViewModeButton
              active={viewMode === 'cards'}
              onClick={() => setViewMode('cards')}
              icon={<GalleryVerticalEnd size={14} />}
              label="卡片库"
            />
          </div>

          <PanelSeparator />

          <BoardList
            boards={boards}
            activeBoardId={activeBoardId}
            viewMode={viewMode}
            onSwitchBoard={switchBoard}
            onRenameBoard={renameBoard}
            onDeleteBoard={deleteBoard}
            onDuplicateBoard={duplicateBoard}
            onCreateBoard={createBoard}
            onOpenInExplorer={openInExplorer}
          />

          <div className="px-2 py-2">
            <button
              className="btn-base flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer w-full text-fg-secondary"
              onClick={onOpenTrash}
            >
              <Trash2 size={14} />
              <span className="text-sm">回收站</span>
            </button>
          </div>
        </div>
      </div>

      {leftPanelCollapsed && (
        <button
          onClick={() => setLeftPanelCollapsed(false)}
          className="fixed top-10 left-2 z-50 flex items-center justify-center w-10 h-10 rounded-md cursor-pointer shadow-md glass-panel text-fg-secondary border border-line-default"
        >
          <ArrowRightToLine size={16} />
        </button>
      )}
    </>
  )
}

function ViewModeButton({ active, onClick, icon, label }: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`segmented-item flex-1 cursor-pointer ${active ? 'segmented-item-active' : ''}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}