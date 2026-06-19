import { useState, useMemo } from 'react'
import { useViewStore } from '../../stores/viewStore'
import { useBoardStore } from '../../stores/boardStore'
import { SearchInput, EmptyState } from './SharedUI'
import { LayoutGrid, FileText } from 'lucide-react'
import { emit } from '../../stores/eventBus'

export function BoardLibraryView() {
  const setViewMode = useViewStore(s => s.setViewMode)
  const boards = useBoardStore(s => s.boards)
  const activeBoardId = useBoardStore(s => s.activeBoardId)

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

  return (
    <div className="w-full h-full overflow-y-auto bg-surface-panel">
      <div className="max-w-5xl mx-auto p-6">
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredBoards.map((board) => (
              <div
                key={board.id}
                onClick={() => handleBoardClick(board.id)}
                className={`hepta-list-item group relative p-4 rounded-xl cursor-pointer bg-surface-card border ${board.id === activeBoardId ? 'border-text-primary' : 'border-line-default'}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center bg-surface-panel"
                  >
                    <FileText size={20} className="text-fg-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-medium truncate text-fg-primary"
                    >
                      {board.name}
                    </div>
                    <div className="text-xs text-fg-secondary">
                      {new Date(board.updatedAt).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-fg-secondary">
                  {new Date(board.createdAt).toLocaleDateString('zh-CN')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
