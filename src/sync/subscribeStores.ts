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
  let prevCardsMap = new Map<string, ReturnType<typeof useCardStore.getState>['cards'][string]>(
    Object.entries(useCardStore.getState().cards)
  )

  return useCardStore.subscribe((state) => {
    const currentMap = new Map(Object.entries(state.cards))
    let cardCountChanged = false

    for (const [id, card] of currentMap) {
      const prev = prevCardsMap.get(id)
      if (prev !== card) {
        syncEngine.scheduleWriteCard(globalCardToCardFile(card))
        if (!prev) cardCountChanged = true
      }
    }

    for (const [id] of prevCardsMap) {
      if (!currentMap.has(id)) {
        syncEngine.scheduleDeleteCard(id)
        cardCountChanged = true
      }
    }

    if (cardCountChanged) {
      syncEngine.scheduleWriteMetadata(buildCurrentMetadata())
    }

    prevCardsMap = currentMap
  })
}

export function subscribeBoardStore(syncEngine: WorkspaceSyncEngine) {
  let prevBoards = useBoardStore.getState().boards

  const unsub = useBoardStore.subscribe((state) => {
    if (state.boards !== prevBoards) {
      syncEngine.scheduleWriteManifest({ boards: state.boards })
      if (state.boards.length !== prevBoards.length) {
        syncEngine.scheduleWriteMetadata(buildCurrentMetadata())
      }
      prevBoards = state.boards
    }
    // boardData 由 useBoardSync 直写 syncEngine，此处不再订阅
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