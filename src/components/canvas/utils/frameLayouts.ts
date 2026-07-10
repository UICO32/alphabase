import type { Node } from '@xyflow/react'
import type { CardNodeData } from '../../../types/card'
import type { FrameNodeData, FrameLayoutSnapshot } from '../FrameNode'

export type FrameLayout = 'free' | 'bento' | 'kanban'

export interface KanbanColumn {
  id: string
  title: string
  color?: string
  cardIds?: string[]
}

export interface LayoutResult {
  positions: Record<string, { x: number; y: number; width?: number; height?: number }>
}

const HEADER_HEIGHT = 8
const PADDING = 16
const GAP = 12
export const KANBAN_COL_HEADER_H = 32
export const KANBAN_CARD_HEIGHT = 140
export const KANBAN_CARD_GAP = 10
export const KANBAN_COL_GAP = 16
const BENTO_CARD_WIDTH = 260
const BENTO_CARD_MIN_HEIGHT = 160
const BENTO_CARD_MAX_HEIGHT = 260

export const DEFAULT_KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'col-0', title: 'To Do', color: '#6366f1' },
  { id: 'col-1', title: 'In Progress', color: '#f59e0b' },
  { id: 'col-2', title: 'Done', color: '#10b981' },
]

export function computeLayout(
  frame: Node,
  childNodes: Node[],
  layout: FrameLayout,
): LayoutResult {
  switch (layout) {
    case 'bento':
      return computeBentoLayout(frame, childNodes)
    case 'kanban':
      return computeKanbanLayout(frame, childNodes)
    case 'free':
    default:
      return computeFreeLayout(frame, childNodes)
  }
}

function computeFreeLayout(frame: Node, childNodes: Node[]): LayoutResult {
  const positions: Record<string, { x: number; y: number }> = {}
  for (const node of childNodes) {
    const data = node.data as CardNodeData
    if (data.localX !== undefined && data.localY !== undefined) {
      positions[node.id] = { x: data.localX, y: data.localY }
    } else {
      positions[node.id] = {
        x: node.position.x - frame.position.x,
        y: node.position.y - frame.position.y,
      }
    }
  }
  return { positions }
}

function computeBentoLayout(frame: Node, childNodes: Node[]): LayoutResult {
  const positions: Record<string, { x: number; y: number; width: number; height: number }> = {}
  if (childNodes.length === 0) return { positions }

  const frameW = (frame.data.width as number) ?? frame.width ?? 600
  const contentW = frameW - PADDING * 2
  const columnCount = Math.max(1, Math.floor((contentW + GAP) / (BENTO_CARD_WIDTH + GAP)))
  const cardWidth = Math.min(BENTO_CARD_WIDTH, Math.floor((contentW - (columnCount - 1) * GAP) / columnCount))
  const columnHeights = Array.from({ length: columnCount }, () => HEADER_HEIGHT + PADDING)

  childNodes.forEach((node) => {
    const data = node.data as CardNodeData
    const measuredHeight = data.height ?? BENTO_CARD_MIN_HEIGHT
    const cardHeight = Math.max(BENTO_CARD_MIN_HEIGHT, Math.min(BENTO_CARD_MAX_HEIGHT, measuredHeight))
    const col = columnHeights.indexOf(Math.min(...columnHeights))
    positions[node.id] = {
      x: PADDING + col * (cardWidth + GAP),
      y: columnHeights[col],
      width: cardWidth,
      height: cardHeight,
    }
    columnHeights[col] += cardHeight + GAP
  })

  return { positions }
}

function computeKanbanLayout(frame: Node, childNodes: Node[]): LayoutResult {
  const positions: Record<string, { x: number; y: number; width: number; height?: number }> = {}
  if (childNodes.length === 0) return { positions }

  const frameW = (frame.data.width as number) ?? frame.width ?? 600
  const columns = (frame.data.columns as KanbanColumn[] | undefined) ?? DEFAULT_KANBAN_COLUMNS
  const numCols = columns.length

  // 列宽：填满 Frame，列间用分隔线而非 gap，所以列宽 = (总宽 - 内边距) / 列数
  const colWidth = Math.floor((frameW - PADDING * 2 - (numCols - 1) * KANBAN_COL_GAP) / numCols)

  const childById = new Map(childNodes.map(node => [node.id, node]))
  const assigned = new Set<string>()
  const columnsWithCards: { cards: Node[] }[] = columns.map(() => ({ cards: [] }))

  const hasCardIds = columns.some(c => c.cardIds && c.cardIds.length > 0)
  if (hasCardIds) {
    columns.forEach((col, colIdx) => {
      for (const cardId of col.cardIds ?? []) {
        const node = childById.get(cardId)
        if (!node || assigned.has(cardId)) continue
        columnsWithCards[colIdx].cards.push(node)
        assigned.add(cardId)
      }
    })
    for (const node of childNodes) {
      if (assigned.has(node.id)) continue
      columnsWithCards[columnsWithCards.length - 1].cards.push(node)
      assigned.add(node.id)
    }
  } else {
    childNodes.forEach((node, index) => {
      const colIdx = index % numCols
      columnsWithCards[colIdx].cards.push(node)
    })
  }

  // 卡片起始 y：Frame header + padding + 列头 + 小间距
  const startY = HEADER_HEIGHT + PADDING + KANBAN_COL_HEADER_H + 4

  columnsWithCards.forEach(({ cards }, colIdx) => {
    const x = PADDING + colIdx * (colWidth + KANBAN_COL_GAP)
    let y = startY
    cards.forEach((node) => {
      const data = node.data as CardNodeData
      const h = data.height ?? KANBAN_CARD_HEIGHT
      positions[node.id] = { x, y, width: colWidth, height: h }
      y += h + KANBAN_CARD_GAP
    })
  })

  return { positions }
}

export function saveCardSnapshots(
  childNodes: Node[],
  framePosition: { x: number; y: number },
  layout: FrameLayout,
): Map<string, CardNodeData> {
  const updates = new Map<string, CardNodeData>()
  for (const node of childNodes) {
    const data = node.data as CardNodeData
    const localX = data.localX ?? (node.position.x - framePosition.x)
    const localY = data.localY ?? (node.position.y - framePosition.y)
    updates.set(node.id, {
      ...data,
      layoutSnapshots: {
        ...data.layoutSnapshots,
        [layout]: { localX, localY, width: data.width, height: data.height },
      },
    })
  }
  return updates
}

export function saveFrameSnapshot(
  frameData: FrameNodeData,
  layout: FrameLayout,
): FrameNodeData {
  const snapshot: FrameLayoutSnapshot = {
    width: frameData.width,
    height: frameData.height,
    columns: layout === 'kanban' ? frameData.columns : undefined,
    version: frameData.snapshotVersion ?? 0,
  }
  return {
    ...frameData,
    layoutSnapshots: {
      ...frameData.layoutSnapshots,
      [layout]: snapshot,
    },
  }
}

export function restoreOrComputePositions(
  frame: Node,
  childNodes: Node[],
  targetLayout: FrameLayout,
  cardDataUpdates: Map<string, CardNodeData>,
  currentVersion?: number,
): LayoutResult {
  const computed = computeLayout(frame, childNodes, targetLayout)
  void currentVersion
  // bento 始终重新计算（自动排列型布局）
  if (targetLayout === 'bento') {
    return computed
  }
  // free 布局：位置由用户手动放置，永远不重新计算
  if (targetLayout === 'free') {
    const positions: Record<string, { x: number; y: number; width?: number; height?: number }> = {}
    for (const node of childNodes) {
      const updatedData = cardDataUpdates.get(node.id)
      const snapshot = updatedData?.layoutSnapshots?.[targetLayout]
      if (snapshot) {
        positions[node.id] = { x: snapshot.localX, y: snapshot.localY, width: snapshot.width, height: snapshot.height }
      } else {
        // 没有快照：保持当前绝对位置（相对于 Frame）
        const data = node.data as CardNodeData
        positions[node.id] = {
          x: data.localX ?? (node.position.x - frame.position.x),
          y: data.localY ?? (node.position.y - frame.position.y),
          width: data.width,
          height: data.height,
        }
      }
    }
    return { positions }
  }
  // Kanban is order-driven: recompute from columns so stale snapshots cannot keep old widths or gaps.
  return computed
}

export function restoreFrameDimensions(
  frameData: FrameNodeData,
  targetLayout: FrameLayout,
): { width: number; height: number; columns?: KanbanColumn[] } {
  // bento 始终用当前尺寸（自动排列型布局）
  if (targetLayout === 'bento') {
    return { width: frameData.width, height: frameData.height }
  }
  const snapshot = frameData.layoutSnapshots?.[targetLayout]
  const currentVersion = frameData.snapshotVersion ?? 0
  if (snapshot && (snapshot.version ?? 0) >= currentVersion) {
    return { width: snapshot.width, height: snapshot.height, columns: snapshot.columns }
  }
  return {
    width: frameData.width,
    height: frameData.height,
    columns: targetLayout === 'kanban'
      ? DEFAULT_KANBAN_COLUMNS
      : undefined,
  }
}

export function updateSingleCardSnapshot(
  cardData: CardNodeData,
  layout: FrameLayout,
  localX: number,
  localY: number,
  width?: number,
  height?: number,
): CardNodeData {
  return {
    ...cardData,
    layoutSnapshots: {
      ...cardData.layoutSnapshots,
      [layout]: { localX, localY, width, height },
    },
  }
}
