import { useEffect, useRef, useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { useBoardStore } from '../stores/boardStore'
import { getActiveSyncEngine } from '../sync/syncEngineRef'
import { subscribeCardStore, subscribeBoardStore, subscribeTrashStore } from '../sync/subscribeStores'

interface UseWorkspaceLifecycleOptions {
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void
  nodesRef: React.RefObject<Node[]>
  edgesRef: React.RefObject<Edge[]>
}

function defaultBoardNodes(_boardId: string) {
  return {
    nodes: [] as Array<{ id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown>; width?: number; height?: number }>,
    edges: [] as Array<{ id: string; source: string; target: string; type?: string }>,
  }
}

export function useWorkspaceLifecycle({ setNodes, setEdges, nodesRef, edgesRef }: UseWorkspaceLifecycleOptions) {
  const activeBoardIdRef = useRef<string | null>(null)
  const unsubsRef = useRef<Array<() => void> | null>(null)
  const syncingRef = useRef(false)

  const switchToBoard = useCallback((boardId: string) => {
    const boardStore = useBoardStore.getState()

    if (activeBoardIdRef.current === boardId) return

    if (activeBoardIdRef.current && nodesRef.current) {
      boardStore.saveBoardData(activeBoardIdRef.current, {
        nodes: nodesRef.current.map(n => ({
          id: n.id, type: n.type || 'card',
          position: { ...n.position }, data: { ...n.data },
          width: n.width as number | undefined, height: n.height as number | undefined,
        })),
        edges: edgesRef.current ? edgesRef.current.map(e => ({
          id: e.id, source: e.source, target: e.target,
          type: (e.type || 'connection') as string,
          sourceHandle: e.sourceHandle ?? undefined,
          targetHandle: e.targetHandle ?? undefined,
        })) : [],
      })
    }

    activeBoardIdRef.current = boardId

    let boardData = boardStore.getBoardData(boardId)
    if (!boardData) {
      boardData = defaultBoardNodes(boardId)
      boardStore.saveBoardData(boardId, boardData)
    }

    setNodes(boardData.nodes as Node[])
    setEdges(boardData.edges as Edge[])
  }, [setNodes, setEdges, nodesRef])

  // Subscribe to board switch events
  useEffect(() => {
    const handleBoardSwitch = (e: Event) => {
      const boardId = (e as CustomEvent).detail?.boardId
      if (boardId && activeBoardIdRef.current !== boardId) {
        useBoardStore.getState().setActiveBoard(boardId)
        switchToBoard(boardId)
      }
    }

    window.addEventListener('hepta-switch-board', handleBoardSwitch)
    return () => window.removeEventListener('hepta-switch-board', handleBoardSwitch)
  }, [switchToBoard])

  // React to activeBoardId changes from store (e.g. LeftPanel clicks)
  const activeBoardId = useBoardStore((s) => s.activeBoardId)
  useEffect(() => {
    if (activeBoardId && activeBoardId !== activeBoardIdRef.current) {
      switchToBoard(activeBoardId)
    }
  }, [activeBoardId, switchToBoard])

  // When data is loaded (signaled by hepta-data-ready), render the active board
  // and subscribe stores to the sync engine
  useEffect(() => {
    const handleDataReady = async () => {
      const boardStore = useBoardStore.getState()
      const activeId = boardStore.activeBoardId

      if (activeId) {
        switchToBoard(activeId)
      } else if (boardStore.boards.length > 0) {
        boardStore.setActiveBoard(boardStore.boards[0].id)
        switchToBoard(boardStore.boards[0].id)
      }

      // Initialize embedding service in background — don't block board rendering
      const scheduleEmbeddingInit = () => {
        const workspacePath = localStorage.getItem('hepta-last-workspace-path')
        if (workspacePath && window.electronAPI?.embedding?.init) {
          window.electronAPI.embedding.init(workspacePath).catch((err: any) => {
            console.error('[lifecycle] embedding.init failed:', err)
          })
        }
      }
      if ('requestIdleCallback' in window) {
        requestIdleCallback(scheduleEmbeddingInit, { timeout: 5000 })
      } else {
        setTimeout(scheduleEmbeddingInit, 3000)
      }

      // Subscribe stores to the new sync engine
      const syncEngine = getActiveSyncEngine()
      if (syncEngine && !syncingRef.current) {
        syncingRef.current = true
        const unsubs = [
          subscribeCardStore(syncEngine),
          subscribeBoardStore(syncEngine),
          subscribeTrashStore(syncEngine),
        ]
        unsubsRef.current = unsubs
      }
    }

    window.addEventListener('hepta-data-ready', handleDataReady)
    return () => window.removeEventListener('hepta-data-ready', handleDataReady)
  }, [switchToBoard])

  // On workspace switch: save current board, unsubscribe, reset state
  // Do NOT stop the sync engine here — App.tsx manages that
  useEffect(() => {
    const handleReinit = () => {
      // Unsubscribe from old sync engine
      if (unsubsRef.current) {
        unsubsRef.current.forEach(fn => fn())
        unsubsRef.current = null
      }
      syncingRef.current = false
      activeBoardIdRef.current = null
    }
    window.addEventListener('hepta-reinit-workspace', handleReinit)
    return () => window.removeEventListener('hepta-reinit-workspace', handleReinit)
  }, [])

  // Cleanup on unmount only — never stop sync engine from reactive state changes
  useEffect(() => {
    return () => {
      if (unsubsRef.current) {
        unsubsRef.current.forEach(fn => fn())
        unsubsRef.current = null
      }
    }
  }, [])
}