import { useState, useMemo } from 'react'
import { useViewStore } from '../../stores/viewStore'
import { useBoardStore } from '../../stores/boardStore'
import { useCardStore } from '../../stores/cardStore'
import { SearchInput, EmptyState } from './SharedUI'
import { LayoutGrid } from 'lucide-react'
import { emit } from '../../stores/eventBus'
import { CARD_COLORS, DEFAULT_CARD_HEIGHT, DEFAULT_CARD_WIDTH, type CardColor } from '../../types/card'
import { useIsDarkMode } from '../../hooks/useIsDarkMode'

type PreviewNode = {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
  width?: number
  height?: number
}

type PreviewEdge = {
  id: string
  source: string
  target: string
}

function getNodeSize(node: PreviewNode) {
  return {
    width: (node.data?.width as number | undefined) ?? node.width ?? DEFAULT_CARD_WIDTH,
    height: node.data?.collapsed
      ? 80
      : ((node.data?.height as number | undefined) ?? node.height ?? DEFAULT_CARD_HEIGHT),
  }
}

function BoardMiniMap({
  nodes,
  edges,
  cards,
  isDarkMode,
}: {
  nodes: PreviewNode[]
  edges: PreviewEdge[]
  cards: ReturnType<typeof useCardStore.getState>['cards']
  isDarkMode: boolean
}) {
  const cardNodes = nodes.filter(n => n.type === 'card')

  const layout = useMemo(() => {
    if (cardNodes.length === 0) return null

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const node of cardNodes) {
      const size = getNodeSize(node)
      minX = Math.min(minX, node.position.x)
      minY = Math.min(minY, node.position.y)
      maxX = Math.max(maxX, node.position.x + size.width)
      maxY = Math.max(maxY, node.position.y + size.height)
    }

    const padding = 40
    const width = Math.max(maxX - minX, 1)
    const height = Math.max(maxY - minY, 1)
    const viewW = width + padding * 2
    const viewH = height + padding * 2

    const project = (x: number, y: number) => ({
      x: x - minX + padding,
      y: y - minY + padding,
    })

    return { viewW, viewH, project }
  }, [cardNodes])

  if (!layout) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl bg-surface-panel/60 text-[11px] text-fg-tertiary">
        空画板
      </div>
    )
  }

  const nodeById = new Map(cardNodes.map(n => [n.id, n]))

  return (
    <div className="relative h-full overflow-hidden rounded-xl bg-surface-panel/60">
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${layout.viewW} ${layout.viewH}`} preserveAspectRatio="xMidYMid meet">
        {edges.map(edge => {
          const source = nodeById.get(edge.source)
          const target = nodeById.get(edge.target)
          if (!source || !target) return null

          const sourceSize = getNodeSize(source)
          const targetSize = getNodeSize(target)
          const a = layout.project(source.position.x + sourceSize.width / 2, source.position.y + sourceSize.height / 2)
          const b = layout.project(target.position.x + targetSize.width / 2, target.position.y + targetSize.height / 2)
          const midX = (a.x + b.x) / 2

          return (
            <path
              key={edge.id}
              d={`M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`}
              fill="none"
              stroke="var(--line-default)"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.75"
            />
          )
        })}
        {cardNodes.map(node => {
          const size = getNodeSize(node)
          const p = layout.project(node.position.x, node.position.y)
          const cardId = (node.data?.cardId as string | undefined) ?? node.id
          const card = cards[cardId]
          const color = (node.data?.color as CardColor | undefined) ?? card?.color ?? 'white'
          const c = CARD_COLORS[color] ?? CARD_COLORS.white
          const fill = isDarkMode ? c.fillDark : c.fillLight
          const text = isDarkMode ? c.textDark : c.textLight
          const line = isDarkMode ? c.mutedDark : c.mutedLight
          const title = card?.title && card.title !== '新卡片' ? card.title : '无标题'

          return (
            <g key={node.id} transform={`translate(${p.x} ${p.y})`}>
              <rect
                width={size.width}
                height={size.height}
                rx="16"
                fill={fill}
                filter="drop-shadow(0 10px 18px rgba(0,0,0,0.10))"
              />
              <rect x="18" y="18" width={Math.min(size.width - 36, Math.max(60, title.length * 10))} height="10" rx="5" fill={text} opacity="0.58" />
              <rect x="18" y="42" width={size.width * 0.64} height="7" rx="3.5" fill={line} opacity="0.45" />
              <rect x="18" y="58" width={size.width * 0.46} height="7" rx="3.5" fill={line} opacity="0.32" />
              {size.height > 150 && <rect x="18" y="74" width={size.width * 0.55} height="7" rx="3.5" fill={line} opacity="0.24" />}
            </g>
          )
        })}
      </svg>
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

  const boardPreviews = useMemo(() => {
    const result: Record<string, {
      cardCount: number
      nodes: PreviewNode[]
      edges: PreviewEdge[]
    }> = {}

    for (const board of boards) {
      const data = boardData[board.id]
      if (!data || !data.nodes) {
        result[board.id] = { cardCount: 0, nodes: [], edges: [] }
        continue
      }
      const nodes = data.nodes.filter(n => n.type === 'card') as PreviewNode[]
      const nodeIds = new Set(nodes.map(n => n.id))
      const edges = (data.edges ?? []).filter(e => nodeIds.has(e.source) && nodeIds.has(e.target)) as PreviewEdge[]
      result[board.id] = { cardCount: nodes.length, nodes, edges }
    }
    return result
  }, [boards, boardData])

  return (
    <div className="w-full h-full overflow-y-auto bg-surface-panel">
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold text-fg-primary">
            画板库
          </h1>
          <div className="w-full sm:w-72">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filteredBoards.map((board) => {
              const preview = boardPreviews[board.id] ?? { cardCount: 0, nodes: [], edges: [] }
              const isActive = board.id === activeBoardId
              return (
                <div
                  key={board.id}
                  onClick={() => handleBoardClick(board.id)}
                  className={`group relative cursor-pointer rounded-2xl bg-surface-card p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-card-hover hover:shadow-md ${isActive ? 'bg-surface-card-hover' : ''}`}
                >
                  <div className="aspect-[4/3] w-full overflow-hidden rounded-xl">
                    <BoardMiniMap
                      nodes={preview.nodes}
                      edges={preview.edges}
                      cards={cards}
                      isDarkMode={isDarkMode}
                    />
                  </div>

                  <div className="mt-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-fg-primary">{board.name}</div>
                      <div className="mt-1 text-[11px] text-fg-tertiary">
                        {new Date(board.updatedAt).toLocaleDateString('zh-CN')}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-surface-panel px-2 py-0.5 text-[11px] text-fg-tertiary">
                      {preview.cardCount} 张
                    </span>
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
