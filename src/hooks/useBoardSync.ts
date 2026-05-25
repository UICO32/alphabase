import { useEffect, useRef, useCallback } from 'react'
import { type Node, type Edge } from '@xyflow/react'
import { useBoardStore } from '../stores/boardStore'

// 提取共享的序列化逻辑，避免 syncToStore 和 unmount effect 中重复定义
function serializeBoardData(nodes: Node[], edges: Edge[]) {
  return {
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
  }
}

export function useBoardSync({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  const activeBoardId = useBoardStore((s) => s.activeBoardId)
  const isLoaded = useBoardStore((s) => s.isLoaded)
  const saveBoardData = useBoardStore((s) => s.saveBoardData)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLoadedRef = useRef(isLoaded)

  isLoadedRef.current = isLoaded

  const syncToStore = useCallback(() => {
    if (!activeBoardId || !isLoadedRef.current) return
    saveBoardData(activeBoardId, serializeBoardData(nodes, edges))
  }, [activeBoardId, nodes, edges, saveBoardData])

  useEffect(() => {
    if (!isLoaded) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(syncToStore, 600)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isLoaded, syncToStore])

  // Flush pending save on unmount so board data isn't lost when canvas unmounts
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (!isLoadedRef.current) return
      const boardStore = useBoardStore.getState()
      if (boardStore.activeBoardId) {
        boardStore.saveBoardData(boardStore.activeBoardId, serializeBoardData(nodes, edges))
      }
    }
  }, [nodes, edges])

  // Force-save current board when workspace is about to switch
  useEffect(() => {
    const handler = () => {
      syncToStore()
    }
    window.addEventListener('hepta-save-current-board', handler)
    return () => window.removeEventListener('hepta-save-current-board', handler)
  }, [syncToStore])
}