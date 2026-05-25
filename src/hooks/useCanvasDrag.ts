import { useCallback } from 'react'
import { type Edge, type OnNodeDrag, type Node } from '@xyflow/react'
import type { ReactFlowInstance } from '@xyflow/react'
import { getBestHandles } from '../utils/geometry'
import { DEFAULT_CARD_WIDTH, DEFAULT_CARD_HEIGHT, COLLAPSED_CARD_HEIGHT } from '../types/card'
import type { CardNodeData } from '../types/card'
import { isPointInNode, globalToLocal } from './useFrameSync'

interface UseCanvasDragOptions {
  reactFlowInstance: React.RefObject<ReactFlowInstance | null>
  setEdges: (updater: Edge[] | ((edges: Edge[]) => Edge[])) => void
  setNodes: (updater: Node[] | ((nodes: Node[]) => Node[])) => void
}

export function useCanvasDrag({ reactFlowInstance, setEdges, setNodes }: UseCanvasDragOptions) {
  const onNodeDrag: OnNodeDrag = useCallback(
    (_event, node) => {
      const instance = reactFlowInstance.current
      if (!instance) return
      setEdges((eds) => {
        let changed = false
        const next = eds.map((e) => {
          if (e.source !== node.id && e.target !== node.id) return e
          changed = true
          const sourceNode = instance.getNode(e.source)
          const targetNode = instance.getNode(e.target)
          if (!sourceNode || !targetNode) return e
          const sd = sourceNode.data as CardNodeData
          const sw = sd.width ?? DEFAULT_CARD_WIDTH
          const sh = sd.collapsed ? COLLAPSED_CARD_HEIGHT : (sd.height ?? DEFAULT_CARD_HEIGHT)
          const td = targetNode.data as CardNodeData
          const tw = td.width ?? DEFAULT_CARD_WIDTH
          const th = td.collapsed ? COLLAPSED_CARD_HEIGHT : (td.height ?? DEFAULT_CARD_HEIGHT)
          const handles = getBestHandles(sourceNode.position, { w: sw, h: sh }, targetNode.position, { w: tw, h: th })
          if (e.sourceHandle === handles.sourceHandle && e.targetHandle === handles.targetHandle) return e
          return {
            ...e,
            sourceHandle: handles.sourceHandle,
            targetHandle: handles.targetHandle,
          }
        })
        return changed ? next : eds
      })
    },
    [reactFlowInstance, setEdges],
  )

  const onNodeDragStop = useCallback((_event: MouseEvent, node: Node) => {
    setEdges((eds) => [...eds])

    if (node.type !== 'card') return

    const instance = reactFlowInstance.current
    if (!instance) return

    const allNodes = instance.getNodes()
    const frameNodes = allNodes.filter(n => n.type === 'frame')
    const nodeData = node.data as CardNodeData

    const w = node.width ?? nodeData.width ?? DEFAULT_CARD_WIDTH
    const h = node.height ?? (nodeData.collapsed ? COLLAPSED_CARD_HEIGHT : (nodeData.height ?? DEFAULT_CARD_HEIGHT))
    const cardCenter = {
      x: node.position.x + w / 2,
      y: node.position.y + h / 2,
    }

    const containingFrame = frameNodes.find(frame => isPointInNode(cardCenter, frame))

    setNodes(nds => nds.map(n => {
      if (n.id !== node.id) return n
      const nd = n.data as CardNodeData

      if (containingFrame && containingFrame.id !== nd.frameId) {
        const local = globalToLocal(n.position, containingFrame)
        return {
          ...n,
          data: { ...n.data, frameId: containingFrame.id, localX: local.x, localY: local.y },
        }
      } else if (!containingFrame && nd.frameId) {
        return {
          ...n,
          data: { ...n.data, frameId: undefined, localX: undefined, localY: undefined },
        }
      }
      return n
    }))
  }, [setEdges, setNodes, reactFlowInstance])

  return { onNodeDrag, onNodeDragStop }
}
