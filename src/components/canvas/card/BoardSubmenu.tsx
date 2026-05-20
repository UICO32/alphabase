import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Move } from 'lucide-react'
import { useLibraryStore } from '../../../stores/libraryStore'
import { MenuItem } from './MenuItem'

interface BoardSubmenuProps {
  boards: Array<{ id: string; name: string }>
  onSelect: (boardId: string) => void
}

export function BoardSubmenu({ boards, onSelect }: BoardSubmenuProps) {
  const [hovered, setHovered] = useState(false)
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const triggerRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })

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
    if (left + submenuWidth > window.innerWidth) {
      left = rect.left - submenuWidth - submenuMarginLeft
    }
    setPosition({ top: rect.top, left })
  }, [hovered])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  const submenuContent = hovered ? (
    <div
      className="animate-fadeIn"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 10000,
        minWidth: 160,
        padding: '4px 0',
        borderRadius: 8,
        backgroundColor: isDarkMode ? '#27272a' : '#ffffff',
        border: `1px solid ${isDarkMode ? '#3f3f46' : '#e4e4e7'}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
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
      <div style={{ height: 1, backgroundColor: isDarkMode ? '#3f3f46' : '#e4e4e7', margin: '4px 0' }} />
    </div>
  )
}
