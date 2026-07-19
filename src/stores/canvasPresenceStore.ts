import { create } from 'zustand'

interface CanvasPresenceState {
  boardId: string | null
  cardIds: ReadonlySet<string>
  setCanvasPresence: (boardId: string, cardIds: ReadonlySet<string>) => void
  clearCanvasPresence: () => void
}

const EMPTY_CARD_IDS: ReadonlySet<string> = new Set()

function setsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  if (left.size !== right.size) return false
  for (const id of left) {
    if (!right.has(id)) return false
  }
  return true
}

export const useCanvasPresenceStore = create<CanvasPresenceState>()((set) => ({
  boardId: null,
  cardIds: EMPTY_CARD_IDS,
  setCanvasPresence: (boardId, cardIds) => set((state) => {
    if (state.boardId === boardId && setsEqual(state.cardIds, cardIds)) return state
    return { boardId, cardIds: new Set(cardIds) }
  }),
  clearCanvasPresence: () => set((state) => (
    state.boardId === null && state.cardIds.size === 0
      ? state
      : { boardId: null, cardIds: EMPTY_CARD_IDS }
  )),
}))
