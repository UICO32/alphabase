import { create } from 'zustand'
import type { BoardMeta } from './workspace/types'

interface BoardStore {
  boards: BoardMeta[]
  activeBoardId: string | null
  isLoaded: boolean
  setBoards: (boards: BoardMeta[]) => void
  addBoard: (board: BoardMeta) => void
  updateBoard: (id: string, props: Partial<BoardMeta>) => void
  deleteBoard: (id: string) => void
  setActiveBoard: (id: string | null) => void
  setLoaded: (loaded: boolean) => void
}

export const useBoardStore = create<BoardStore>()((set) => ({
  boards: [],
  activeBoardId: null,
  isLoaded: false,

  setBoards: (boards) => set({ boards, isLoaded: true }),

  addBoard: (board) =>
    set((state) => ({ boards: [...state.boards, board] })),

  updateBoard: (id, props) =>
    set((state) => ({
      boards: state.boards.map((b) => (b.id === id ? { ...b, ...props } : b)),
    })),

  deleteBoard: (id) =>
    set((state) => ({
      boards: state.boards.filter((b) => b.id !== id),
      activeBoardId: state.activeBoardId === id ? null : state.activeBoardId,
    })),

  setActiveBoard: (id) => set({ activeBoardId: id }),
  setLoaded: (loaded) => set({ isLoaded: loaded }),
}))
