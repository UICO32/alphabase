import { create } from 'zustand'
export type ViewMode = 'board' | 'cards' | 'boardLibrary'

interface LibraryStore {
  // 视图模式
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void

  // 卡片编辑
  editingCardId: string | null
  setEditingCardId: (cardId: string | null) => void
  openCardEditor: (cardId: string) => void
  closeCardEditor: () => void

  // 暗色模式
  isDarkMode: boolean
  setDarkMode: (dark: boolean) => void
  syncDarkMode: (v: boolean) => void

  // 左侧面板
  leftPanelCollapsed: boolean
  setLeftPanelCollapsed: (collapsed: boolean) => void

  // 右侧面板
  rightPanelCollapsed: boolean
  setRightPanelCollapsed: (collapsed: boolean) => void
  rightPanelWidth: number
  setRightPanelWidth: (width: number) => void
  rightPanelActiveTab: 'library' | 'editor'
  setRightPanelActiveTab: (tab: 'library' | 'editor') => void

  // 用户是否手动切换过标签
  userSwitchedTab: boolean
  markUserSwitchedTab: () => void
  resetUserSwitchedTab: () => void

  // 同时折叠/展开两侧面板
  toggleAllSidebars: () => void

  // 画布缩放
  zoom: number
  setZoom: (zoom: number) => void
}

const SIDEBAR_WIDTH_MIN = 260
const SIDEBAR_WIDTH_MAX = 600
const SIDEBAR_WIDTH_DEFAULT = 360

export const useLibraryStore = create<LibraryStore>()(
  (set, get) => ({
      // 初始状态
      viewMode: 'board',
      editingCardId: null,
      isDarkMode: false,
      leftPanelCollapsed: false,
      rightPanelCollapsed: false,
      rightPanelWidth: SIDEBAR_WIDTH_DEFAULT,
      rightPanelActiveTab: 'library',
      userSwitchedTab: false,
      zoom: 1,

      // 视图模式
      setViewMode: (mode) => set({ viewMode: mode }),
      setZoom: (zoom) => set({ zoom }),

      // 卡片编辑
      openCardEditor: (cardId) => set({ editingCardId: cardId }),
      closeCardEditor: () => set({ editingCardId: null }),
      setEditingCardId: (cardId) => set({ editingCardId: cardId }),

      // 暗色模式
      setDarkMode: (dark) => set({ isDarkMode: dark }),
      syncDarkMode: (v) => set({ isDarkMode: v }),

      // 左侧面板
      setLeftPanelCollapsed: (collapsed) => set({ leftPanelCollapsed: collapsed }),

      // 右侧面板
      setRightPanelCollapsed: (collapsed) => set({ rightPanelCollapsed: collapsed }),
      setRightPanelWidth: (width) => {
        const clamped = Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, width))
        set({ rightPanelWidth: clamped })
      },
      setRightPanelActiveTab: (tab) => set({ rightPanelActiveTab: tab }),

      // 用户切换标记
      markUserSwitchedTab: () => set({ userSwitchedTab: true }),
      resetUserSwitchedTab: () => set({ userSwitchedTab: false }),

      // 同时折叠/展开两侧面板
      toggleAllSidebars: () => {
        const { leftPanelCollapsed } = get()
        // 如果两侧状态相同，则同时切换
        // 如果不同，则以左侧面板为准，让右侧面板跟随
        const newState = !leftPanelCollapsed
        set({
          leftPanelCollapsed: newState,
          rightPanelCollapsed: newState,
        })
      },
  }),
)

// 导出常量供其他组件使用
export { SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX, SIDEBAR_WIDTH_DEFAULT }
