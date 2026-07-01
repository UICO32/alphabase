import type { Edge, Node } from '@xyflow/react'
import type { BoardEdge, BoardNode } from '../utils/workspace/types'

export function serializeBoardData(nodes: Node[], edges: Edge[]): { nodes: BoardNode[]; edges: BoardEdge[] } {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: (n.type === 'card' || n.type === 'frame' || n.type === 'media') ? n.type : 'card',
      position: { x: n.position.x, y: n.position.y },
      data: { ...n.data },
      width: n.width as number | undefined,
      height: n.height as number | undefined,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'connection',
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
    })),
  }
}
