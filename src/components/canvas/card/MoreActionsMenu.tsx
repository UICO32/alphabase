import { useCallback } from 'react'
import { X } from 'lucide-react'
import { useBoardStore } from '../../../utils/boardStore'
import { useLibraryStore } from '../../../utils/libraryStore'
import { CARD_COLORS, type CardColor } from '../../../types/card'
import { MenuItem } from './MenuItem'
import { BoardSubmenu } from './BoardSubmenu'

interface MoreActionsMenuProps {
  cardId: string
  color: CardColor
  onClose: () => void
  onRemoveFromBoard: () => void
  onMoveToBoard: (boardId: string) => void
  onColorChange: (color: CardColor) => void
}

export function MoreActionsMenu({
  cardId,
  color,
  onClose,
  onRemoveFromBoard,
  onMoveToBoard,
  onColorChange,
}: MoreActionsMenuProps) {
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const boards = useBoardStore(s => s.boards)
  const activeBoardId = useBoardStore(s => s.activeBoardId)

  const handleColorChange = useCallback((c: CardColor) => {
    console.log('[CardActionBar] handleColorChange:', { cardId, color: c })
    onColorChange(c)
  }, [cardId, onColorChange])

  const otherBoards = boards.filter(b => b.id !== activeBoardId)

  return (
    <div
      className="animate-fadeIn"
      style={{
        position: 'absolute',
        top: 0,
        left: '100%',
        zIndex: 50,
        minWidth: 200,
        marginLeft: 4,
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
                console.log('[CardActionBar] color button clicked:', c, 'cardId:', cardId)
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
}