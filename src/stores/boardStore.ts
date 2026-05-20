import { create } from 'zustand'
import type { BoardMeta } from '../utils/workspace/types'

interface BoardNodesData {
  nodes: Array<{ id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown>; width?: number; height?: number }>
  edges: Array<{ id: string; source: string; target: string; type?: string; sourceHandle?: string; targetHandle?: string }>
}

interface BoardStore {
  boards: BoardMeta[]
  activeBoardId: string | null
  isLoaded: boolean
  boardData: Record<string, BoardNodesData>
  setBoards: (boards: BoardMeta[]) => void
  addBoard: (board: BoardMeta) => void
  updateBoard: (id: string, props: Partial<BoardMeta>) => void
  deleteBoard: (id: string) => void
  setActiveBoard: (id: string | null) => void
  setLoaded: (loaded: boolean) => void
  saveBoardData: (boardId: string, data: BoardNodesData) => void
  getBoardData: (boardId: string) => BoardNodesData | undefined
}

export const useBoardStore = create<BoardStore>()(
  (set, get) => ({
      boards: [],
      activeBoardId: null,
      isLoaded: false,
      boardData: {},

      setBoards: (boards) => set({ boards, isLoaded: true }),

      addBoard: (board) =>
        set((state) => ({ boards: [...state.boards, board] })),

      updateBoard: (id, props) =>
        set((state) => ({
          boards: state.boards.map((b) => (b.id === id ? { ...b, ...props } : b)),
        })),

      deleteBoard: (id) =>
        set((state) => {
          const { [id]: _, ...rest } = state.boardData
          return {
            boards: state.boards.filter((b) => b.id !== id),
            activeBoardId: state.activeBoardId === id ? null : state.activeBoardId,
            boardData: rest,
          }
        }),

      setActiveBoard: (id) => set({ activeBoardId: id }),
      setLoaded: (loaded) => set({ isLoaded: loaded }),

      saveBoardData: (boardId, data) =>
        set((state) => ({ boardData: { ...state.boardData, [boardId]: data } })),

      getBoardData: (boardId) => get().boardData[boardId],
  }),
)
