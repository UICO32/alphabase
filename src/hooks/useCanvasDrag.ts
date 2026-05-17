import { useCallback } from 'react'
import { type Edge, type OnNodeDrag } from '@xyflow/react'
import type { ReactFlowInstance } from '@xyflow/react'
import { getBestHandles } from '../utils/geometry'

interface UseCanvasDragOptions {
  reactFlowInstance: React.RefObject<ReactFlowInstance | null>
  setEdges: (updater: Edge[] | ((edges: Edge[]) => Edge[])) => void
}

export function useCanvasDrag({ reactFlowInstance, setEdges }: UseCanvasDragOptions) {
  const onNodeDrag: OnNodeDrag = useCallback(
    (_event, node) => {
      const instance = reactFlowInstance.current
      if (!instance) return
      setEdges((eds) =>
        eds.map((e) => {
          if (e.source !== node.id && e.target !== node.id) return e
          const sourceNode = instance.getNode(e.source)
          const targetNode = instance.getNode(e.target)
          if (!sourceNode || !targetNode) return { ...e }
          const sw = ((sourceNode.data as Record<string, unknown>).width as number) ?? 280
          const sd = sourceNode.data as Record<string, unknown>
          const sh = sd.collapsed ? 80 : ((sd.height as number) ?? 200)
          const tw = ((targetNode.data as Record<string, unknown>).width as number) ?? 280
          const td = targetNode.data as Record<string, unknown>
          const th = td.collapsed ? 80 : ((td.height as number) ?? 200)
          const handles = getBestHandles(sourceNode.position, { w: sw, h: sh }, targetNode.position, { w: tw, h: th })
          return {
            ...e,
            sourceHandle: handles.sourceHandle,
            targetHandle: handles.targetHandle,
          }
        }),
      )
    },
    [reactFlowInstance, setEdges],
  )

  const onNodeDragStop = useCallback(() => {
    setEdges((eds) => [...eds])
  }, [setEdges])

  return { onNodeDrag, onNodeDragStop }
}