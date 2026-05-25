import { useEffect, useRef } from 'react'
import { type Node } from '@xyflow/react'
import type { CardNodeData } from '../types/card'

interface UseFrameSyncOptions {
  nodes: Node[]
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
}

export function useFrameSync({ nodes, setNodes }: UseFrameSyncOptions) {
  const prevNodesRef = useRef<Node[]>(nodes)

  useEffect(() => {
    const prevNodes = prevNodesRef.current
    const frameNodes = nodes.filter(n => n.type === 'frame')

    let hasChanges = false
    const updatedNodes = nodes.map(node => {
      const nodeData = node.data as CardNodeData
      if (!nodeData.frameId) return node

      const frameNode = frameNodes.find(f => f.id === nodeData.frameId)
      if (!frameNode) {
        hasChanges = true
        return {
          ...node,
          data: { ...node.data, frameId: undefined, localX: undefined, localY: undefined },
        }
      }

      const prevFrame = prevNodes.find(n => n.id === nodeData.frameId)
      if (!prevFrame) return node

      const dx = frameNode.position.x - prevFrame.position.x
      const dy = frameNode.position.y - prevFrame.position.y

      if (dx === 0 && dy === 0) return node

      hasChanges = true
      return {
        ...node,
        position: {
          x: node.position.x + dx,
          y: node.position.y + dy,
        },
      }
    })

    if (hasChanges) {
      setNodes(updatedNodes)
    }

    prevNodesRef.current = nodes
  }, [nodes, setNodes])
}

export function isPointInNode(
  point: { x: number; y: number },
  node: Node,
): boolean {
  const data = node.data as Record<string, unknown>
  const w = (data.width as number) ?? node.width ?? 600
  const h = (data.height as number) ?? node.height ?? 400
  return (
    point.x >= node.position.x &&
    point.x <= node.position.x + w &&
    point.y >= node.position.y &&
    point.y <= node.position.y + h
  )
}

export function globalToLocal(
  global: { x: number; y: number },
  frame: Node,
): { x: number; y: number } {
  return {
    x: global.x - frame.position.x,
    y: global.y - frame.position.y,
  }
}

export function localToGlobal(
  local: { x: number; y: number },
  frame: Node,
): { x: number; y: number } {
  return {
    x: local.x + frame.position.x,
    y: local.y + frame.position.y,
  }
}
