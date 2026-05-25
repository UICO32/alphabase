import { useEmbeddingStore } from '../../stores/embeddingStore'
import { useLibraryStore } from '../../stores/libraryStore'
import { usePanelSurface } from '../../hooks/usePanelSurface'
import { BrainCircuit, LayoutGrid } from 'lucide-react'

export function RelatedCardsTab() {
  const indexed = useEmbeddingStore(s => s.indexed)
  const setSortBy = useLibraryStore(s => s.setSortBy)
  const setViewMode = useLibraryStore(s => s.setViewMode)
  const editingCardId = useLibraryStore(s => s.editingCardId)
  const surface = usePanelSurface()

  const openRelatedSort = () => {
    setSortBy('related')
    setViewMode('cards')
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
        <BrainCircuit size={40} className="mb-3 opacity-30" />
        <p className="text-sm text-center">请在画布上选中一张卡片</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 animate-fadeIn" style={{ color: surface.muted }}>
      <BrainCircuit size={40} className="mb-3 opacity-30" />
      <p className="text-sm text-center mb-4">查找相关卡片</p>
      <button
        onClick={openRelatedSort}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
        style={{ backgroundColor: surface.surface, border: `1px solid ${surface.divider}`, color: surface.text }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = surface.cardHover }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = surface.surface }}
      >
        <LayoutGrid size={16} />
        在卡片库中按相关性排序
      </button>
    </div>
  )
}