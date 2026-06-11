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

export type IVec = [number, number]

export const Vec = {
  add(a: IVec, b: IVec): IVec { return [a[0] + b[0], a[1] + b[1]] },
  sub(a: IVec, b: IVec): IVec { return [a[0] - b[0], a[1] - b[1]] },
  mul(v: IVec, s: number): IVec { return [v[0] * s, v[1] * s] },
  dot(a: IVec, b: IVec): number { return a[0] * b[0] + a[1] * b[1] },
  len(v: IVec): number { return Math.sqrt(v[0] * v[0] + v[1] * v[1]) },
  normalize(v: IVec): IVec {
    const l = Vec.len(v)
    return l === 0 ? [0, 0] : [v[0] / l, v[1] / l]
  },
  dist(a: IVec, b: IVec): number { return Vec.len(Vec.sub(a, b)) },
  nearestPointOnLineSegment(p: IVec, a: IVec, b: IVec): IVec {
    const ab = Vec.sub(b, a)
    const ap = Vec.sub(p, a)
    const abLenSq = Vec.dot(ab, ab)
    if (abLenSq === 0) return a
    const t = Math.max(0, Math.min(1, Vec.dot(ap, ab) / abLenSq))
    return Vec.add(a, Vec.mul(ab, t))
  },
}

export function lineIntersects(a1: IVec, a2: IVec, b1: IVec, b2: IVec): IVec | null {
  const d = (a1[0] - a2[0]) * (b1[1] - b2[1]) - (a1[1] - a2[1]) * (b1[0] - b2[0])
  if (d === 0) return null
  const x =
    ((a1[0] * a2[1] - a1[1] * a2[0]) * (b1[0] - b2[0]) -
      (a1[0] - a2[0]) * (b1[0] * b2[1] - b1[1] * b2[0])) /
    d
  const y =
    ((a1[0] * a2[1] - a1[1] * a2[0]) * (b1[1] - b2[1]) -
      (a1[1] - a2[1]) * (b1[0] * b2[1] - b1[1] * b2[0])) /
    d

  const within = (v: number, a: number, b: number) =>
    (v >= a && v <= b) || (v >= b && v <= a)

  if (within(x, a1[0], a2[0]) && within(x, b1[0], b2[0]) &&
      within(y, a1[1], a2[1]) && within(y, b1[1], b2[1])) {
    return [x, y]
  }
  return null
}

export function edgePointOnRect(
  rx: number, ry: number, rw: number, rh: number,
  cx: number, cy: number,
): { x: number; y: number } {
  const rect = new Bound(rx, ry, rw, rh)
  const target: IVec = [cx, cy]

  const corners: IVec[] = [
    [rect.x, rect.y],
    [rect.maxX, rect.y],
    [rect.maxX, rect.maxY],
    [rect.x, rect.maxY],
  ]

  let bestDist = Infinity
  let bestPoint: IVec = [rect.x, rect.y]

  for (let i = 0; i < 4; i++) {
    const pt = Vec.nearestPointOnLineSegment(target, corners[i], corners[(i + 1) % 4])
    const d = Vec.dist(pt, target)
    if (d < bestDist) {
      bestDist = d
      bestPoint = pt
    }
  }

  return { x: bestPoint[0], y: bestPoint[1] }
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