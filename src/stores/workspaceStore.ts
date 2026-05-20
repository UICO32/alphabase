import { create } from 'zustand'
import type { WorkspaceMeta, WorkspaceSettings } from './types'
import { DEFAULT_WORKSPACE_SETTINGS } from './types'

interface WorkspaceStore {
  currentWorkspace: WorkspaceMeta | null
  recentWorkspaces: WorkspaceMeta[]
  settings: WorkspaceSettings
  isLoading: boolean
  setCurrentWorkspace: (ws: WorkspaceMeta | null) => void
  addRecentWorkspace: (ws: WorkspaceMeta) => void
  updateSettings: (settings: Partial<WorkspaceSettings>) => void
  setLoading: (loading: boolean) => void
}

export const useWorkspaceStore = create<WorkspaceStore>()((set) => ({
  currentWorkspace: null,
  recentWorkspaces: [],
  settings: DEFAULT_WORKSPACE_SETTINGS,
  isLoading: false,

  setCurrentWorkspace: (ws) => set({ currentWorkspace: ws }),

  addRecentWorkspace: (ws) =>
    set((state) => {
      const filtered = state.recentWorkspaces.filter((r) => r.path !== ws.path)
      return { recentWorkspaces: [ws, ...filtered].slice(0, 10) }
    }),

  updateSettings: (s) =>
    set((state) => ({ settings: { ...state.settings, ...s } })),

  setLoading: (loading) => set({ isLoading: loading }),
}))
