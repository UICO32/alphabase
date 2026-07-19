import { memo } from 'react'
import { Check, Move, Palette, X } from 'lucide-react'
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

const COLOR_LABELS: Record<CardColor, string> = {
  white: '白色',
  red: '红色',
  orange: '橙色',
  yellow: '黄色',
  green: '绿色',
  cyan: '青色',
  blue: '蓝色',
  purple: '紫色',
  pink: '粉色',
  gray: '灰色',
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
  const otherBoards = boards.filter(board => board.id !== activeBoardId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={4}
        className="w-[200px]"
        style={{ backgroundColor: isDarkMode ? '#242426' : '#FFFFFF' }}
      >
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette aria-hidden="true" />
            选择颜色
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            className="min-w-[160px]"
            style={{ backgroundColor: isDarkMode ? '#242426' : '#FFFFFF' }}
          >
            {(Object.keys(CARD_COLORS) as CardColor[]).map(cardColor => (
              <DropdownMenuItem
                key={cardColor}
                aria-label={`卡片颜色：${COLOR_LABELS[cardColor]}`}
                onSelect={() => onColorChange(cardColor)}
              >
                <span
                  aria-hidden="true"
                  className="size-3.5 shrink-0 rounded-full border border-line-default"
                  style={{
                    backgroundColor: isDarkMode
                      ? CARD_COLORS[cardColor].fillDark
                      : CARD_COLORS[cardColor].fillLight,
                  }}
                />
                <span className="flex-1">{COLOR_LABELS[cardColor]}</span>
                {color === cardColor && <Check aria-label="当前颜色" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {otherBoards.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Move aria-hidden="true" />
              移动到画板
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent
              className="min-w-[160px]"
              style={{ backgroundColor: isDarkMode ? '#242426' : '#FFFFFF' }}
            >
              {otherBoards.map(board => (
                <DropdownMenuItem key={board.id} onSelect={() => onMoveToBoard(board.id)}>
                  {board.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={onRemoveFromBoard}
        >
          <X aria-hidden="true" />
          移出白板
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})
