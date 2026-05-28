import type { Node } from '@xyflow/react'
import { DEFAULT_CARD_WIDTH, DEFAULT_CARD_HEIGHT, COLLAPSED_CARD_HEIGHT } from '../types/card'
import type { CardNodeData } from '../types/card'

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
