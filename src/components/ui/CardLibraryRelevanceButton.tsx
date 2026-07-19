import { Sparkles } from 'lucide-react'

interface CardLibraryRelevanceButtonProps {
  active: boolean
  indexed: boolean
  editingCardId: string | null
  onActivate: () => void
}

export function CardLibraryRelevanceButton({
  active,
  indexed,
  editingCardId,
  onActivate,
}: CardLibraryRelevanceButtonProps) {
  const disabledReason = !editingCardId
    ? '请先选择一张卡片'
    : !indexed
      ? '卡片索引准备中'
      : undefined

  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={Boolean(disabledReason)}
      title={disabledReason ?? (active ? '已按当前卡片的相关性排序' : '按当前卡片的相关性排序')}
      onClick={onActivate}
      className={`btn-base flex shrink-0 items-center gap-1 whitespace-nowrap px-2 py-1.5 rounded-lg border text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
        active
          ? 'bg-brand text-fg-inverse border-transparent'
          : 'text-fg-secondary bg-surface-card border-line-default hover:bg-surface-panel'
      }`}
    >
      <Sparkles size={12} aria-hidden="true" />
      相关性
    </button>
  )
}
