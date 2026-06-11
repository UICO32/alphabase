import { Position } from '@xyflow/react'

export class Bound {
  x: number
  y: number
  w: number
  h: number

  constructor(x: number, y: number, w: number, h: number) {
    this.x = x
    this.y = y
    this.w = w
    this.h = h
  }

  get maxX() { return this.x + this.w }
  get maxY() { return this.y + this.h }
  get center() { return { x: this.x + this.w / 2, y: this.y + this.h / 2 } }

  contains(other: Bound): boolean {
    return this.x <= other.x && this.y <= other.y && this.maxX >= other.maxX && this.maxY >= other.maxY
  }

  intersects(other: Bound): boolean {
    return this.x < other.maxX && this.maxX > other.x && this.y < other.maxY && this.maxY > other.y
  }

  serialize(): string {
    return `${this.x},${this.y},${this.w},${this.h}`
  }

  static deserialize(xywh: string): Bound {
    const [x, y, w, h] = xywh.split(',').map(Number)
    return new Bound(x, y, w, h)
  }

  static fromDOMRect(rect: DOMRect): Bound {
    return new Bound(rect.left, rect.top, rect.width, rect.height)
  }
}

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