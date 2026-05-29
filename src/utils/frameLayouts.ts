import type { Node } from '@xyflow/react'
import type { CardNodeData } from '../types/card'
import type { FrameNodeData, FrameLayoutSnapshot } from '../components/canvas/FrameNode'

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

const HEADER_HEIGHT = 44
const PADDING = 16
const GAP = 12
const KANBAN_COL_HEADER_H = 32
const KANBAN_CARD_HEIGHT = 140
const KANBAN_CARD_GAP = 10
const KANBAN_COL_GAP = 16

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

function computeFreeLayout(_frame: Node, childNodes: Node[]): LayoutResult {
  const positions: Record<string, { x: number; y: number }> = {}
  for (const node of childNodes) {
    const data = node.data as CardNodeData
    if (data.localX !== undefined && data.localY !== undefined) {
      positions[node.id] = { x: data.localX, y: data.localY }
    } else {
      positions[node.id] = { x: node.position.x, y: node.position.y }
    }
  }
  return { positions }
}

function computeBentoLayout(frame: Node, childNodes: Node[]): LayoutResult {
  const positions: Record<string, { x: number; y: number; width: number; height: number }> = {}
  if (childNodes.length === 0) return { positions }

  const frameW = (frame.data.width as number) ?? frame.width ?? 600
  const frameH = (frame.data.height as number) ?? frame.height ?? 400
  const contentW = frameW - PADDING * 2
  const contentH = frameH - HEADER_HEIGHT - PADDING * 2

  const colW = Math.floor((contentW - GAP) / 2)

  if (childNodes.length === 1) {
    positions[childNodes[0].id] = { x: PADDING, y: HEADER_HEIGHT + PADDING, width: contentW, height: contentH }
  } else if (childNodes.length === 2) {
    positions[childNodes[0].id] = { x: PADDING, y: HEADER_HEIGHT + PADDING, width: colW, height: contentH }
    positions[childNodes[1].id] = { x: PADDING + colW + GAP, y: HEADER_HEIGHT + PADDING, width: colW, height: contentH }
  } else if (childNodes.length === 3) {
    const topH = Math.floor(contentH * 0.45)
    const bottomH = contentH - topH - GAP
    positions[childNodes[0].id] = { x: PADDING, y: HEADER_HEIGHT + PADDING, width: contentW, height: topH }
    positions[childNodes[1].id] = { x: PADDING, y: HEADER_HEIGHT + PADDING + topH + GAP, width: colW, height: bottomH }
    positions[childNodes[2].id] = { x: PADDING + colW + GAP, y: HEADER_HEIGHT + PADDING + topH + GAP, width: colW, height: bottomH }
  } else {
    const rows = Math.ceil(childNodes.length / 2)
    const rowH = Math.floor((contentH - (rows - 1) * GAP) / rows)

    childNodes.forEach((node, index) => {
      const col = index % 2
      const row = Math.floor(index / 2)
      const isLastRow = row === rows - 1
      const itemsInLastRow = childNodes.length - (rows - 1) * 2
      const w = isLastRow && itemsInLastRow === 1 ? contentW : colW
      positions[node.id] = {
        x: PADDING + col * (colW + GAP),
        y: HEADER_HEIGHT + PADDING + row * (rowH + GAP),
        width: w,
        height: rowH,
      }
    })
  }

  return { positions }
}

function computeKanbanLayout(frame: Node, childNodes: Node[]): LayoutResult {
  const positions: Record<string, { x: number; y: number; width: number; height: number }> = {}
  if (childNodes.length === 0) return { positions }

  const frameW = (frame.data.width as number) ?? frame.width ?? 600
  const columns = (frame.data.columns as KanbanColumn[] | undefined) ?? DEFAULT_KANBAN_COLUMNS
  const numCols = columns.length

  // 列宽：填满 Frame，列间用分隔线而非 gap，所以列宽 = (总宽 - 内边距) / 列数
  const colWidth = Math.floor((frameW - PADDING * 2 - (numCols - 1) * KANBAN_COL_GAP) / numCols)

  // 将卡片分配到各列
  const columnsWithCards: { cards: Node[] }[] = columns.map(() => ({ cards: [] }))

  const hasCardIds = columns.some(c => c.cardIds && c.cardIds.length > 0)
  if (hasCardIds) {
    for (const node of childNodes) {
      const colIdx = columns.findIndex(c => c.cardIds?.includes(node.id))
      if (colIdx >= 0) {
        columnsWithCards[colIdx].cards.push(node)
      } else {
        columnsWithCards[columnsWithCards.length - 1].cards.push(node)
      }
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
  const ver = currentVersion ?? 0
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
  // kanban: 如果 Frame 快照版本落后，重新排列卡片
  const frameSnapshot = (frame.data as FrameNodeData).layoutSnapshots?.[targetLayout]
  const frameVersion = frameSnapshot?.version ?? 0
  const stale = ver > 0 && frameVersion < ver
  const positions: Record<string, { x: number; y: number; width?: number; height?: number }> = {}
  for (const node of childNodes) {
    if (stale) {
      positions[node.id] = computed.positions[node.id]
    } else {
      const updatedData = cardDataUpdates.get(node.id)
      const snapshot = updatedData?.layoutSnapshots?.[targetLayout]
      if (snapshot) {
        positions[node.id] = { x: snapshot.localX, y: snapshot.localY, width: snapshot.width, height: snapshot.height }
      } else {
        positions[node.id] = computed.positions[node.id]
      }
    }
  }
  return { positions }
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