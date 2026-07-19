import { useState, useRef, useEffect, useCallback, type CSSProperties } from 'react'
import { Layers2, Plus, MoreHorizontal, Pencil, Trash, Copy, FolderOpen } from 'lucide-react'
import { PanelSeparator } from './SharedUI'
import type { ContextMenuItem } from './ContextMenu'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem as ContextMenuItemComp,
  ContextMenuSeparator,
} from '@/components/ui/shadcn/context-menu'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem as DropdownMenuItemComp,
  DropdownMenuSeparator,
} from '@/components/ui/shadcn/dropdown-menu'

const BOARD_MENU_CONTENT_CLASS = 'min-w-44 rounded-lg border-line-default bg-surface-card text-fg-primary shadow-lg'
const BOARD_MENU_ITEM_CLASS = 'gap-2 rounded-md text-fg-primary focus:bg-surface-card-hover focus:text-fg-primary'
const BOARD_MENU_DESTRUCTIVE_CLASS = `${BOARD_MENU_ITEM_CLASS} text-destructive focus:text-destructive`
const BOARD_MENU_SEPARATOR_CLASS = 'bg-line-default'

function BoardMenuEntries({ items, variant }: { items: ContextMenuItem[]; variant: 'context' | 'dropdown' }) {
  return items.map((item, index) => {
    if (item.type === 'separator') {
      return variant === 'context'
        ? <ContextMenuSeparator key={index} className={BOARD_MENU_SEPARATOR_CLASS} />
        : <DropdownMenuSeparator key={index} className={BOARD_MENU_SEPARATOR_CLASS} />
    }

    const className = item.danger ? BOARD_MENU_DESTRUCTIVE_CLASS : BOARD_MENU_ITEM_CLASS
    return variant === 'context' ? (
      <ContextMenuItemComp key={index} onClick={item.onClick} className={className}>
        {item.icon}
        <span>{item.label}</span>
      </ContextMenuItemComp>
    ) : (
      <DropdownMenuItemComp key={index} onClick={item.onClick} className={className}>
        {item.icon}
        <span>{item.label}</span>
      </DropdownMenuItemComp>
    )
  })
}

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

  const handleBoardDoubleClick = useCallback((boardId: string, boardName: string) => {
    setEditingBoardId(boardId)
    setEditingBoardName(boardName)
  }, [])

  const boardContextMenuItems = useCallback((boardId: string): ContextMenuItem[] => [
    { icon: <Pencil className="size-4 shrink-0" />, label: '重命名', onClick: () => {
      const board = boards.find(b => b.id === boardId)
      if (board) {
        setEditingBoardId(boardId)
        setEditingBoardName(board.name)
      }
    }},
    { icon: <Trash className="size-4 shrink-0" />, label: '删除', danger: true, onClick: () => {
      onDeleteBoard(boardId)
    }},
    { type: 'separator' },
    { icon: <Copy className="size-4 shrink-0" />, label: '复制画板', onClick: () => {
      onDuplicateBoard(boardId)
    }},
    { type: 'separator' },
    { icon: <FolderOpen className="size-4 shrink-0" />, label: '在资源管理器中打开', onClick: () => {
      onOpenInExplorer()
    }},
  ], [boards, onDeleteBoard, onDuplicateBoard, onOpenInExplorer])

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

  return (
    <>
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {boards.map((board, index) => {
          const menuItems = boardContextMenuItems(board.id)
          return (
          <div key={board.id} className="relative stagger-item" style={{ '--stagger': Math.min(index, 8) } as CSSProperties}>
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
                className="input-base w-full px-3 py-2 rounded-lg text-sm outline-none bg-surface-card text-fg-primary border border-line-default"
              />
            ) : (
              <ContextMenu>
                <ContextMenuTrigger asChild>
                <div
                  className={`hepta-list-item hepta-list-item-indicator flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer group ${board.id === activeBoardId && viewMode === 'board' ? 'is-selected' : 'text-fg-secondary'}`}
                  aria-current={board.id === activeBoardId && viewMode === 'board' ? 'page' : undefined}
                  onClick={() => onSwitchBoard(board.id)}
                  onDoubleClick={() => handleBoardDoubleClick(board.id, board.name)}
                >
                  <div className="flex items-center gap-2">
                    <Layers2 size={14} />
                    <span className="text-sm truncate">{board.name}</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="opacity-0 group-hover:opacity-100 p-1 rounded outline-none transition-theme hover:bg-surface-card-hover focus-visible:bg-surface-card-hover focus-visible:ring-1 focus-visible:ring-line-default"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal size={12} className="text-fg-secondary" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className={BOARD_MENU_CONTENT_CLASS}>
                      <BoardMenuEntries items={menuItems} variant="dropdown" />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                </ContextMenuTrigger>
                <ContextMenuContent className={BOARD_MENU_CONTENT_CLASS}>
                  <BoardMenuEntries items={menuItems} variant="context" />
                </ContextMenuContent>
              </ContextMenu>
            )}
          </div>
          )
        })}

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
              className="input-base w-full px-3 py-2 rounded-lg text-sm outline-none bg-surface-card text-fg-primary border border-line-default"
            />
          </div>
        ) : (
          <button
            className="btn-base flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer w-full text-fg-secondary"
            onClick={() => setIsCreatingBoard(true)}
          >
            <Plus size={14} />
            <span className="text-sm">新建画板</span>
          </button>
        )}
      </div>

      <PanelSeparator />
    </>
  )
}
