import { useEffect, useRef, useCallback } from 'react'
import { type Node, type Edge } from '@xyflow/react'
import { useBoardStore } from '../stores/boardStore'

interface UseBoardSyncOptions {
  nodes: Node[]
  edges: Edge[]
}

export function useBoardSync({ nodes, edges }: UseBoardSyncOptions) {
  const activeBoardId = useBoardStore((s) => s.activeBoardId)
  const saveBoardData = useBoardStore((s) => s.saveBoardData)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const syncToStore = useCallback(() => {
    if (!activeBoardId) return

    saveBoardData(activeBoardId, {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type || 'card',
        position: { x: n.position.x, y: n.position.y },
        data: { ...n.data },
        width: n.width as number | undefined,
        height: n.height as number | undefined,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: (e.type || 'connection') as string,
        sourceHandle: e.sourceHandle ?? undefined,
        targetHandle: e.targetHandle ?? undefined,
      })),
    })
  }, [activeBoardId, nodes, edges, saveBoardData])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(syncToStore, 600)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [syncToStore])
}