import { memo, useCallback, useRef, useState } from 'react'
import { useReactFlow, useStore, type Node } from '@xyflow/react'
import { computeBoundingBox } from './utils/alignment'

// 多选整体缩放：选中 ≥2 个节点时显示包围盒 + 四角手柄，
// 拖动角按对角线等比缩放所有选中节点的位置与尺寸（类似 Figma 多选缩放）。

type Corner = 'nw' | 'ne' | 'sw' | 'se'

const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se']
const HANDLE_SIZE = 10
const PAD = 6
export const MIN_SCALE = 0.05

export interface MultiScaleNode {
  id: string
  x: number
  y: number
  w: number
  h: number
}

export interface MultiScaleResult {
  id: string
  x: number
  y: number
  w: number
  h: number
}

/**
 * 多选整体等比缩放的核心计算（纯函数，便于测试）：
 * 以锚点（拖拽角的对角）为不动点，按鼠标到锚点的对角线距离比例
 * 缩放所有节点的位置与尺寸。
 */
export function computeMultiScale(
  startNodes: MultiScaleNode[],
  anchorX: number,
  anchorY: number,
  startW: number,
  startH: number,
  mouseX: number,
  mouseY: number,
): MultiScaleResult[] {
  const diag = Math.hypot(startW, startH)
  const scale = Math.max(MIN_SCALE, Math.hypot(mouseX - anchorX, mouseY - anchorY) / diag)
  return startNodes.map(n => {
    const w = n.w * scale
    const h = n.h * scale
    return {
      id: n.id,
      x: anchorX + (n.x - anchorX) * scale,
      y: anchorY + (n.y - anchorY) * scale,
      w,
      h,
    }
  })
}

interface MultiSelectionScalerProps {
  /** 缩放开始（记录撤销前快照） */
  onScaleStart: () => void
  /** 缩放结束（记录撤销后快照） */
  onScaleEnd: () => void
}

interface DragState {
  anchorX: number
  anchorY: number
  startW: number
  startH: number
  startNodes: { id: string; x: number; y: number; w: number; h: number }[]
}

export const MultiSelectionScaler = memo(function MultiSelectionScaler({
  onScaleStart,
  onScaleEnd,
}: MultiSelectionScalerProps) {
  const { setNodes, screenToFlowPosition, flowToScreenPosition } = useReactFlow()
  // 订阅完整 transform：包围盒/手柄用屏幕坐标渲染在 pane 固定层，
  // pan/zoom 时需跟随画布重新计算位置
  const transform = useStore(s => s.transform)
  // 直接从 store 订阅选中节点的最新状态（而非选择时的快照）：
  // 拖动缩放、图片加载完成、resize 等导致的尺寸变化，包围盒实时跟随
  const nodes = useStore(s => {
    const out: Node[] = []
    for (const n of s.nodes.values()) {
      if (n.selected && (n.type === 'card' || n.type === 'media' || n.type === 'text')) out.push(n)
    }
    return out
  })
  const dragRef = useRef<DragState | null>(null)
  const [dragging, setDragging] = useState(false)

  // 注意：所有 hooks（含下方 useCallback）必须在 early return 之前，
  // 否则多选→单选切换时 hooks 数量变化会触发 "Rendered fewer hooks" 错误。
  const bounds = computeBoundingBox(nodes)
  const invZoom = 1 / transform[2]
  const pad = PAD * invZoom

  // React Flow 的 children 渲染在 pane（固定层），需用 flowToScreenPosition
  // 把 flow 坐标转成屏幕坐标，否则缩放框会渲染到错误位置（看不到）。
  const left = bounds.minX - pad
  const top = bounds.minY - pad
  const right = bounds.maxX + pad
  const bottom = bounds.maxY + pad
  const tl = flowToScreenPosition({ x: left, y: top })
  const br = flowToScreenPosition({ x: right, y: bottom })
  const boxLeft = tl.x
  const boxTop = tl.y
  const boxWidth = br.x - tl.x
  const boxHeight = br.y - tl.y
  const lineWidth = 1.5
  const handleSize = HANDLE_SIZE

  const cornerPos: Record<Corner, { x: number; y: number }> = {
    nw: { x: boxLeft, y: boxTop },
    ne: { x: br.x, y: boxTop },
    sw: { x: boxLeft, y: br.y },
    se: { x: br.x, y: br.y },
  }

  const handlePointerDown = useCallback((corner: Corner) => (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    // 锚点 = 拖拽角的对角（保持不动，flow 坐标）
    const anchor = {
      nw: { x: right, y: bottom },
      ne: { x: left, y: bottom },
      sw: { x: right, y: top },
      se: { x: left, y: top },
    }[corner]
    dragRef.current = {
      anchorX: anchor.x,
      anchorY: anchor.y,
      startW: bounds.maxX - bounds.minX + pad * 2,
      startH: bounds.maxY - bounds.minY + pad * 2,
      startNodes: nodes.map(n => ({
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        w: Number((n.data as Record<string, unknown>).width ?? n.width ?? 100),
        h: Number((n.data as Record<string, unknown>).height ?? n.height ?? 100),
      })),
    }
    setDragging(true)
    onScaleStart()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [bounds, nodes, onScaleStart, right, left, top, bottom, pad])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const p = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    // 对角线等比：拖动距离 / 初始对角线（computeMultiScale 纯函数）
    const results = computeMultiScale(
      drag.startNodes,
      drag.anchorX,
      drag.anchorY,
      drag.startW,
      drag.startH,
      p.x,
      p.y,
    )
    setNodes(nds => nds.map(n => {
      const s = results.find(r => r.id === n.id)
      if (!s) return n
      return {
        ...n,
        position: { x: s.x, y: s.y },
        width: s.w,
        height: s.h,
        data: { ...n.data, width: s.w, height: s.h },
      }
    }))
  }, [screenToFlowPosition, setNodes])

  const handlePointerUp = useCallback(() => {
    if (!dragRef.current) return
    dragRef.current = null
    setDragging(false)
    onScaleEnd()
  }, [onScaleEnd])

  // early return 放在所有 hooks 之后（单节点用各自的 NodeResizer）
  if (nodes.length < 2) return null

  return (
    <>
      {/* 包围盒虚线框（屏幕坐标，pane 固定层） */}
      <div
        style={{
          position: 'absolute',
          left: boxLeft,
          top: boxTop,
          width: boxWidth,
          height: boxHeight,
          border: `${lineWidth}px dashed var(--line-active)`,
          borderRadius: 4,
          pointerEvents: 'none',
          zIndex: 2000,
          boxSizing: 'border-box',
        }}
      />
      {CORNERS.map(corner => (
        <div
          key={corner}
          onPointerDown={handlePointerDown(corner)}
          onPointerMove={dragging ? handlePointerMove : undefined}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            position: 'absolute',
            left: cornerPos[corner].x - handleSize / 2,
            top: cornerPos[corner].y - handleSize / 2,
            width: handleSize,
            height: handleSize,
            background: dragging ? 'var(--line-active)' : 'var(--surface-panel)',
            border: `${Math.max(1, lineWidth)}px solid var(--line-active)`,
            borderRadius: 3,
            cursor: `${corner}-resize`,
            pointerEvents: 'auto',
            touchAction: 'none',
            zIndex: 2001,
            boxSizing: 'border-box',
          }}
        />
      ))}
    </>
  )
})
