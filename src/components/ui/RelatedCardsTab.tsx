import { useEmbeddingStore } from '../../stores/embeddingStore'
import { useLibraryStore } from '../../stores/libraryStore'
import { BrainCircuit, LayoutGrid } from 'lucide-react'

export function RelatedCardsTab() {
  const indexed = useEmbeddingStore(s => s.indexed)
  const setSortBy = useLibraryStore(s => s.setSortBy)
  const setViewMode = useLibraryStore(s => s.setViewMode)
  const editingCardId = useLibraryStore(s => s.editingCardId)

  const openRelatedSort = () => {
    setSortBy('related')
    setViewMode('cards')
  }

  if (!indexed) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 animate-fadeIn text-text-secondary">
        <BrainCircuit size={40} className="mb-3 opacity-30" />
        <p className="text-sm text-center">请先在设置中向量化卡片</p>
      </div>
    )
  }

  if (!editingCardId) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 animate-fadeIn text-text-secondary">
        <BrainCircuit size={40} className="mb-3 opacity-30" />
        <p className="text-sm text-center">请在画布上选中一张卡片</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 animate-fadeIn text-text-secondary">
      <BrainCircuit size={40} className="mb-3 opacity-30" />
      <p className="text-sm text-center mb-4">查找相关卡片</p>
      <button
        onClick={openRelatedSort}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-surface-card border border-border-default text-text-primary hover:bg-surface-card-hover"
      >
        <LayoutGrid size={16} />
        在卡片库中按相关性排序
      </button>
    </div>
  )
}
