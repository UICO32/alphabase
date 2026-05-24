import { useEffect, useRef } from 'react'
import { useEmbeddingStore } from '../../stores/embeddingStore'
import { useCardStore } from '../../stores/cardStore'
import { useLibraryStore } from '../../stores/libraryStore'
import { usePanelSurface } from '../../hooks/usePanelSurface'
import { Search, Loader2, BrainCircuit } from 'lucide-react'

export function RelatedCardsTab() {
  const editingCardId = useLibraryStore(s => s.editingCardId)
  const { searchResults, searching, indexed, searchRelated, clearResults } = useEmbeddingStore()
  const cards = useCardStore(s => s.cards)
  const surface = usePanelSurface()
  const lastSearchedId = useRef<string | null>(null)

  useEffect(() => {
    if (!editingCardId || !indexed) return
    if (lastSearchedId.current === editingCardId) return
    lastSearchedId.current = editingCardId
    searchRelated(editingCardId)
  }, [editingCardId, indexed, searchRelated])

  useEffect(() => {
    return () => clearResults()
  }, [clearResults])

  const handleResultClick = (cardId: string) => {
    window.dispatchEvent(new CustomEvent('hepta-focus-card', { detail: { cardId } }))
  }

  if (!indexed) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 animate-fadeIn" style={{ color: surface.muted }}>
        <BrainCircuit size={40} className="mb-3 opacity-30" />
        <p className="text-sm text-center">请先在设置中向量化卡片</p>
      </div>
    )
  }

  if (!editingCardId) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 animate-fadeIn" style={{ color: surface.muted }}>
        <Search size={40} className="mb-3 opacity-30" />
        <p className="text-sm text-center">请在画布上选中一张卡片</p>
      </div>
    )
  }

  if (searching) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 animate-fadeIn" style={{ color: surface.muted }}>
        <Loader2 size={28} className="mb-3 animate-spin opacity-50" />
        <p className="text-sm">搜索相关卡片中...</p>
      </div>
    )
  }

  if (searchResults.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 animate-fadeIn" style={{ color: surface.muted }}>
        <Search size={40} className="mb-3 opacity-30" />
        <p className="text-sm text-center">未找到相关卡片</p>
      </div>
    )
  }

  const sourceCard = cards[editingCardId]

  return (
    <div className="flex flex-col h-full">
      {sourceCard && (
        <div className="px-3 py-2 border-b text-xs" style={{ borderColor: surface.divider, color: surface.muted }}>
          基于「{sourceCard.title || '无标题'}」查找相关
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {searchResults.map(({ cardId, score }) => {
          const card = cards[cardId]
          if (!card) return null
          return (
            <button
              key={cardId}
              onClick={() => handleResultClick(cardId)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors cursor-pointer"
              style={{ color: surface.text }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = surface.cardHover
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{card.title || '无标题'}</div>
              </div>
              <span
                className="text-xs shrink-0 px-1.5 py-0.5 rounded"
                style={{ backgroundColor: surface.surface, color: surface.muted }}
              >
                {(score * 100).toFixed(0)}%
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
