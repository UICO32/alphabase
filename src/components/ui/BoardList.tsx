import { useState, useRef, useEffect, useCallback } from 'react'
import { FileText, Plus, MoreHorizontal, Pencil, Trash, Copy, FolderOpen } from 'lucide-react'
import { PanelSeparator } from './SharedUI'
import { ContextMenu, type ContextMenuItem } from './ContextMenu'

interface Board {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

interface BoardListProps {
  boards: Board[]
  activeBoardId: string | null
  viewMode: string
  onSwitchBoard: (boardId: string) => void
  onRenameBoard: (boardId: string, name: string) => void
  onDeleteBoard: (boardId: string) => boolean
  onDuplicateBoard: (boardId: string) => void
  onCreateBoard: (name: string) => void
  onOpenInExplorer: () => void
}

export function BoardList({
  boards,
  activeBoardId,
  viewMode,
  onSwitchBoard,
  onRenameBoard,
  onDeleteBoard,
  onDuplicateBoard,
  onCreateBoard,
  onOpenInExplorer,
}: BoardListProps) {

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

  useEffect(() => {
    const handleClickOutside = () => setContextMenuBoardId(null)
    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [])

  const handleBoardDoubleClick = useCallback((boardId: string, boardName: string) => {
    setEditingBoardId(boardId)
    setEditingBoardName(boardName)
  }, [])

  const handleBoardContextMenu = useCallback((e: React.MouseEvent, boardId: string) => {
    e.preventDefault()
    setContextMenuBoardId(boardId)
    setContextMenuPos({ x: e.clientX, y: e.clientY })
  }, [])

  const handleRenameSubmit = useCallback((boardId: string) => {
    if (editingBoardName.trim()) {
      onRenameBoard(boardId, editingBoardName.trim())
    }
    setEditingBoardId(null)
    setEditingBoardName('')
  }, [editingBoardName, onRenameBoard])

  const handleCreateSubmit = useCallback(() => {
    const name = newBoardName.trim()
    if (!name) {
      setNewBoardName('')
      setIsCreatingBoard(false)
      return
    }
    onCreateBoard(name)
    setNewBoardName('')
    setIsCreatingBoard(false)
  }, [newBoardName, onCreateBoard])

  const contextMenuItems: ContextMenuItem[] = contextMenuBoardId ? [
    { icon: <Pencil size={12} />, label: '重命名', onClick: () => {
      const board = boards.find(b => b.id === contextMenuBoardId)
      if (board) {
        setEditingBoardId(contextMenuBoardId)
        setEditingBoardName(board.name)
      }
      setContextMenuBoardId(null)
    }},
    { icon: <Trash size={12} />, label: '删除', onClick: () => {
      onDeleteBoard(contextMenuBoardId)
      setContextMenuBoardId(null)
    }},
    { type: 'separator' },
    { icon: <Copy size={12} />, label: '复制画板', onClick: () => {
      onDuplicateBoard(contextMenuBoardId)
      setContextMenuBoardId(null)
    }},
    { type: 'separator' },
    { icon: <FolderOpen size={12} />, label: '在资源管理器中打开', onClick: () => {
      onOpenInExplorer()
      setContextMenuBoardId(null)
    }},
  ] : []

  return (
    <>
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {boards.map((board) => (
          <div key={board.id} className="relative">
            {editingBoardId === board.id ? (
              <input
                ref={editInputRef}
                value={editingBoardName}
                onChange={(e) => setEditingBoardName(e.target.value)}
                onBlur={() => handleRenameSubmit(board.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit(board.id)
                  if (e.key === 'Escape') {
                    setEditingBoardId(null)
                    setEditingBoardName('')
                  }
                }}
                className="input-base w-full px-3 py-2 rounded-lg text-sm outline-none bg-surface-card text-text-primary border border-border-default"
              />
            ) : (
              <div
                className={`hepta-list-item flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer group ${board.id === activeBoardId && viewMode === 'board' ? 'bg-surface-card text-text-primary' : 'text-text-secondary'}`}
                onClick={() => onSwitchBoard(board.id)}
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
                  <MoreHorizontal size={12} className="text-text-secondary" />
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
              onBlur={handleCreateSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateSubmit()
                if (e.key === 'Escape') {
                  setNewBoardName('')
                  setIsCreatingBoard(false)
                }
              }}
              placeholder="输入画板名称..."
              className="input-base w-full px-3 py-2 rounded-lg text-sm outline-none bg-surface-card text-text-primary border border-border-default"
            />
          </div>
        ) : (
          <button
            className="btn-base flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer w-full text-text-secondary"
            onClick={() => setIsCreatingBoard(true)}
          >
            <Plus size={14} />
            <span className="text-sm">新建画板</span>
          </button>
        )}
      </div>

      <PanelSeparator />

      {contextMenuBoardId && (
        <ContextMenu
          x={contextMenuPos.x}
          y={contextMenuPos.y}
          items={contextMenuItems}
          onClose={() => setContextMenuBoardId(null)}
        />
      )}
    </>
  )
}