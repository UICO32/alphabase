import type { Node } from '@xyflow/react'
import { COLLAPSED_CARD_HEIGHT, DEFAULT_CARD_HEIGHT, DEFAULT_CARD_WIDTH, DEFAULT_ANNOTATION_WIDTH, DEFAULT_ANNOTATION_HEIGHT } from '../../../types/card'

export interface IndexedNodeBounds {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  node: Node
}

export interface RectLike {
  x: number
  y: number
  width: number
  height: number
}

const DEFAULT_FRAME_WIDTH = 600
const DEFAULT_FRAME_HEIGHT = 400
const DEFAULT_MEDIA_WIDTH = 320
const DEFAULT_MEDIA_HEIGHT = 220
const DEFAULT_TEXT_WIDTH = DEFAULT_ANNOTATION_WIDTH
const DEFAULT_TEXT_HEIGHT = DEFAULT_ANNOTATION_HEIGHT
const DEFAULT_CELL_SIZE = 512

export function getNodeBoundsForIndex(node: Node): IndexedNodeBounds {
  const data = node.data as Record<string, unknown>
  const type = node.type ?? 'card'

  let width = Number(data.width ?? node.width)
  let height = Number(data.height ?? node.height)

  if (!Number.isFinite(width) || width <= 0) {
    width = type === 'frame' ? DEFAULT_FRAME_WIDTH : type === 'media' ? DEFAULT_MEDIA_WIDTH : type === 'text' ? DEFAULT_TEXT_WIDTH : DEFAULT_CARD_WIDTH
  }

  if (!Number.isFinite(height) || height <= 0) {
    height = type === 'frame' ? DEFAULT_FRAME_HEIGHT : type === 'media' ? DEFAULT_MEDIA_HEIGHT : type === 'text' ? DEFAULT_TEXT_HEIGHT : DEFAULT_CARD_HEIGHT
  }

  if (type === 'card' && data.collapsed === true) {
    height = COLLAPSED_CARD_HEIGHT
  }

  return {
    id: node.id,
    type,
    x: node.position.x,
    y: node.position.y,
    width,
    height,
    node,
  }
}

export function isBoundsCenterInsideRect(bounds: IndexedNodeBounds, rect: RectLike) {
  const cx = bounds.x + bounds.width / 2
  const cy = bounds.y + bounds.height / 2
  return cx >= rect.x && cx <= rect.x + rect.width && cy >= rect.y && cy <= rect.y + rect.height
}

function intersects(a: RectLike, b: RectLike) {
  return a.x <= b.x + b.width
    && a.x + a.width >= b.x
    && a.y <= b.y + b.height
    && a.y + a.height >= b.y
}

function keyForCell(x: number, y: number) {
  return `${x}:${y}`
}

function cellRange(rect: RectLike, cellSize: number) {
  return {
    minX: Math.floor(rect.x / cellSize),
    maxX: Math.floor((rect.x + rect.width) / cellSize),
    minY: Math.floor(rect.y / cellSize),
    maxY: Math.floor((rect.y + rect.height) / cellSize),
  }
}

export function createCanvasSpatialIndex(nodes: Node[], cellSize = DEFAULT_CELL_SIZE) {
  const cells = new Map<string, IndexedNodeBounds[]>()
  const bounds = nodes
    .filter((node) => node.type === 'card' || node.type === 'frame' || node.type === 'media' || node.type === 'text')
    .map(getNodeBoundsForIndex)

  for (const item of bounds) {
    const range = cellRange(item, cellSize)
    for (let cx = range.minX; cx <= range.maxX; cx++) {
      for (let cy = range.minY; cy <= range.maxY; cy++) {
        const key = keyForCell(cx, cy)
        const bucket = cells.get(key)
        if (bucket) bucket.push(item)
        else cells.set(key, [item])
      }
    }
  }

  const queryRect = (rect: RectLike) => {
    const range = cellRange(rect, cellSize)
    const seen = new Set<string>()
    const result: IndexedNodeBounds[] = []

    for (let cx = range.minX; cx <= range.maxX; cx++) {
      for (let cy = range.minY; cy <= range.maxY; cy++) {
        const bucket = cells.get(keyForCell(cx, cy))
        if (!bucket) continue
        for (const item of bucket) {
          if (seen.has(item.id)) continue
          seen.add(item.id)
          if (intersects(rect, item)) result.push(item)
        }
      }
    }

    return result
  }

  const queryPoint = (point: { x: number; y: number }, radius: number) => {
    return queryRect({
      x: point.x - radius,
      y: point.y - radius,
      width: radius * 2,
      height: radius * 2,
    })
  }

  return { queryRect, queryPoint, bounds }
}

export type CanvasSpatialIndex = ReturnType<typeof createCanvasSpatialIndex>
