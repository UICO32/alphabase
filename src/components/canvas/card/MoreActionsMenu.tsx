import { memo } from 'react'
import { X, Move } from 'lucide-react'
import { useBoardStore } from '../../../stores/boardStore'
import { useThemeStore } from '../../../stores/themeStore'
import { CARD_COLORS, type CardColor } from '../../../types/card'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/shadcn/dropdown-menu'

interface MoreActionsMenuProps {
  color: CardColor
  onRemoveFromBoard: () => void
  onMoveToBoard: (boardId: string) => void
  onColorChange: (color: CardColor) => void
  children: React.ReactNode
}

export const MoreActionsMenu = memo(function MoreActionsMenu({
  color,
  onRemoveFromBoard,
  onMoveToBoard,
  onColorChange,
  children,
}: MoreActionsMenuProps) {
  const isDarkMode = useThemeStore(s => s.isDarkMode)
  const boards = useBoardStore(s => s.boards)
  const activeBoardId = useBoardStore(s => s.activeBoardId)
  const otherBoards = boards.filter(b => b.id !== activeBoardId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={4}
        className="w-[200px]"
      >
        <div className="px-2 py-1.5">
          <div className="text-xs text-fg-secondary mb-1.5">颜色</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(CARD_COLORS) as CardColor[]).map((c) => (
              <button
                key={c}
                onClick={() => onColorChange(c)}
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

        <DropdownMenuSeparator />

        {otherBoards.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-xs">
              <Move size={13} />
              移动到画板
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-[160px]">
              {otherBoards.map((board) => (
                <DropdownMenuItem
                  key={board.id}
                  className="text-xs"
                  onClick={() => onMoveToBoard(board.id)}
                >
                  {board.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="text-xs text-destructive focus:text-destructive"
          onClick={onRemoveFromBoard}
        >
          <X size={13} />
          移出白板
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})
