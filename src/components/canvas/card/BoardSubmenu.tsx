import { useState } from 'react'
import { Move } from 'lucide-react'
import { useLibraryStore } from '../../../utils/libraryStore'
import { MenuItem } from './MenuItem'

interface BoardSubmenuProps {
  boards: Array<{ id: string; name: string }>
  onSelect: (boardId: string) => void
}

export function BoardSubmenu({ boards, onSelect }: BoardSubmenuProps) {
  const [hovered, setHovered] = useState(false)
  const isDarkMode = useLibraryStore(s => s.isDarkMode)

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <MenuItem
        icon={<Move size={13} />}
        label="移动到画板"
        onClick={() => {}}
        hasSubmenu
      />
      {hovered && (
        <div
          className="animate-fadeIn"
          style={{
            position: 'absolute',
            top: 0,
            left: '100%',
            zIndex: 51,
            marginLeft: 2,
            minWidth: 160,
            padding: '4px 0',
            borderRadius: 8,
            backgroundColor: isDarkMode ? '#27272a' : '#ffffff',
            border: `1px solid ${isDarkMode ? '#3f3f46' : '#e4e4e7'}`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}
          onClick={(e) => e.stopPropagation()}
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
      )}
      <div style={{ height: 1, backgroundColor: isDarkMode ? '#3f3f46' : '#e4e4e7', margin: '4px 0' }} />
    </div>
  )
}