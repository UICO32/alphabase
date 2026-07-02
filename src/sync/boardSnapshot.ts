import type { Edge, Node } from '@xyflow/react'
import type { SerializableBoardData } from './boardPatch'

export function serializeBoardData(nodes: Node[], edges: Edge[]): SerializableBoardData {
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
