import { useEffect, useRef, useCallback, useState } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { useBoardStore } from '../utils/boardStore'
import { getActiveSyncEngine, setActiveSyncEngine } from '../utils/syncEngineRef'
import { subscribeCardStore, subscribeBoardStore, subscribeTrashStore } from '../utils/subscribeStores'

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
  const [canvasReady, setCanvasReady] = useState(false)

  // Reset canvas ready when workspace changes
  useEffect(() => {
    const handleReinit = () => {
      setCanvasReady(false)
      activeBoardIdRef.current = null
    }
    window.addEventListener('hepta-reinit-workspace', handleReinit)
    return () => window.removeEventListener('hepta-reinit-workspace', handleReinit)
  }, [])

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

  // When data is loaded (signaled by hepta-data-ready), render the active board
  useEffect(() => {
    const handleDataReady = () => {
      const boardStore = useBoardStore.getState()
      const activeId = boardStore.activeBoardId
      if (activeId) {
        switchToBoard(activeId)
      } else if (boardStore.boards.length > 0) {
        boardStore.setActiveBoard(boardStore.boards[0].id)
        switchToBoard(boardStore.boards[0].id)
      }
      setCanvasReady(true)
    }

    window.addEventListener('hepta-data-ready', handleDataReady)
    return () => window.removeEventListener('hepta-data-ready', handleDataReady)
  }, [switchToBoard])

  // Subscribe stores to syncEngine when canvas is ready
  useEffect(() => {
    if (!canvasReady) return
    const syncEngine = getActiveSyncEngine()
    if (!syncEngine) return

    const unsubs = [
      subscribeCardStore(syncEngine),
      subscribeBoardStore(syncEngine),
      subscribeTrashStore(syncEngine),
    ]

    const handleBeforeUnload = () => {
      syncEngine.stop()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      unsubs.forEach(fn => fn())
      setActiveSyncEngine(null)
      syncEngine.stop()
    }
  }, [canvasReady])

  return { canvasReady }
}