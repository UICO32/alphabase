import { useCardStore } from './cardStore'
import { useBoardStore } from './boardStore'
import { cardFileToGlobalCard } from '../converters/cardConverter'

/**
 * Migrate existing localStorage data to the store
 * Called when user first switches to filesystem persistence
 * The syncEngine subscription will automatically write to disk
 */
export function migrateFromLocalStorageIfNeeded(): boolean {
  const cardStore = useCardStore.getState()

  // Skip if store already has data (loaded from filesystem)
  if (Object.keys(cardStore.cards).length > 0) return false

  let migrated = false

  // Migrate cards
  try {
    const stored = localStorage.getItem('hepta-card-store')
    if (stored) {
      const parsed = JSON.parse(stored)
      const cards: Record<string, unknown> = parsed?.state?.cards || {}
      if (Object.keys(cards).length > 0) {
        const globalCards: Record<string, ReturnType<typeof cardFileToGlobalCard>> = {}
        for (const [id, card] of Object.entries(cards)) {
          globalCards[id] = cardFileToGlobalCard(card as Parameters<typeof cardFileToGlobalCard>[0])
        }
        cardStore.importCards(globalCards as Parameters<typeof cardStore.importCards>[0])
        migrated = true
      }
    }
  } catch (e) {
    console.warn('Failed to migrate card store:', e)
  }

  // Migrate boards
  try {
    const stored = localStorage.getItem('hepta-board-store')
    if (stored) {
      const parsed = JSON.parse(stored)
      const boardState = parsed?.state
      if (boardState) {
        const boardStore = useBoardStore.getState()
        if (boardState.boards && boardState.boards.length > 0) {
          boardStore.setBoards(boardState.boards)
        }
        if (boardState.activeBoardId) {
          boardStore.setActiveBoard(boardState.activeBoardId)
        }
        if (boardState.boardData) {
          for (const [id, data] of Object.entries(boardState.boardData)) {
            boardStore.saveBoardData(id, data as Parameters<typeof boardStore.saveBoardData>[1])
          }
        }
        migrated = true
      }
    }
  } catch (e) {
    console.warn('Failed to migrate board store:', e)
  }

  return migrated
}
