import { useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import type { Edge, Node, ReactFlowInstance } from '@xyflow/react'
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
} from 'lucide-react'
import { computeAlignment, computeBoundingBox, type AlignmentMode } from './utils/alignment'

interface AlignmentToolbarProps {
  selectedNodes: Node[]
  selectedEdges?: Edge[]
  reactFlowInstance: React.RefObject<ReactFlowInstance | null>
  onApplyAlignment: (updates: Map<string, { x: number; y: number }>) => void
  isDraggingNode?: boolean
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

function isAlignableNode(node: Node) {
  return node.type === 'card' || node.type === 'media'
}

export function AlignmentToolbar({
  selectedNodes,
  selectedEdges = [],
  reactFlowInstance,
  onApplyAlignment,
  isDraggingNode = false,
}: AlignmentToolbarProps) {
  const alignableNodes = useMemo(() => {
    if (selectedEdges.length > 0) return []
    if (selectedNodes.length < 2) return []
    if (!selectedNodes.every(isAlignableNode)) return []
    return selectedNodes
  }, [selectedEdges.length, selectedNodes])
  const position = useMemo(() => {
    const rf = reactFlowInstance.current
    if (!rf || isDraggingNode || alignableNodes.length < 2) return null

    const box = computeBoundingBox(alignableNodes)
    const topLeft = rf.flowToScreenPosition({ x: box.minX, y: box.minY })
    const bottomRight = rf.flowToScreenPosition({ x: box.maxX, y: box.maxY })

    const centerX = (topLeft.x + bottomRight.x) / 2
    const aboveY = topLeft.y - 8
    const belowY = bottomRight.y + 8
    const y = aboveY >= 48 ? aboveY : belowY

    return { x: centerX, y, placeAbove: aboveY >= 48 }
  }, [alignableNodes, isDraggingNode, reactFlowInstance])

  const handleClick = useCallback((mode: AlignmentMode) => {
    const updates = computeAlignment(alignableNodes, mode)
    onApplyAlignment(updates)
  }, [alignableNodes, onApplyAlignment])

  if (!position) return null

  const canDistribute = alignableNodes.length >= 3

  return createPortal(
    <div
      className="fixed z-40 flex items-center gap-0.5 rounded-lg border border-border bg-popover px-1.5 py-1.5 text-popover-foreground shadow-md animate-fadeInUp"
      data-testid="alignment-toolbar"
      style={{
        left: position.x,
        top: position.y,
        transform: position.placeAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
      }}
    >
      {ALIGN_ITEMS.map((item, index) => {
        const disabled = item.group === 'distribute' && !canDistribute
        return (
          <span key={item.mode} className="contents">
            {index === 6 && <div className="mx-0.5 h-4 w-px bg-border" />}
            <button
              className="btn-base rounded-md p-1.5 disabled:cursor-not-allowed disabled:opacity-30"
              title={disabled ? `${item.title}（需要至少 3 张卡片）` : item.title}
              disabled={disabled}
              onClick={() => handleClick(item.mode)}
            >
              <item.Icon size={14} />
            </button>
          </span>
        )
      })}
    </div>,
    document.body,
  )
}
