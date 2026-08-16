import { Sparkles } from 'lucide-react'

interface CardLibraryRelevanceButtonProps {
  active: boolean
  indexed: boolean
  indexing?: boolean
  progress?: number
  total?: number
  indexError?: string | null
  editingCardId: string | null
  onActivate: () => void
}

function getIndexStatus({
  indexing,
  progress,
  total,
  indexError,
}: Pick<CardLibraryRelevanceButtonProps, 'indexing' | 'progress' | 'total' | 'indexError'>) {
  if (indexing) {
    return total && total > 0
      ? `正在建立卡片索引 ${progress ?? 0}/${total}`
      : '正在建立卡片索引'
  }
  if (indexError === 'model-missing') return '请先在设置中下载向量模型'
  if (indexError === 'model-timeout') return '向量模型加载超时，请在设置中重试'
  if (indexError) return '卡片索引初始化失败，请在设置中重试'
  return '卡片索引尚未建立'
}

export function CardLibraryRelevanceButton({
  active,
  indexed,
  indexing = false,
  progress = 0,
  total = 0,
  indexError = null,
  editingCardId,
  onActivate,
}: CardLibraryRelevanceButtonProps) {
  const disabledReason = active
    ? undefined
    : !editingCardId
      ? '请先选择一张卡片'
      : !indexed
        ? getIndexStatus({ indexing, progress, total, indexError })
        : undefined

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={disabledReason ? `相关性：${disabledReason}` : '按当前卡片的相关性排序'}
      disabled={Boolean(disabledReason)}
      title={disabledReason ?? (active ? '已按当前卡片的相关性排序' : '按当前卡片的相关性排序')}
      onClick={() => onActivate()}
      className={`btn-base flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border px-2 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
        active
          ? 'border-transparent bg-brand text-fg-inverse'
          : 'border-line-default bg-surface-card text-fg-secondary hover:bg-surface-panel'
      }`}
    >
      <Sparkles size={12} aria-hidden="true" />
      相关性
    </button>
  )
}
