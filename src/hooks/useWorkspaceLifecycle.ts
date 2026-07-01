import { useEffect, useRef, useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { useBoardStore } from '../stores/boardStore'
import { useEvent } from './useEvent'
import { serializeBoardData } from '../sync/boardSnapshot'

interface UseWorkspaceLifecycleOptions {
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void
  nodesRef: React.RefObject<Node[]>
  edgesRef: React.RefObject<Edge[]>
}

function defaultBoardNodes(_boardId: string) {
  return {
    nodes: [] as Array<{
      id: string
      type: string
      position: { x: number; y: number }
      data: Record<string, unknown>
      width?: number
      height?: number
    }>,
    edges: [] as Array<{ id: string; source: string; target: string; type?: string }>,
  }
}

export function useWorkspaceLifecycle({ setNodes, setEdges, nodesRef, edgesRef }: UseWorkspaceLifecycleOptions) {
  const activeBoardIdRef = useRef<string | null>(null)

  const switchToBoard = useCallback((boardId: string) => {
    const boardStore = useBoardStore.getState()

    if (activeBoardIdRef.current === boardId) return

    if (activeBoardIdRef.current && nodesRef.current) {
      boardStore.saveBoardData(
        activeBoardIdRef.current,
        serializeBoardData(nodesRef.current, edgesRef.current ?? []),
      )
    }

    activeBoardIdRef.current = boardId

    let boardData = boardStore.getBoardData(boardId)
    if (!boardData) {
      boardData = defaultBoardNodes(boardId)
      boardStore.saveBoardData(boardId, boardData)
    }

    setNodes(() => {
      const loaded = boardData.nodes as Node[]
      const frameLayoutById = new Map<string, string>()

      for (const n of loaded) {
        if (n.type === 'frame') {
          const layout = (n.data as Record<string, unknown>).layout
          frameLayoutById.set(n.id, (layout as string) ?? 'free')
        }
      }

      const needsBackfill = loaded.some(
        n => n.type !== 'frame'
          && (n.data as Record<string, unknown>).frameId
          && (n.data as Record<string, unknown>).frameLayout === undefined,
      )

      const normalized = needsBackfill
        ? loaded.map(n => {
            const fid = (n.data as Record<string, unknown>).frameId as string | undefined
            if (!fid || n.type === 'frame') return n
            const layout = frameLayoutById.get(fid) ?? 'free'
            return { ...n, data: { ...n.data, frameLayout: layout } }
          })
        : loaded

      return normalized.map(n => ({
        ...n,
        zIndex: n.type === 'frame' ? -10 : 10,
        ...(n.type === 'frame' ? { dragHandle: '.frame-drag-handle' } : {}),
      }))
    })
    setEdges(boardData.edges as Edge[])
  }, [setNodes, setEdges, nodesRef, edgesRef])

  useEvent('switch-board', (detail) => {
    if (detail.boardId && activeBoardIdRef.current !== detail.boardId) {
      useBoardStore.getState().setActiveBoard(detail.boardId)
      switchToBoard(detail.boardId)
    }
  }, [switchToBoard])

  const activeBoardId = useBoardStore((s) => s.activeBoardId)
  useEffect(() => {
    if (activeBoardId && activeBoardId !== activeBoardIdRef.current) {
      switchToBoard(activeBoardId)
    }
  }, [activeBoardId, switchToBoard])

  useEvent('data-ready', async () => {
    const boardStore = useBoardStore.getState()
    const activeId = boardStore.activeBoardId

    if (activeId) {
      switchToBoard(activeId)
    } else if (boardStore.boards.length > 0) {
      boardStore.setActiveBoard(boardStore.boards[0].id)
      switchToBoard(boardStore.boards[0].id)
    }

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
  }, [switchToBoard])

  useEvent('reinit-workspace', () => {
    activeBoardIdRef.current = null
  })
}
