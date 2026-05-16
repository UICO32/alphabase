import { Position } from '@xyflow/react'

export function edgePointOnRect(
  rx: number, ry: number, rw: number, rh: number,
  cx: number, cy: number,
): { x: number; y: number } {
  const centerX = rx + rw / 2
  const centerY = ry + rh / 2
  const dx = cx - centerX
  const dy = cy - centerY
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)
  if (absDx * rh > absDy * rw) {
    return { x: dx > 0 ? rx + rw : rx, y: centerY }
  }
  return { x: centerX, y: dy > 0 ? ry + rh : ry }
}

export function getBestHandles(
  sourcePos: { x: number; y: number },
  sourceSize: { w: number; h: number },
  targetPos: { x: number; y: number },
  targetSize: { w: number; h: number },
): { sourceHandle: string; targetHandle: string } {
  const dx = targetPos.x - sourcePos.x
  const dy = targetPos.y - sourcePos.y
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  let sourceHandle: string
  if (absDx * sourceSize.h > absDy * sourceSize.w) {
    sourceHandle = dx > 0 ? 'right' : 'left'
  } else {
    sourceHandle = dy > 0 ? 'bottom' : 'top'
  }

  let targetHandle: string
  if (absDx * targetSize.h > absDy * targetSize.w) {
    targetHandle = dx > 0 ? 'left-target' : 'right-target'
  } else {
    targetHandle = dy > 0 ? 'top-target' : 'bottom-target'
  }

  return { sourceHandle, targetHandle }
}

export function positionToHandleId(pos: Position): string {
  switch (pos) {
    case Position.Top: return 'top'
    case Position.Bottom: return 'bottom'
    case Position.Left: return 'left'
    case Position.Right: return 'right'
  }
}