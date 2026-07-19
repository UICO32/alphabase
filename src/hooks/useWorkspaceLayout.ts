import { useCallback, useEffect, useReducer, useRef, useSyncExternalStore } from 'react'
import { usePanelStore } from '../stores/panelStore'
import {
  getWorkspaceLayoutMode,
  reduceResponsivePanels,
  type PanelSide,
  type ResponsivePanelState,
  type WorkspaceLayoutMode,
} from './workspaceLayout'

export interface WorkspaceLayoutController {
  mode: WorkspaceLayoutMode
  leftOpen: boolean
  rightOpen: boolean
  drawerSide: PanelSide | null
  openPanel: (side: PanelSide) => void
  closePanel: (side: PanelSide) => void
  togglePanel: (side: PanelSide) => void
  toggleAllPanels: () => void
  closeDrawer: () => void
}

function subscribeToViewportWidth(onStoreChange: () => void) {
  window.addEventListener('resize', onStoreChange)
  return () => window.removeEventListener('resize', onStoreChange)
}

function getViewportWidth() {
  return window.innerWidth
}

function getServerViewportWidth() {
  return 1100
}

export function useWorkspaceLayout(): WorkspaceLayoutController {
  const viewportWidth = useSyncExternalStore(
    subscribeToViewportWidth,
    getViewportWidth,
    getServerViewportWidth,
  )
  const mode = getWorkspaceLayoutMode(viewportWidth)
  const leftPanelCollapsed = usePanelStore(s => s.leftPanelCollapsed)
  const rightPanelCollapsed = usePanelStore(s => s.rightPanelCollapsed)
  const rightPanelActiveTab = usePanelStore(s => s.rightPanelActiveTab)
  const setLeftPanelCollapsed = usePanelStore(s => s.setLeftPanelCollapsed)
  const setRightPanelCollapsed = usePanelStore(s => s.setRightPanelCollapsed)

  const [state, dispatch] = useReducer(
    reduceResponsivePanels,
    undefined,
    (): ResponsivePanelState => ({
      desktopLeftOpen: !leftPanelCollapsed,
      desktopRightOpen: !rightPanelCollapsed,
      mediumOpenSide: !leftPanelCollapsed ? 'left' : !rightPanelCollapsed ? 'right' : null,
      drawerSide: null,
    }),
  )
  const previousMode = useRef(mode)
  const previousRightTab = useRef(rightPanelActiveTab)

  useEffect(() => {
    if (previousMode.current === mode) return
    previousMode.current = mode
    dispatch({ type: 'modeChanged', mode })
  }, [mode])

  useEffect(() => {
    if (mode === 'wide' || previousRightTab.current === rightPanelActiveTab) return
    previousRightTab.current = rightPanelActiveTab
    dispatch({ type: 'open', mode, side: 'right' })
  }, [mode, rightPanelActiveTab])

  const apply = useCallback((type: 'open' | 'close' | 'toggle', side: PanelSide) => {
    if (mode === 'wide') {
      const currentlyOpen = side === 'left' ? !leftPanelCollapsed : !rightPanelCollapsed
      const nextOpen = type === 'open' || (type === 'toggle' && !currentlyOpen)
      if (side === 'left') setLeftPanelCollapsed(!nextOpen)
      else setRightPanelCollapsed(!nextOpen)
      return
    }
    dispatch({ type, mode, side })
  }, [leftPanelCollapsed, mode, rightPanelCollapsed, setLeftPanelCollapsed, setRightPanelCollapsed])

  const openPanel = useCallback((side: PanelSide) => apply('open', side), [apply])
  const closePanel = useCallback((side: PanelSide) => apply('close', side), [apply])
  const togglePanel = useCallback((side: PanelSide) => apply('toggle', side), [apply])
  const closeDrawer = useCallback(() => {
    if (state.drawerSide) dispatch({ type: 'close', mode: 'narrow', side: state.drawerSide })
  }, [state.drawerSide])
  const toggleAllPanels = useCallback(() => {
    if (mode === 'wide') {
      const nextCollapsed = !leftPanelCollapsed
      setLeftPanelCollapsed(nextCollapsed)
      setRightPanelCollapsed(nextCollapsed)
      return
    }
    if (mode === 'medium') {
      const side = state.mediumOpenSide ?? 'left'
      dispatch({ type: 'toggle', mode, side })
      return
    }
    if (state.drawerSide) closeDrawer()
    else dispatch({ type: 'open', mode, side: 'left' })
  }, [closeDrawer, leftPanelCollapsed, mode, setLeftPanelCollapsed, setRightPanelCollapsed, state.drawerSide, state.mediumOpenSide])

  return {
    mode,
    leftOpen: mode === 'wide' ? !leftPanelCollapsed : mode === 'medium' ? state.mediumOpenSide === 'left' : state.drawerSide === 'left',
    rightOpen: mode === 'wide' ? !rightPanelCollapsed : mode === 'medium' ? state.mediumOpenSide === 'right' : state.drawerSide === 'right',
    drawerSide: state.drawerSide,
    openPanel,
    closePanel,
    togglePanel,
    toggleAllPanels,
    closeDrawer,
  }
}
