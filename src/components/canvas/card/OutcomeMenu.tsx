import { memo } from 'react'
import { Star, Check, X } from 'lucide-react'
import { useBoardStore } from '../../../stores/boardStore'
import { useProjectStore } from '../../../stores/projectStore'
import { useThemeStore } from '../../../stores/themeStore'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/shadcn/dropdown-menu'

interface OutcomeMenuProps {
  cardId: string
}

/**
 * 卡片右上角「标记为成果」按钮（★）：
 * - 当前画布不是主题画布 → 不渲染
 * - 未标记：弹出问题列表，选择即标记
 * - 已标记：显示所属问题（可转移）+ 「移出成果」
 */
export const OutcomeMenu = memo(function OutcomeMenu({ cardId }: OutcomeMenuProps) {
  const activeBoardId = useBoardStore((s) => s.activeBoardId)
  const project = useProjectStore((s) => (activeBoardId ? s.projects[activeBoardId] : undefined))
  const isDarkMode = useThemeStore((s) => s.isDarkMode)

  // 非主题画布：不提供成果操作
  if (!project) return null

  const myOutcome = project.outcomes.find((o) => o.nodeId === cardId)
  const isOutcome = !!myOutcome

  const handleSelect = (questionId: string) => {
    if (!activeBoardId) return
    useProjectStore.getState().addOutcome(activeBoardId, cardId, 'card', questionId)
  }
  const handleRemove = () => {
    if (!activeBoardId || !myOutcome) return
    useProjectStore.getState().removeOutcome(activeBoardId, myOutcome.id)
  }

  const menuClass = 'w-[200px]'
  const menuStyle = { backgroundColor: isDarkMode ? '#242426' : '#FFFFFF' }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="outcome-menu-trigger"
          className="action-icon-btn"
          style={{ width: 24, height: 24, cursor: 'pointer', color: isOutcome ? 'var(--brand)' : undefined }}
          onClick={(e) => e.stopPropagation()}
          title={isOutcome ? '成果 · 点击管理' : '标记为成果'}
        >
          <Star size={14} fill={isOutcome ? 'currentColor' : 'none'} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className={menuClass} style={menuStyle}>
        {isOutcome ? (
          <>
            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-fg-tertiary">
              成果 · 所属问题
            </div>
            {project.questions.length === 0 ? (
              <DropdownMenuItem disabled>问题已被删除</DropdownMenuItem>
            ) : (
              project.questions.map((q) => (
                <DropdownMenuItem key={q.id} onSelect={() => handleSelect(q.id)}>
                  <span className="flex-1 truncate">{q.title}</span>
                  {myOutcome.questionId === q.id && <Check aria-hidden="true" className="text-accent-blue" />}
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={handleRemove}
            >
              <X aria-hidden="true" />
              移出成果
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-fg-tertiary">
              标记为成果 · 选择问题
            </div>
            {project.questions.length === 0 ? (
              <DropdownMenuItem disabled>还没有问题，先在顶部主题栏添加</DropdownMenuItem>
            ) : (
              project.questions.map((q) => (
                <DropdownMenuItem key={q.id} onSelect={() => handleSelect(q.id)}>
                  <Star size={12} aria-hidden="true" className="shrink-0 text-accent-blue" />
                  <span className="flex-1 truncate">{q.title}</span>
                </DropdownMenuItem>
              ))
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
})
