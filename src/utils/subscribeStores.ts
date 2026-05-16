import type { WorkspaceSyncEngine } from './workspace/syncEngine'
import { useCardStore } from './cardStore'
import { useBoardStore } from './boardStore'
import { useTrashStore } from './trashStore'
import { globalCardToCardFile } from './workspace/cardConverter'

export function subscribeCardStore(syncEngine: WorkspaceSyncEngine) {
  let prevCards = useCardStore.getState().cards

  return useCardStore.subscribe((state) => {
    const cards = state.cards

    for (const id in cards) {
      if (cards[id] !== prevCards[id]) {
        const cardFile = globalCardToCardFile(cards[id])
        syncEngine.scheduleWriteCard(cardFile)
      }
    }

    for (const id in prevCards) {
      if (!(id in cards)) {
        syncEngine.scheduleDeleteCard(id)
      }
    }

    prevCards = cards
  })
}

export function subscribeBoardStore(syncEngine: WorkspaceSyncEngine) {
  let prevBoards = useBoardStore.getState().boards
  let prevBoardData = useBoardStore.getState().boardData

  return useBoardStore.subscribe((state) => {
    if (state.boards !== prevBoards) {
      syncEngine.scheduleWriteManifest({ boards: state.boards })
      prevBoards = state.boards
    }

    if (state.boardData !== prevBoardData) {
      for (const boardId in state.boardData) {
        if (state.boardData[boardId] !== prevBoardData[boardId]) {
          const data = state.boardData[boardId]
          syncEngine.scheduleWriteBoard(boardId, {
            version: 2,
            nodes: data.nodes.map(n => ({
              id: n.id,
              type: (n.type === 'card' || n.type === 'section') ? n.type as 'card' | 'section' : 'card',
              position: { x: n.position.x, y: n.position.y },
              data: n.data as { cardId?: string; color?: string; collapsed?: boolean; fixedHeight?: boolean; width?: number; height?: number; name?: string },
              width: n.width,
              height: n.height,
            })),
            edges: data.edges.map(e => ({
              id: e.id,
              source: e.source,
              target: e.target,
              type: 'connection' as const,
            })),
            viewport: { x: 0, y: 0, zoom: 1 },
          })
        }
      }
      prevBoardData = state.boardData
    }
  })
}

export function subscribeTrashStore(syncEngine: WorkspaceSyncEngine) {
  let prevItems = useTrashStore.getState().items

  return useTrashStore.subscribe((state) => {
    for (const item of state.items) {
      const prev = prevItems.find(i => i.cardId === item.cardId)
      if (!prev) {
        syncEngine.scheduleWriteTrash({
          id: item.id,
          cardId: item.cardId,
          title: item.title,
          deletedAt: item.deletedAt,
          expiresAt: item.expiresAt,
          content: item.content,
          color: item.color,
          createdAt: item.createdAt,
        })
      }
    }

    for (const prev of prevItems) {
      if (!state.items.find(i => i.cardId === prev.cardId)) {
        syncEngine.scheduleDeleteTrashFile(prev.cardId)
      }
    }

    prevItems = state.items
  })
}