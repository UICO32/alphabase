import { useState, useMemo } from 'react'
import { useViewStore } from '../../stores/viewStore'
import { useBoardStore } from '../../stores/boardStore'
import { useCardStore } from '../../stores/cardStore'
import { SearchInput, EmptyState } from './SharedUI'
import { LayoutGrid } from 'lucide-react'
import { emit } from '../../stores/eventBus'
import { CARD_COLORS, type CardColor } from '../../types/card'
import { useIsDarkMode } from '../../hooks/useIsDarkMode'

/** Mini card dot — shows color accent + truncated title */
function MiniCardDot({ title, color, isDarkMode }: { title?: string; color?: CardColor; isDarkMode: boolean }) {
  const c = CARD_COLORS[color ?? 'white'] ?? CARD_COLORS.white
  const bg = isDarkMode ? c.fillDark : c.fillLight
  const border = c.stroke
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div
        className="w-2.5 h-2.5 rounded-sm shrink-0"
        style={{ backgroundColor: bg, border: `1px solid ${border}` }}
      />
      <span className="text-[11px] text-fg-secondary truncate leading-none">
        {title && title !== '新卡片' ? title : '无标题'}
      </span>
    </div>
  )
}

export function BoardLibraryView() {
  const setViewMode = useViewStore(s => s.setViewMode)
  const boards = useBoardStore(s => s.boards)
  const activeBoardId = useBoardStore(s => s.activeBoardId)
  const boardData = useBoardStore(s => s.boardData)
  const cards = useCardStore(s => s.cards)
  const isDarkMode = useIsDarkMode()

  const [searchQuery, setSearchQuery] = useState('')

  const filteredBoards = useMemo(() => {
    if (!searchQuery.trim()) return boards
    const query = searchQuery.toLowerCase()
    return boards.filter(board =>
      board.name.toLowerCase().includes(query)
    )
  }, [boards, searchQuery])

  const handleBoardClick = (boardId: string) => {
    emit('switch-board', { boardId })
    setViewMode('board')
  }

  // 为每个画板提取卡片预览信息，直接用 useMemo 随 boardData/cards 联动
  const boardPreviews = useMemo(() => {
    const result: Record<string, {
      cardCount: number
      previews: Array<{ id: string; title?: string; color?: CardColor }>
    }> = {}

    for (const board of boards) {
      const data = boardData[board.id]
      if (!data || !data.nodes) {
        result[board.id] = { cardCount: 0, previews: [] }
        continue
      }
      const cardNodes = data.nodes.filter(n => n.type === 'card')
      const previews = cardNodes.slice(0, 4).map(n => {
        const card = cards[n.id]
        return {
          id: n.id,
          title: card?.title,
          color: (n.data as Record<string, unknown>)?.color as CardColor | undefined,
        }
      })
      result[board.id] = { cardCount: cardNodes.length, previews }
    }
    return result
  }, [boards, boardData, cards])

  return (
    <div className="w-full h-full overflow-y-auto bg-surface-panel">
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-fg-primary">
            画板库
          </h1>
          <div className="w-64">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="搜索画板..."
            />
          </div>
        </div>

        {filteredBoards.length === 0 ? (
          <EmptyState
            icon={<LayoutGrid size={48} />}
            text={searchQuery ? '未找到匹配的画板' : '暂无画板'}
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filteredBoards.map((board) => {
              const { cardCount, previews } = boardPreviews[board.id] ?? { cardCount: 0, previews: [] }
              const isActive = board.id === activeBoardId
              return (
                <div
                  key={board.id}
                  onClick={() => handleBoardClick(board.id)}
                  className={`hepta-list-item group relative p-4 rounded-xl cursor-pointer bg-surface-card border border-line-default transition-colors ${isActive ? 'ring-1 ring-line-active' : ''}`}
                >
                  {/* Board name + card count */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-sm font-medium truncate text-fg-primary">
                      {board.name}
                    </span>
                    <span className="text-[11px] shrink-0 text-fg-tertiary">
                      {cardCount} 张卡片
                    </span>
                  </div>

                  {/* Mini card previews */}
                  {previews.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {previews.map(p => (
                        <MiniCardDot key={p.id} title={p.title} color={p.color} isDarkMode={isDarkMode} />
                      ))}
                      {cardCount > 4 && (
                        <span className="text-[10px] text-fg-tertiary">+{cardCount - 4} 更多</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[11px] text-fg-tertiary">空画板</span>
                  )}

                  {/* Date */}
                  <div className="mt-3 text-[10px] text-fg-tertiary">
                    {new Date(board.updatedAt).toLocaleDateString('zh-CN')}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
