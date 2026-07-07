import { create } from 'zustand'

const SIDEBAR_WIDTH_MIN = 260
const SIDEBAR_WIDTH_MAX = 600
const SIDEBAR_WIDTH_DEFAULT = 260

interface PanelStore {
  leftPanelCollapsed: boolean
  setLeftPanelCollapsed: (collapsed: boolean) => void

  rightPanelCollapsed: boolean
  setRightPanelCollapsed: (collapsed: boolean) => void
  rightPanelWidth: number
  setRightPanelWidth: (width: number) => void
  rightPanelActiveTab: 'library' | 'editor' | 'channels'
  setRightPanelActiveTab: (tab: 'library' | 'editor' | 'channels') => void

  userSwitchedTab: boolean
  markUserSwitchedTab: () => void
  resetUserSwitchedTab: () => void

  toggleAllSidebars: () => void
}

export const usePanelStore = create<PanelStore>()(
  (set, get) => ({
    leftPanelCollapsed: false,
    rightPanelCollapsed: false,
    rightPanelWidth: SIDEBAR_WIDTH_DEFAULT,
    rightPanelActiveTab: 'library',
    userSwitchedTab: false,

    setLeftPanelCollapsed: (collapsed) => set((state) => (
      state.leftPanelCollapsed === collapsed ? state : { leftPanelCollapsed: collapsed }
    )),
    setRightPanelCollapsed: (collapsed) => set((state) => (
      state.rightPanelCollapsed === collapsed ? state : { rightPanelCollapsed: collapsed }
    )),
    setRightPanelWidth: (width) => {
      const clamped = Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, width))
      set({ rightPanelWidth: clamped })
    },
    setRightPanelActiveTab: (tab) => set((state) => (
      state.rightPanelActiveTab === tab ? state : { rightPanelActiveTab: tab }
    )),

    markUserSwitchedTab: () => set({ userSwitchedTab: true }),
    resetUserSwitchedTab: () => set({ userSwitchedTab: false }),

    toggleAllSidebars: () => {
      const { leftPanelCollapsed } = get()
      const newState = !leftPanelCollapsed
      set({
        leftPanelCollapsed: newState,
        rightPanelCollapsed: newState,
      })
    },
  }),
)

export { SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX, SIDEBAR_WIDTH_DEFAULT }
