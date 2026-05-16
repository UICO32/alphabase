import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLibraryStore } from '../../utils/libraryStore'
import { useBoardStore } from '../../utils/boardStore'
import { useWorkspaceStore } from '../../utils/workspace/workspaceStore'
import { getPanelSurface } from '../../theme'
import { CollapseButton, PanelSeparator } from './SharedUI'
import {
  LayoutGrid,
  Layers,
  FileText,
  Plus,
  Trash2,
  Settings,
  Folder,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash,
  FolderOpen,
  ChevronRight,
} from 'lucide-react'

const SIDEBAR_WIDTH = 260

interface LeftPanelProps {
  onOpenSettings?: () => void
  onOpenTrash?: () => void
  onOpenWorkspacePicker?: () => void
}

export function LeftPanel({ onOpenSettings, onOpenTrash, onOpenWorkspacePicker }: LeftPanelProps) {
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const leftPanelCollapsed = useLibraryStore(s => s.leftPanelCollapsed)
  const setLeftPanelCollapsed = useLibraryStore(s => s.setLeftPanelCollapsed)
  const viewMode = useLibraryStore(s => s.viewMode)
  const setViewMode = useLibraryStore(s => s.setViewMode)

  const boards = useBoardStore(s => s.boards)
  const activeBoardId = useBoardStore(s => s.activeBoardId)

  const currentWorkspace = useWorkspaceStore(s => s.currentWorkspace)

  const surface = getPanelSurface(isDarkMode)

  const [newBoardName, setNewBoardName] = useState('')
  const [isCreatingBoard, setIsCreatingBoard] = useState(false)
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null)
  const [editingBoardName, setEditingBoardName] = useState('')
  const [contextMenuBoardId, setContextMenuBoardId] = useState<string | null>(null)
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 })

  const newBoardInputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isCreatingBoard && newBoardInputRef.current) {
      newBoardInputRef.current.focus()
    }
  }, [isCreatingBoard])

  useEffect(() => {
    if (editingBoardId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingBoardId])

  const handleBoardClick = useCallback((boardId: string) => {
    if (boardId === activeBoardId && viewMode === 'board') return
    if (viewMode !== 'board') setViewMode('board')
    window.dispatchEvent(new CustomEvent('hepta-switch-board', { detail: { boardId } }))
  }, [activeBoardId, viewMode, setViewMode])

  const handleBoardDoubleClick = useCallback((boardId: string, boardName: string) => {
    setEditingBoardId(boardId)
    setEditingBoardName(boardName)
  }, [])

  const handleBoardContextMenu = useCallback((e: React.MouseEvent, boardId: string) => {
    e.preventDefault()
    setContextMenuBoardId(boardId)
    setContextMenuPos({ x: e.clientX, y: e.clientY })
  }, [])

  const handleRenameBoard = useCallback((boardId: string) => {
    if (editingBoardName.trim()) {
      useBoardStore.getState().updateBoard(boardId, { name: editingBoardName.trim() })
    }
    setEditingBoardId(null)
    setEditingBoardName('')
  }, [editingBoardName])

  const handleDeleteBoard = useCallback((boardId: string) => {
    if (boards.length <= 1) {
      alert('至少保留一个画板')
      return
    }
    const board = boards.find(b => b.id === boardId)
    if (window.confirm(`确定删除画板「${board?.name || boardId}」？`)) {
      useBoardStore.getState().deleteBoard(boardId)
      if (activeBoardId === boardId) {
        const remaining = boards.filter(b => b.id !== boardId)
        if (remaining.length > 0) {
          window.dispatchEvent(new CustomEvent('hepta-switch-board', {
            detail: { boardId: remaining[0].id }
          }))
        }
      }
    }
    setContextMenuBoardId(null)
  }, [boards, activeBoardId])

  const handleDuplicateBoard = useCallback((boardId: string) => {
    const board = boards.find(b => b.id === boardId)
    if (board) {
      const newBoard = {
        ...board,
        id: crypto.randomUUID(),
        name: `${board.name} (副本)`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      useBoardStore.getState().addBoard(newBoard)
    }
    setContextMenuBoardId(null)
  }, [boards])

  const handleCreateBoard = useCallback(() => {
    const name = newBoardName.trim()
    if (!name) {
      setNewBoardName('')
      setIsCreatingBoard(false)
      return
    }
    const newBoard = {
      id: crypto.randomUUID(),
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const boardStore = useBoardStore.getState()
    boardStore.addBoard(newBoard)
    boardStore.saveBoardData(newBoard.id, { nodes: [], edges: [] })
    setNewBoardName('')
    setIsCreatingBoard(false)
    if (viewMode !== 'board') setViewMode('board')
    window.dispatchEvent(new CustomEvent('hepta-switch-board', { detail: { boardId: newBoard.id } }))
  }, [newBoardName, viewMode, setViewMode])

  const handleOpenInExplorer = useCallback(() => {
    if (currentWorkspace?.path) {
      window.dispatchEvent(new CustomEvent('hepta-open-in-explorer', {
        detail: { path: currentWorkspace.path }
      }))
    }
    setContextMenuBoardId(null)
  }, [currentWorkspace])

  useEffect(() => {
    const handleClickOutside = () => setContextMenuBoardId(null)
    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [])

  return (
    <>
      <AnimatePresence initial={false}>
        {!leftPanelCollapsed && (
          <motion.div
            key="left-panel"
            className="flex flex-col h-full border-r absolute left-0 top-0 z-10 overflow-hidden"
            style={{
              width: SIDEBAR_WIDTH,
              backgroundColor: surface.panelBg,
              borderColor: surface.divider,
            }}
            initial={{ x: -SIDEBAR_WIDTH, opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -SIDEBAR_WIDTH, opacity: 0.8 }}
            transition={{
              type: 'spring',
              stiffness: 380,
              damping: 32,
              mass: 0.8,
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-3 border-b transition-theme"
              style={{ borderColor: surface.divider }}
            >
              <div
                className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer transition-theme hover:opacity-80"
                onClick={onOpenWorkspacePicker || onOpenSettings}
              >
                <Folder size={16} style={{ color: surface.muted }} />
                <span className="text-sm font-medium truncate" style={{ color: surface.text }}>
                  {currentWorkspace?.name || '未选择工作区'}
                </span>
                <Settings size={14} style={{ color: surface.muted }} />
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

            <div className="flex-1 overflow-y-auto px-2 py-1">
              {boards.map((board) => (
                <div key={board.id} className="relative">
                  {editingBoardId === board.id ? (
                    <input
                      ref={editInputRef}
                      value={editingBoardName}
                      onChange={(e) => setEditingBoardName(e.target.value)}
                      onBlur={() => handleRenameBoard(board.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameBoard(board.id)
                        if (e.key === 'Escape') {
                          setEditingBoardId(null)
                          setEditingBoardName('')
                        }
                      }}
                      className="input-base w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{
                        backgroundColor: surface.surface,
                        color: surface.text,
                        border: `1px solid ${surface.divider}`,
                      }}
                    />
                  ) : (
                    <div
                      className="list-item flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer group"
                      style={{
                        backgroundColor: board.id === activeBoardId && viewMode === 'board'
                          ? surface.surface
                          : 'transparent',
                        color: board.id === activeBoardId && viewMode === 'board'
                          ? surface.text
                          : surface.muted,
                      }}
                      onClick={() => handleBoardClick(board.id)}
                      onDoubleClick={() => handleBoardDoubleClick(board.id, board.name)}
                      onContextMenu={(e) => handleBoardContextMenu(e, board.id)}
                    >
                      <div className="flex items-center gap-2">
                        <FileText size={14} />
                        <span className="text-sm truncate">{board.name}</span>
                      </div>
                      <button
                        className="opacity-0 group-hover:opacity-100 p-1 rounded transition-theme hover:bg-black/5"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleBoardContextMenu(e, board.id)
                        }}
                      >
                        <MoreHorizontal size={12} style={{ color: surface.muted }} />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {isCreatingBoard ? (
                <div className="px-1 py-1">
                  <input
                    ref={newBoardInputRef}
                    value={newBoardName}
                    onChange={(e) => setNewBoardName(e.target.value)}
                    onBlur={handleCreateBoard}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateBoard()
                      if (e.key === 'Escape') {
                        setNewBoardName('')
                        setIsCreatingBoard(false)
                      }
                    }}
                    placeholder="输入画板名称..."
                    className="input-base w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{
                      backgroundColor: surface.surface,
                      color: surface.text,
                      border: `1px solid ${surface.divider}`,
                    }}
                  />
                </div>
              ) : (
                <button
                  className="btn-base flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer w-full"
                  style={{ color: surface.muted }}
                  onClick={() => setIsCreatingBoard(true)}
                >
                  <Plus size={14} />
                  <span className="text-sm">新建画板</span>
                </button>
              )}
            </div>

            <PanelSeparator />

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

            {contextMenuBoardId && (
              <ContextMenu
                x={contextMenuPos.x}
                y={contextMenuPos.y}
                surface={surface}
                items={[
                  { icon: <Pencil size={12} />, label: '重命名', onClick: () => {
                    const board = boards.find(b => b.id === contextMenuBoardId)
                    if (board) {
                      setEditingBoardId(contextMenuBoardId)
                      setEditingBoardName(board.name)
                    }
                    setContextMenuBoardId(null)
                  }},
                  { icon: <Trash size={12} />, label: '删除', onClick: () => handleDeleteBoard(contextMenuBoardId) },
                  { type: 'separator' },
                  { icon: <Copy size={12} />, label: '复制画板', onClick: () => handleDuplicateBoard(contextMenuBoardId) },
                  { type: 'separator' },
                  { icon: <FolderOpen size={12} />, label: '在资源管理器中打开', onClick: handleOpenInExplorer },
                ]}
                onClose={() => setContextMenuBoardId(null)}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed trigger button */}
      <AnimatePresence>
        {leftPanelCollapsed && (
          <motion.button
            key="left-trigger"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            onClick={() => setLeftPanelCollapsed(false)}
            className="fixed top-3 left-3 z-50 flex items-center justify-center w-9 h-9 rounded-xl cursor-pointer shadow-lg"
            style={{
              backgroundColor: surface.panelBg,
              color: surface.text,
              border: `1px solid ${surface.divider}`,
            }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
          >
            <ChevronRight size={16} />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  )
}

function ViewModeButton({ active, onClick, icon, label, surface }: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  surface: ReturnType<typeof getPanelSurface>
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

interface ContextMenuItem {
  icon?: React.ReactNode
  label?: string
  onClick?: () => void
  type?: 'separator'
}

function ContextMenu({ x, y, surface, items, onClose }: {
  x: number
  y: number
  surface: ReturnType<typeof getPanelSurface>
  items: ContextMenuItem[]
  onClose: () => void
}) {
  return (
    <div
      className="fixed z-50 py-1 rounded-lg min-w-[160px] animate-scaleIn"
      style={{
        left: x,
        top: y,
        backgroundColor: surface.panelBg,
        border: `1px solid ${surface.divider}`,
        boxShadow: surface.shadow,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) =>
        item.type === 'separator' ? (
          <div key={i} className="h-px my-1" style={{ backgroundColor: surface.divider }} />
        ) : (
          <button
            key={i}
            className="btn-base flex items-center gap-2 px-3 py-1.5 w-full text-left text-sm"
            style={{ color: surface.text }}
            onClick={() => {
              item.onClick?.()
              onClose()
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        )
      )}
    </div>
  )
}
