import type { Node } from '@xyflow/react'
import { DEFAULT_CARD_WIDTH, DEFAULT_CARD_HEIGHT, COLLAPSED_CARD_HEIGHT } from '../../../types/card'
import type { CardNodeData } from '../../../types/card'
import type { IndexedNodeBounds } from './canvasSpatialIndex'

export type AlignmentMode =
  | 'left' | 'centerH' | 'right'
  | 'top' | 'centerV' | 'bottom'
  | 'distributeH' | 'distributeV'

interface NodeBounds {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export interface BoundingBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function getNodeBounds(node: Node): NodeBounds {
  const data = node.data as CardNodeData
  const width = data.width ?? DEFAULT_CARD_WIDTH
  const height = data.collapsed ? COLLAPSED_CARD_HEIGHT : (data.height ?? DEFAULT_CARD_HEIGHT)
  return {
    id: node.id,
    x: node.position.x,
    y: node.position.y,
    width,
    height,
  }
}

export function computeBoundingBox(nodes: Node[]): BoundingBox {
  const bounds = nodes.map(getNodeBounds)
  return {
    minX: Math.min(...bounds.map(b => b.x)),
    minY: Math.min(...bounds.map(b => b.y)),
    maxX: Math.max(...bounds.map(b => b.x + b.width)),
    maxY: Math.max(...bounds.map(b => b.y + b.height)),
  }
}

export function computeAlignment(
  nodes: Node[],
  mode: AlignmentMode,
): Map<string, { x: number; y: number }> {
  const bounds = nodes.map(getNodeBounds)
  const box = {
    minX: Math.min(...bounds.map(b => b.x)),
    minY: Math.min(...bounds.map(b => b.y)),
    maxX: Math.max(...bounds.map(b => b.x + b.width)),
    maxY: Math.max(...bounds.map(b => b.y + b.height)),
  }

  const updates = new Map<string, { x: number; y: number }>()

  for (const b of bounds) {
    let newX = b.x
    let newY = b.y

    switch (mode) {
      case 'left':
        newX = box.minX
        break
      case 'centerH':
        newX = (box.minX + box.maxX) / 2 - b.width / 2
        break
      case 'right':
        newX = box.maxX - b.width
        break
      case 'top':
        newY = box.minY
        break
      case 'centerV':
        newY = (box.minY + box.maxY) / 2 - b.height / 2
        break
      case 'bottom':
        newY = box.maxY - b.height
        break
      case 'distributeH': {
        const sorted = [...bounds].sort((a, c) => a.x - c.x)
        const totalWidth = sorted.reduce((s, n) => s + n.width, 0)
        const gap = (box.maxX - box.minX - totalWidth) / (sorted.length - 1)
        let cx = box.minX
        for (const n of sorted) {
          if (n.id === b.id) { newX = cx; break }
          cx += n.width + gap
        }
        break
      }
      case 'distributeV': {
        const sorted = [...bounds].sort((a, c) => a.y - c.y)
        const totalHeight = sorted.reduce((s, n) => s + n.height, 0)
        const gap = (box.maxY - box.minY - totalHeight) / (sorted.length - 1)
        let cy = box.minY
        for (const n of sorted) {
          if (n.id === b.id) { newY = cy; break }
          cy += n.height + gap
        }
        break
      }
    }

    updates.set(b.id, { x: newX, y: newY })
  }

  return updates
}

export interface SnapBounds {
  x: number
  y: number
  width: number
  height: number
}

export function getNodesBounds(nodes: Array<Node | IndexedNodeBounds>): SnapBounds[] {
  return nodes.map(item => {
    if ('node' in item) {
      return {
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
      }
    }

    const node = item
    const data = node.data as CardNodeData
    const width = data.width ?? DEFAULT_CARD_WIDTH
    const height = data.collapsed ? COLLAPSED_CARD_HEIGHT : (data.height ?? DEFAULT_CARD_HEIGHT)
    return {
      x: node.position.x,
      y: node.position.y,
      width,
      height,
    }
  })
}

export function calcSnapNudge(
  dragBounds: SnapBounds,
  otherBounds: SnapBounds[],
  threshold: number,
): { x: number; y: number } {
  if (otherBounds.length === 0) return { x: 0, y: 0 }

  const dragEdges = {
    left: dragBounds.x,
    right: dragBounds.x + dragBounds.width,
    top: dragBounds.y,
    bottom: dragBounds.y + dragBounds.height,
  }

  let closestXNudge = 0
  let closestXDist = threshold
  let closestYNudge = 0
  let closestYDist = threshold

  for (const other of otherBounds) {
    const otherEdges = {
      left: other.x,
      right: other.x + other.width,
      top: other.y,
      bottom: other.y + other.height,
    }

    const xPairs: Array<{ drag: number; other: number }> = [
      { drag: dragEdges.left, other: otherEdges.left },
      { drag: dragEdges.right, other: otherEdges.right },
      { drag: dragEdges.left, other: otherEdges.right },
      { drag: dragEdges.right, other: otherEdges.left },
    ]

    for (const pair of xPairs) {
      const dist = Math.abs(pair.drag - pair.other)
      if (dist < closestXDist) {
        closestXDist = dist
        closestXNudge = pair.other - pair.drag
      }
    }

    const yPairs: Array<{ drag: number; other: number }> = [
      { drag: dragEdges.top, other: otherEdges.top },
      { drag: dragEdges.bottom, other: otherEdges.bottom },
      { drag: dragEdges.top, other: otherEdges.bottom },
      { drag: dragEdges.bottom, other: otherEdges.top },
    ]

    for (const pair of yPairs) {
      const dist = Math.abs(pair.drag - pair.other)
      if (dist < closestYDist) {
        closestYDist = dist
        closestYNudge = pair.other - pair.drag
      }
    }
  }

  return { x: closestXNudge, y: closestYNudge }
}
