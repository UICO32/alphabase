import { useEffect, useRef, useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { useCardStore } from '../utils/cardStore'
import { useBoardStore } from '../utils/boardStore'
import { WorkspaceService } from '../services/WorkspaceService'
import { WorkspaceSyncEngine, initElectronFSAdapter, cardFileToGlobalCard } from '../utils/workspace'

const LAST_WORKSPACE_KEY = 'hepta-last-workspace-path'

interface UseWorkspaceLifecycleOptions {
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void
  nodesRef: React.RefObject<Node[]>
}

function defaultBoardNodes(_boardId: string) {
  return {
    nodes: [] as Array<{ id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown>; width?: number; height?: number }>,
    edges: [] as Array<{ id: string; source: string; target: string; type?: string }>,
  }
}

function createDemoCardContent(title: string) {
  return `[{"type":"heading","props":{"level":2},"content":[{"type":"text","text":"${title}"}]}]`
}

function ensureGlobalDemoCards() {
  const cards = useCardStore.getState().cards
  if (Object.keys(cards).length > 0) return

  const demos = [
    { id: 'card-demo-1', title: '欢迎使用', color: 'blue' as const, variant: 'solid' as const },
    { id: 'card-demo-2', title: '功能特性', color: 'green' as const, variant: 'glass' as const },
    { id: 'card-demo-3', title: '快速开始', color: 'yellow' as const, variant: 'outline' as const },
  ]

  demos.forEach(d => {
    useCardStore.getState().addCard({
      id: d.id,
      content: createDemoCardContent(d.title),
      color: d.color,
      variant: d.variant,
      createdAt: Date.now(),
      title: d.title,
    })
  })
}

function ensureDefaultBoard() {
  const boardStore = useBoardStore.getState()
  if (boardStore.boards.length > 0) return

  const id = 'board-default'
  boardStore.addBoard({
    id,
    name: '默认画板',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
  boardStore.setActiveBoard(id)

  // Save demo board data so switchToBoard finds non-empty nodes/edges
  boardStore.saveBoardData(id, demoBoardNodes(id))
}

function demoBoardNodes(boardId: string) {
  return {
    nodes: [
      { id: 'card-demo-1', type: 'card' as const, position: { x: 100, y: 100 }, data: { cardId: 'card-demo-1', color: 'blue', variant: 'solid', width: 280, height: 200 }, width: 280, height: 200 },
      { id: 'card-demo-2', type: 'card' as const, position: { x: 500, y: 150 }, data: { cardId: 'card-demo-2', color: 'green', variant: 'glass', width: 280, height: 200 }, width: 280, height: 200 },
      { id: 'card-demo-3', type: 'card' as const, position: { x: 300, y: 400 }, data: { cardId: 'card-demo-3', color: 'yellow', variant: 'outline', width: 280, height: 200 }, width: 280, height: 200 },
    ],
    edges: [
      { id: `edge-${boardId}-a`, source: 'card-demo-1', target: 'card-demo-2', type: 'connection' as const },
      { id: `edge-${boardId}-b`, source: 'card-demo-2', target: 'card-demo-3', type: 'connection' as const },
    ],
  }
}

export function useWorkspaceLifecycle({ setNodes, setEdges, nodesRef }: UseWorkspaceLifecycleOptions) {
  const booted = useRef(false)
  const syncEngineRef = useRef<WorkspaceSyncEngine | null>(null)
  const activeBoardIdRef = useRef<string | null>(null)

  const switchToBoard = useCallback((boardId: string) => {
    const boardStore = useBoardStore.getState()

    if (activeBoardIdRef.current === boardId) return

    // Save current board data before switching
    if (activeBoardIdRef.current && nodesRef.current) {
      boardStore.saveBoardData(activeBoardIdRef.current, {
        nodes: nodesRef.current.map(n => ({
          id: n.id, type: n.type || 'card',
          position: { ...n.position }, data: { ...n.data },
          width: n.width as number | undefined, height: n.height as number | undefined,
        })),
        edges: [],
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

  useEffect(() => {
    if (booted.current) return
    booted.current = true

    ;(async () => {
      // 1. Init filesystem adapter
      initElectronFSAdapter()

      const service = new WorkspaceService()

      // 2. Get or select workspace path
      let workspacePath = localStorage.getItem(LAST_WORKSPACE_KEY)

      if (!workspacePath) {
        const electronAPI = (window as unknown as { electronAPI?: { dialog: { openDirectory: () => Promise<string | null> } } }).electronAPI
        if (electronAPI?.dialog?.openDirectory) {
          const result = await electronAPI.dialog.openDirectory()
          if (result) {
            workspacePath = result
            localStorage.setItem(LAST_WORKSPACE_KEY, workspacePath)
          }
        }
      }

      if (!workspacePath) {
        // No workspace - fall back to demo mode
        console.warn('No workspace selected, using demo mode')
        ensureGlobalDemoCards()
        ensureDefaultBoard()
        const activeId = useBoardStore.getState().activeBoardId
        if (activeId) {
          switchToBoard(activeId)
        }
        return
      }

      service.setWorkspacePath(workspacePath)

      // 3. Init syncEngine
      const syncEngine = new WorkspaceSyncEngine()
      await syncEngine.init(workspacePath)
      syncEngineRef.current = syncEngine

      // 4. Load manifest
      const manifest = await service.loadManifest()
      useBoardStore.getState().setBoards(manifest.boards)

      // 5. Load cards
      const cardFiles = await service.loadAllCards()
      const globalCards: Record<string, ReturnType<typeof cardFileToGlobalCard>> = {}
      for (const cf of cardFiles) {
        globalCards[cf.id] = cardFileToGlobalCard(cf)
      }
      await useCardStore.getState().loadCardsFromDB(globalCards)

      // 6. Load board snapshots
      for (const board of manifest.boards) {
        const snapshot = await service.loadBoard(board.id)
        if (snapshot) {
          useBoardStore.getState().saveBoardData(board.id, {
            nodes: snapshot.nodes,
            edges: snapshot.edges,
          })
        }
      }

      // 7. Load trash
      try {
        const trashItems = await service.loadAllTrash()
        const { useTrashStore } = await import('../utils/trashStore')
        for (const item of trashItems) {
          if (item.expiresAt > Date.now()) {
            useTrashStore.getState().addItem({
              id: item.id,
              cardId: item.cardId,
              title: item.title,
              content: item.content,
            })
          }
        }
      } catch (e) {
        console.warn('Failed to load trash:', e)
      }

      // 8. Clean expired trash
      try {
        await service.cleanExpiredTrash()
      } catch (e) {
        console.warn('Failed to clean trash:', e)
      }

      // 9. Switch to active board
      const activeId = useBoardStore.getState().activeBoardId
      if (activeId) {
        switchToBoard(activeId)
      } else if (manifest.boards.length > 0) {
        useBoardStore.getState().setActiveBoard(manifest.boards[0].id)
        switchToBoard(manifest.boards[0].id)
      }
    })()
  }, [switchToBoard])

  return syncEngineRef
}
