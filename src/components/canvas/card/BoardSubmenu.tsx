import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Move } from 'lucide-react'
import { MenuItem } from './MenuItem'

interface BoardSubmenuProps {
  boards: Array<{ id: string; name: string }>
  onSelect: (boardId: string) => void
}

export function BoardSubmenu({ boards, onSelect }: BoardSubmenuProps) {
  const [hovered, setHovered] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [position, setPosition] = useState<{ top: number; left: number; side: 'left' | 'right' }>({ top: 0, left: 0, side: 'right' })

  const scheduleClose = useCallback(() => {
    closeTimerRef.current = setTimeout(() => setHovered(false), 150)
  }, [])

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setHovered(true)
  }, [])

  useEffect(() => {
    if (!hovered || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const submenuWidth = 160
    const submenuMarginLeft = 2
    let left = rect.right + submenuMarginLeft
    let side: 'left' | 'right' = 'right'
    if (left + submenuWidth > window.innerWidth) {
      left = rect.left - submenuWidth - submenuMarginLeft
      side = 'left'
    }
    setPosition({ top: rect.top, left, side })
  }, [hovered])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  const submenuContent = hovered ? (
    <div
      data-board-submenu
      className="ui-floating-surface ui-floating-content overflow-hidden rounded-lg py-1"
      data-side={position.side}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        minWidth: 160,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
    >
      {boards.map((board) => (
        <MenuItem
          key={board.id}
          icon={null}
          label={board.name}
          onClick={() => onSelect(board.id)}
        />
      ))}
    </div>
  ) : null

  return (
    <div
      ref={triggerRef}
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
    >
      <MenuItem
        icon={<Move size={13} />}
        label="移动到画板"
        onClick={() => {}}
        hasSubmenu
      />
      {submenuContent && createPortal(submenuContent, document.body)}
      <div className="my-1 h-px bg-line-default" />
    </div>
  )
}
