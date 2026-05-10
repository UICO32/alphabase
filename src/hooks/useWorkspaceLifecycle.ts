import { useEffect, useRef, useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { useCardStore } from '../utils/cardStore'
import { useBoardStore } from '../utils/boardStore'

interface UseWorkspaceLifecycleOptions {
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void
  nodesRef: React.RefObject<Node[]>
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
}

function defaultBoardNodes(boardId: string) {
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

    ensureGlobalDemoCards()
    ensureDefaultBoard()

    const activeId = useBoardStore.getState().activeBoardId
    if (activeId) {
      switchToBoard(activeId)
    }
  }, [switchToBoard])
}
