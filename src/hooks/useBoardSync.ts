import { useEffect, useRef, useCallback } from 'react'
import { type Node, type Edge } from '@xyflow/react'
import { useBoardStore } from '../stores/boardStore'
import { useEvent } from './useEvent'
import { getActiveSyncEngine } from '../sync/syncEngineRef'

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
    const data = serializeBoardData(nodes, edges)
    saveBoardData(activeBoardId, data)

    const syncEngine = getActiveSyncEngine()
    if (syncEngine) {
      syncEngine.scheduleWriteBoard(activeBoardId, {
        version: 2,
        nodes: data.nodes.map(n => ({
          id: n.id,
          type: (n.type === 'card' || n.type === 'frame' || n.type === 'media') ? n.type as 'card' | 'frame' | 'media' : 'card',
          position: { x: n.position.x, y: n.position.y },
          data: n.data as { cardId?: string; color?: string; variant?: string; collapsed?: boolean; fixedHeight?: boolean; width?: number; height?: number; name?: string; url?: string; layout?: string; childCardIds?: string[]; frameId?: string; localX?: number; localY?: number; columns?: unknown[]; layoutSnapshots?: Record<string, unknown> },
          width: n.width,
          height: n.height,
        })),
        edges: data.edges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'connection' as const,
          sourceHandle: e.sourceHandle ?? undefined,
          targetHandle: e.targetHandle ?? undefined,
        })),
        viewport: { x: 0, y: 0, zoom: 1 },
      })
    }
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
  useEvent('save-current-board', () => {
    syncToStore()
  }, [syncToStore])
}