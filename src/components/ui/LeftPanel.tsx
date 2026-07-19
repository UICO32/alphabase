import { useCallback, useRef } from 'react'
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
import { ResponsiveSidePanel } from './ResponsiveSidePanel'
import type { WorkspaceLayoutMode } from '../../hooks/workspaceLayout'

const SIDEBAR_WIDTH = 260

interface LeftPanelProps {
  integratedSurface?: boolean
  mode?: WorkspaceLayoutMode
  open?: boolean
  onOpen?: () => void
  onClose?: () => void
  onOpenSettings?: () => void
  onOpenTrash?: () => void
  onOpenWorkspacePicker?: () => void
}

export function LeftPanel({ integratedSurface = false, mode = 'wide', open, onOpen, onClose, onOpenSettings, onOpenTrash, onOpenWorkspacePicker }: LeftPanelProps) {
  const leftPanelCollapsed = usePanelStore(s => s.leftPanelCollapsed)
  const viewMode = useViewStore(s => s.viewMode)
  const setLeftPanelCollapsed = usePanelStore(s => s.setLeftPanelCollapsed)
  const setViewMode = useViewStore(s => s.setViewMode)
  const expandButtonRef = useRef<HTMLButtonElement>(null)
  const panelOpen = open ?? !leftPanelCollapsed
  const openPanel = onOpen ?? (() => setLeftPanelCollapsed(false))
  const closePanel = onClose ?? (() => setLeftPanelCollapsed(true))

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
  const panelSurfaceClass = integratedSurface
    ? 'workspace-integrated-panel'
    : `glass-panel-large ${viewMode !== 'board' ? 'glass-panel-flat' : ''}`

  return (
    <>
      <ResponsiveSidePanel
        side="left"
        mode={mode}
        open={panelOpen}
        width={SIDEBAR_WIDTH}
        label="左侧工作区面板"
        triggerRef={expandButtonRef}
        onOpenChange={(nextOpen) => nextOpen ? openPanel() : closePanel()}
        style={{ transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
      >
        <div
          className={`flex flex-col overflow-hidden h-full transition-theme ${panelSurfaceClass}`}
          onWheel={handleWheel}
        >
          <div className="flex items-center justify-between px-3 py-2.5 transition-theme">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <button
                type="button"
                className="interactive-control focus-ring flex items-center gap-2 flex-1 min-w-0 cursor-pointer rounded-md px-1 py-1 text-left hover:bg-surface-card-hover"
                onClick={onOpenWorkspacePicker}
              >
                <Birdhouse size={18} className="text-fg-secondary" />
                <span className="text-sm font-medium truncate text-fg-primary">
                  {currentWorkspace?.name || '未选择工作区'}
                </span>
              </button>
              <button
                className="action-icon-btn p-1.5"
                onClick={onOpenSettings}
                aria-label="打开设置"
              >
                <Bolt size={16} />
              </button>
            </div>
            <CollapseButton direction="left" onClick={closePanel} />
          </div>

          <div
            className="segmented mx-2 mb-1 mt-0.5"
            role="tablist"
            aria-label="内容视图"
            style={{
              '--active-index': viewMode === 'cards' ? 1 : 0,
              '--seg-count': 2,
              '--seg-indicator-opacity': viewMode === 'board' ? 0 : 1,
            } as React.CSSProperties}
          >
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

          <div className="px-2 pb-2 pt-1">
            <button
              className="btn-base flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer w-full text-fg-secondary hover:bg-surface-card-hover hover:text-fg-primary"
              onClick={onOpenTrash}
            >
              <Trash2 size={14} />
              <span className="text-sm">回收站</span>
            </button>
          </div>
        </div>
      </ResponsiveSidePanel>

      {!panelOpen && (
        <button
          ref={expandButtonRef}
          onClick={openPanel}
          aria-label="打开左侧面板"
          className="action-icon-btn workspace-panel-expand-button fixed top-9 left-3 z-50 rounded-lg"
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
      role="tab"
      aria-selected={active}
      className={`segmented-item flex-1 cursor-pointer w-[84px] justify-center whitespace-nowrap ${active ? 'segmented-item-active' : ''}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
