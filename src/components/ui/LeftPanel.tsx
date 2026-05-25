import { useCallback } from 'react'
import { motion } from 'framer-motion'
import { useLibraryStore } from '../../stores/libraryStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { usePanelSurface } from '../../hooks/usePanelSurface'
import { useBoardActions } from '../../hooks/useBoardActions'
import { CollapseButton, PanelSeparator } from './SharedUI'
import { BoardList } from './BoardList'
import {
  LayoutGrid,
  Layers,
  Trash2,
  Settings,
  Folder,
  PanelLeftOpen,
} from 'lucide-react'

const SIDEBAR_WIDTH = 260

interface LeftPanelProps {
  onOpenSettings?: () => void
  onOpenTrash?: () => void
  onOpenWorkspacePicker?: () => void
}

export function LeftPanel({ onOpenSettings, onOpenTrash, onOpenWorkspacePicker }: LeftPanelProps) {
  const leftPanelCollapsed = useLibraryStore(s => s.leftPanelCollapsed)
  const viewMode = useLibraryStore(s => s.viewMode)
  const isBoardView = viewMode === 'board'
  const setLeftPanelCollapsed = useLibraryStore(s => s.setLeftPanelCollapsed)
  const setViewMode = useLibraryStore(s => s.setViewMode)

  const currentWorkspace = useWorkspaceStore(s => s.currentWorkspace)

  const surface = usePanelSurface()

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
      <motion.div
        className={`${isBoardView ? 'absolute left-0 top-0 bottom-0 z-10' : 'shrink-0'} flex flex-col h-full overflow-hidden glass-panel-large`}
        style={{ width: SIDEBAR_WIDTH }}
        animate={{ x: leftPanelCollapsed ? -SIDEBAR_WIDTH : 0 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        onWheel={handleWheel}
      >
      <div
        className="flex items-center justify-between px-4 py-3 border-b transition-theme"
        style={{ borderColor: surface.divider }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer transition-theme hover:opacity-80"
            onClick={onOpenWorkspacePicker}
          >
            <Folder size={16} style={{ color: surface.muted }} />
            <span className="text-sm font-medium truncate" style={{ color: surface.text }}>
              {currentWorkspace?.name || '未选择工作区'}
            </span>
          </div>
          <button
            className="p-1.5 rounded-lg cursor-pointer transition-theme hover:opacity-80"
            style={{ color: surface.muted }}
            onClick={onOpenSettings}
          >
            <Settings size={14} />
          </button>
        </div>
        <CollapseButton direction="left" onClick={() => setLeftPanelCollapsed(true)} />
      </div>

            <div className="flex gap-1 p-2">
              <ViewModeButton
                active={viewMode === 'boardLibrary'}
                onClick={() => setViewMode('boardLibrary')}
                icon={<LayoutGrid size={14} />}
                label="画板库"
                surface={surface}
              />
              <ViewModeButton
                active={viewMode === 'cards'}
                onClick={() => setViewMode('cards')}
                icon={<Layers size={14} />}
                label="卡片库"
                surface={surface}
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
                className="btn-base flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer w-full"
                style={{ color: surface.muted }}
                onClick={onOpenTrash}
              >
                <Trash2 size={14} />
                <span className="text-sm">回收站</span>
              </button>
            </div>
          </motion.div>

      {leftPanelCollapsed && (
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          onClick={() => setLeftPanelCollapsed(false)}
          className="fixed top-10 left-2 z-50 flex items-center justify-center h-7 px-2 rounded-md cursor-pointer shadow-md glass-panel"
          style={{
            color: surface.muted,
            border: `1px solid ${surface.divider}`,
          }}
        >
          <PanelLeftOpen size={16} />
        </motion.button>
      )}
    </>
  )
}

function ViewModeButton({ active, onClick, icon, label, surface }: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  surface: ReturnType<typeof usePanelSurface>
}) {
  return (
    <button
      onClick={onClick}
      className="panel-tab panel-tab-hover flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs flex-1 justify-center cursor-pointer"
      style={{
        backgroundColor: active ? surface.surface : 'transparent',
        color: active ? surface.text : surface.muted,
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}