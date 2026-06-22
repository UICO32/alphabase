import { useEffect, useRef, useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { useBoardStore } from '../stores/boardStore'
import { useEvent } from './useEvent'

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

    setNodes((boardData.nodes as Node[]).map(n => ({
      ...n,
      zIndex: n.type === 'frame' ? -10 : 10,
      ...(n.type === 'frame' ? { dragHandle: '.frame-drag-handle' } : {}),
    })))
    setEdges(boardData.edges as Edge[])
  }, [setNodes, setEdges, nodesRef])

  // Subscribe to board switch events
  useEvent('switch-board', (detail) => {
    if (detail.boardId && activeBoardIdRef.current !== detail.boardId) {
      useBoardStore.getState().setActiveBoard(detail.boardId)
      switchToBoard(detail.boardId)
    }
  }, [switchToBoard])

  // React to activeBoardId changes from store (e.g. LeftPanel clicks)
  const activeBoardId = useBoardStore((s) => s.activeBoardId)
  useEffect(() => {
    if (activeBoardId && activeBoardId !== activeBoardIdRef.current) {
      switchToBoard(activeBoardId)
    }
  }, [activeBoardId, switchToBoard])

  // When data is loaded (signaled by data-ready), render the active board
  // and subscribe stores to the sync engine
  useEvent('data-ready', async () => {
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
        window.electronAPI.embedding.init(workspacePath).catch((err: unknown) => {
          console.error('[lifecycle] embedding.init failed:', err)
        })
      }
    }
    if ('requestIdleCallback' in window) {
      requestIdleCallback(scheduleEmbeddingInit, { timeout: 5000 })
    } else {
      setTimeout(scheduleEmbeddingInit, 3000)
    }

    // store→磁盘的订阅现在由模块级 subscriptionManager 管理
    // （在 useWorkspaceDataLoader 的 reloadFromDB 之后 setupSubscriptions），
    // 不再绑定到本组件生命周期，避免视图切换卸载组件时订阅被清理。
  }, [switchToBoard])

  // On workspace switch: save current board, reset state
  // 订阅清理与 sync engine 停止由 App.tsx 的 workspace-changed 处理
  // （cleanupSubscriptions + stopActiveSyncEngine），这里只重置 board 状态
  useEvent('reinit-workspace', () => {
    activeBoardIdRef.current = null
  })
}