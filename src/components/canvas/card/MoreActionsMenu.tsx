import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useBoardStore } from '../../../stores/boardStore'
import { useLibraryStore } from '../../../stores/libraryStore'
import { CARD_COLORS, type CardColor } from '../../../types/card'
import { MenuItem } from './MenuItem'
import { BoardSubmenu } from './BoardSubmenu'

interface MoreActionsMenuProps {
  color: CardColor
  onClose: () => void
  onRemoveFromBoard: () => void
  onMoveToBoard: (boardId: string) => void
  onColorChange: (color: CardColor) => void
  triggerRef: React.RefObject<HTMLDivElement | null>
}

export function MoreActionsMenu({
  color,
  onClose,
  onRemoveFromBoard,
  onMoveToBoard,
  onColorChange,
  triggerRef,
}: MoreActionsMenuProps) {
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const boards = useBoardStore(s => s.boards)
  const activeBoardId = useBoardStore(s => s.activeBoardId)
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  const handleColorChange = useCallback((c: CardColor) => {
    onColorChange(c)
  }, [onColorChange])

  const otherBoards = boards.filter(b => b.id !== activeBoardId)

  useEffect(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const menuWidth = 200
    const menuMarginLeft = 4
    let left = rect.right + menuMarginLeft
    if (left + menuWidth > window.innerWidth) {
      left = rect.left - menuWidth - menuMarginLeft
    }
    setPosition({ top: rect.top, left })
  }, [triggerRef])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target) &&
        !document.querySelector('[data-board-submenu]')?.contains(target)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose, triggerRef])

  const menuContent = (
    <div
      ref={menuRef}
      className="animate-fadeIn"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 9999,
        minWidth: 200,
        padding: '6px 0',
        borderRadius: 8,
        backgroundColor: isDarkMode ? '#27272a' : '#ffffff',
        border: `1px solid ${isDarkMode ? '#3f3f46' : '#e4e4e7'}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ padding: '6px 12px' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>颜色</div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(CARD_COLORS) as CardColor[]).map((c) => (
            <button
              key={c}
              onClick={(e) => {
                e.stopPropagation()
                handleColorChange(c)
              }}
              className="rounded-full border-2 cursor-pointer"
              style={{
                width: 20,
                height: 20,
                backgroundColor: isDarkMode ? CARD_COLORS[c].fillDark : CARD_COLORS[c].fillLight,
                borderColor: color === c ? CARD_COLORS[c].stroke : 'transparent',
                boxShadow: color === c ? `0 0 0 1.5px ${CARD_COLORS[c].stroke}` : 'none',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ height: 1, backgroundColor: isDarkMode ? '#3f3f46' : '#e4e4e7', margin: '4px 0' }} />

      {otherBoards.length > 0 && (
        <BoardSubmenu
          boards={otherBoards}
          onSelect={(boardId) => {
            onMoveToBoard(boardId)
            onClose()
          }}
        />
      )}

      <MenuItem
        icon={<X size={13} />}
        label="移出白板"
        onClick={() => {
          onRemoveFromBoard()
          onClose()
        }}
        danger
      />
    </div>
  )

  return createPortal(menuContent, document.body)
}
