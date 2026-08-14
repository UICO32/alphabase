import { create } from 'zustand'

interface MediaPlaybackState {
  activeNodeId: string | null
  activate: (nodeId: string) => void
  deactivate: (nodeId?: string) => void
}

export const useMediaPlaybackStore = create<MediaPlaybackState>((set) => ({
  activeNodeId: null,
  activate: (nodeId) => set({ activeNodeId: nodeId }),
  deactivate: (nodeId) => set((state) => (
    nodeId && state.activeNodeId !== nodeId ? state : { activeNodeId: null }
  )),
}))
