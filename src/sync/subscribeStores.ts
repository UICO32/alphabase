import type { WorkspaceSyncEngine } from './syncEngine'
import { useCardStore } from '../stores/cardStore'
import { useBoardStore } from '../stores/boardStore'
import { useTrashStore, type TrashItem } from '../stores/trashStore'
import { globalCardToCardFile } from '../converters/cardConverter'
import type { WorkspaceMetadata } from '../utils/workspace/types'

function buildCurrentMetadata(): WorkspaceMetadata {
  const cardCount = Object.keys(useCardStore.getState().cards).length
  const boardCount = useBoardStore.getState().boards.length
  return { version: 1, cardCount, boardCount, lastModified: Date.now() }
}

export function subscribeCardStore(syncEngine: WorkspaceSyncEngine) {
  let prevCards = useCardStore.getState().cards

  return useCardStore.subscribe((state) => {
    const cards = state.cards
    let cardCountChanged = false

    for (const id in cards) {
      if (cards[id] !== prevCards[id]) {
        const cardFile = globalCardToCardFile(cards[id])
        syncEngine.scheduleWriteCard(cardFile)
        if (!(id in prevCards)) cardCountChanged = true
      }
    }

    for (const id in prevCards) {
      if (!(id in cards)) {
        syncEngine.scheduleDeleteCard(id)
        cardCountChanged = true
      }
    }

    if (cardCountChanged) {
      syncEngine.scheduleWriteMetadata(buildCurrentMetadata())
    }

    prevCards = cards
  })
}

export function subscribeBoardStore(syncEngine: WorkspaceSyncEngine) {
  let prevBoards = useBoardStore.getState().boards
  let prevBoardData = useBoardStore.getState().boardData

  const unsub = useBoardStore.subscribe((state) => {
    if (state.boards !== prevBoards) {
      syncEngine.scheduleWriteManifest({ boards: state.boards })
      if (state.boards.length !== prevBoards.length) {
        syncEngine.scheduleWriteMetadata(buildCurrentMetadata())
      }
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
              type: (n.type === 'card' || n.type === 'section' || n.type === 'media') ? n.type as 'card' | 'section' | 'media' : 'card',
              position: { x: n.position.x, y: n.position.y },
              data: n.data as { cardId?: string; color?: string; variant?: string; collapsed?: boolean; fixedHeight?: boolean; width?: number; height?: number; name?: string; url?: string },
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
      }
      prevBoardData = state.boardData
    }
  })

  return unsub
}

export function subscribeTrashStore(syncEngine: WorkspaceSyncEngine) {
  // 用 Map 代替 Array，将 O(n²) find 操作降为 O(1)
  let prevItemsMap = new Map<string, TrashItem>(
    useTrashStore.getState().items.map(i => [i.cardId, i])
  )

  return useTrashStore.subscribe((state) => {
    const currentMap = new Map<string, TrashItem>(state.items.map(i => [i.cardId, i]))

    for (const item of state.items) {
      if (!prevItemsMap.has(item.cardId)) {
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

    for (const [cardId] of prevItemsMap) {
      if (!currentMap.has(cardId)) {
        syncEngine.scheduleDeleteTrashFile(cardId)
      }
    }

    prevItemsMap = currentMap
  })
}