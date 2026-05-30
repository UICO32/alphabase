import { useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { Node, ReactFlowInstance } from '@xyflow/react'
import {
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
} from 'lucide-react'
import { computeAlignment, type AlignmentMode, computeBoundingBox } from '../../utils/alignment'

interface AlignmentToolbarProps {
  selectedNodes: Node[]
  reactFlowInstance: React.RefObject<ReactFlowInstance | null>
  onApplyAlignment: (updates: Map<string, { x: number; y: number }>) => void
}

const ALIGN_ITEMS: { mode: AlignmentMode; Icon: typeof AlignStartHorizontal; title: string; group: 'align' | 'distribute' }[] = [
  { mode: 'left', Icon: AlignStartVertical, title: '左对齐', group: 'align' },
  { mode: 'centerH', Icon: AlignCenterVertical, title: '水平居中', group: 'align' },
  { mode: 'right', Icon: AlignEndVertical, title: '右对齐', group: 'align' },
  { mode: 'top', Icon: AlignStartHorizontal, title: '上对齐', group: 'align' },
  { mode: 'centerV', Icon: AlignCenterHorizontal, title: '垂直居中', group: 'align' },
  { mode: 'bottom', Icon: AlignEndHorizontal, title: '下对齐', group: 'align' },
  { mode: 'distributeH', Icon: AlignHorizontalDistributeCenter, title: '水平等间距', group: 'distribute' },
  { mode: 'distributeV', Icon: AlignVerticalDistributeCenter, title: '垂直等间距', group: 'distribute' },
]

export function AlignmentToolbar({ selectedNodes, reactFlowInstance, onApplyAlignment }: AlignmentToolbarProps) {
  const canDistribute = selectedNodes.length >= 3

  const position = useMemo(() => {
    const rf = reactFlowInstance.current
    if (!rf || selectedNodes.length === 0) return null

    const box = computeBoundingBox(selectedNodes)
    const topLeft = rf.flowToScreenPosition({ x: box.minX, y: box.minY })
    const bottomRight = rf.flowToScreenPosition({ x: box.maxX, y: box.maxY })

    const centerX = (topLeft.x + bottomRight.x) / 2
    const aboveY = topLeft.y - 8
    const belowY = bottomRight.y + 8

    const toolbarAbove = aboveY >= 48
    const y = toolbarAbove ? aboveY : belowY

    return { x: centerX, y }
  }, [selectedNodes, reactFlowInstance])

  const handleClick = useCallback((mode: AlignmentMode) => {
    const updates = computeAlignment(selectedNodes, mode)
    onApplyAlignment(updates)
  }, [selectedNodes, onApplyAlignment])

  if (!position || selectedNodes.length < 2) return null

  const toolbar = (
    <div
      className="fixed z-40 flex items-center gap-0.5 px-1.5 py-1.5 rounded-lg animate-fadeInUp bg-surface-card border border-border-default"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {ALIGN_ITEMS.map((item, i) => {
        const isDivider = i === 6
        const disabled = item.group === 'distribute' && !canDistribute
        return (
          <span key={item.mode} className="contents">
            {isDivider && (
              <div className="w-px h-4 mx-0.5 bg-border-default" />
            )}
            <button
              className="btn-base p-1.5 rounded-md disabled:opacity-30 disabled:cursor-not-allowed text-text-primary disabled:text-text-secondary"
              title={disabled ? `${item.title}（需要至少 3 张卡片）` : item.title}
              disabled={disabled}
              onClick={() => handleClick(item.mode)}
            >
              <item.Icon size={14} />
            </button>
          </span>
        )
      })}
    </div>
  )

  return createPortal(toolbar, document.body)
}
