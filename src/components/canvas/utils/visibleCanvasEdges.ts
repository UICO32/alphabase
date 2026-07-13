import type { Edge, Node } from '@xyflow/react'

export function getVisibleCanvasEdges(nodes: Node[], edges: Edge[]): Edge[] {
  const kanbanFrameIds = new Set(
    nodes
      .filter(n => n.type === 'frame' && (n.data as Record<string, unknown>).layout === 'kanban')
      .map(n => n.id),
  )
  if (kanbanFrameIds.size === 0) return edges

  const nodeFrameMap = new Map<string, string>()
  for (const n of nodes) {
    const nd = n.data as Record<string, unknown>
    if (nd.frameId && kanbanFrameIds.has(nd.frameId as string)) {
      nodeFrameMap.set(n.id, nd.frameId as string)
    }
  }

  return edges.filter(e => {
    const sourceFrame = nodeFrameMap.get(e.source)
    const targetFrame = nodeFrameMap.get(e.target)
    if (sourceFrame && targetFrame && sourceFrame === targetFrame) return false
    return true
  })
}
