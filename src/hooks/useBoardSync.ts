import { useEffect, useRef, useCallback } from 'react'
import { type Node, type Edge } from '@xyflow/react'
import { useBoardStore } from '../stores/boardStore'
import { useEvent } from './useEvent'
import { getActiveSyncEngine } from '../sync/syncEngineRef'
import { serializeBoardData } from '../sync/boardSnapshot'

export function useBoardSync({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  const activeBoardId = useBoardStore((s) => s.activeBoardId)
  const isLoaded = useBoardStore((s) => s.isLoaded)
  const saveBoardData = useBoardStore((s) => s.saveBoardData)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLoadedRef = useRef(isLoaded)
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)

  isLoadedRef.current = isLoaded
  nodesRef.current = nodes
  edgesRef.current = edges

  const syncToStore = useCallback(() => {
    if (!activeBoardId || !isLoadedRef.current) return

    const data = serializeBoardData(nodes, edges)
    saveBoardData(activeBoardId, data)

    const syncEngine = getActiveSyncEngine()
    if (syncEngine) {
      syncEngine.scheduleWriteBoard(activeBoardId, {
        version: 2,
        nodes: data.nodes,
        edges: data.edges,
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

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (!isLoadedRef.current) return

      const boardStore = useBoardStore.getState()
      if (boardStore.activeBoardId) {
        boardStore.saveBoardData(
          boardStore.activeBoardId,
          serializeBoardData(nodesRef.current, edgesRef.current),
        )
      }
    }
  }, [])

  useEvent('save-current-board', () => {
    syncToStore()
  }, [syncToStore])
}
