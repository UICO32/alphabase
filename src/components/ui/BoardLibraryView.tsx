import { useState, useMemo } from 'react'
import { useLibraryStore } from '../../utils/libraryStore'
import { useBoardStore } from '../../utils/boardStore'
import { getPanelSurface } from '../../theme/panelSurface'
import { SearchInput, EmptyState } from './SharedUI'
import { LayoutGrid, FileText } from 'lucide-react'

export function BoardLibraryView() {
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const setViewMode = useLibraryStore(s => s.setViewMode)
  const boards = useBoardStore(s => s.boards)
  const activeBoardId = useBoardStore(s => s.activeBoardId)

  const surface = getPanelSurface(isDarkMode)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredBoards = useMemo(() => {
    if (!searchQuery.trim()) return boards
    const query = searchQuery.toLowerCase()
    return boards.filter(board =>
      board.name.toLowerCase().includes(query)
    )
  }, [boards, searchQuery])

  const handleBoardClick = (boardId: string) => {
    window.dispatchEvent(new CustomEvent('hepta-switch-board', { detail: { boardId } }))
    setViewMode('board')
  }

  return (
    <div className="w-full h-full flex flex-col p-6" style={{ backgroundColor: surface.panelBg }}>
      {/* 标题和搜索 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold" style={{ color: surface.text }}>
          画板库
        </h1>
        <div className="w-64">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="搜索画板..."
            surface={surface}
          />
        </div>
      </div>

      {/* 画板网格 */}
      {filteredBoards.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid size={48} />}
          text={searchQuery ? '未找到匹配的画板' : '暂无画板'}
          surface={surface}
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredBoards.map((board) => (
            <div
              key={board.id}
              onClick={() => handleBoardClick(board.id)}
              className="group relative p-4 rounded-xl cursor-pointer transition-all hover:shadow-lg"
              style={{
                backgroundColor: surface.surface,
                border: `1px solid ${board.id === activeBoardId ? surface.text : surface.divider}`,
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: surface.panelBg }}
                >
                  <FileText size={20} style={{ color: surface.muted }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm font-medium truncate"
                    style={{ color: surface.text }}
                  >
                    {board.name}
                  </div>
                  <div className="text-xs" style={{ color: surface.muted }}>
                    {new Date(board.updatedAt).toLocaleDateString('zh-CN')}
                  </div>
                </div>
              </div>
              <div className="text-xs" style={{ color: surface.muted }}>
                {new Date(board.createdAt).toLocaleDateString('zh-CN')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
