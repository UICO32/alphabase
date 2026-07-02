import type { BoardEdge, BoardNode } from '../utils/workspace/types'

export type SerializableBoardNode = BoardNode
export type SerializableBoardEdge = BoardEdge

export interface SerializableBoardData {
  nodes: SerializableBoardNode[]
  edges: SerializableBoardEdge[]
}

export type BoardPatch =
  | { type: 'update-node'; node: SerializableBoardNode }
  | { type: 'remove-node'; nodeId: string }
  | { type: 'upsert-edge'; edge: SerializableBoardEdge }
  | { type: 'remove-edge'; edgeId: string }

export function applyBoardPatches(base: SerializableBoardData, patches: BoardPatch[]): SerializableBoardData {
  let nodes = [...base.nodes]
  let edges = [...base.edges]

  for (const patch of patches) {
    if (patch.type === 'update-node') {
      const index = nodes.findIndex(node => node.id === patch.node.id)
      if (index === -1) nodes = [...nodes, patch.node]
      else nodes = nodes.map(node => node.id === patch.node.id ? patch.node : node)
      continue
    }

    if (patch.type === 'remove-node') {
      nodes = nodes.filter(node => node.id !== patch.nodeId)
      edges = edges.filter(edge => edge.source !== patch.nodeId && edge.target !== patch.nodeId)
      continue
    }

    if (patch.type === 'upsert-edge') {
      const index = edges.findIndex(edge => edge.id === patch.edge.id)
      if (index === -1) edges = [...edges, patch.edge]
      else edges = edges.map(edge => edge.id === patch.edge.id ? patch.edge : edge)
      continue
    }

    edges = edges.filter(edge => edge.id !== patch.edgeId)
  }

  return { nodes, edges }
}
