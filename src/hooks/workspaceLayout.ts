export type WorkspaceLayoutMode = 'wide' | 'medium' | 'narrow'
export type PanelSide = 'left' | 'right'

export interface ResponsivePanelState {
  desktopLeftOpen: boolean
  desktopRightOpen: boolean
  mediumOpenSide: PanelSide | null
  drawerSide: PanelSide | null
}

export type ResponsivePanelEvent =
  | { type: 'open'; mode: WorkspaceLayoutMode; side: PanelSide }
  | { type: 'close'; mode: WorkspaceLayoutMode; side: PanelSide }
  | { type: 'toggle'; mode: WorkspaceLayoutMode; side: PanelSide }
  | { type: 'modeChanged'; mode: WorkspaceLayoutMode }

export const WIDE_WORKSPACE_MIN = 1100
export const MEDIUM_WORKSPACE_MIN = 820

export function getWorkspaceLayoutMode(width: number): WorkspaceLayoutMode {
  if (width >= WIDE_WORKSPACE_MIN) return 'wide'
  if (width >= MEDIUM_WORKSPACE_MIN) return 'medium'
  return 'narrow'
}

function updateWidePanel(
  state: ResponsivePanelState,
  side: PanelSide,
  open: boolean,
): ResponsivePanelState {
  return side === 'left'
    ? { ...state, desktopLeftOpen: open }
    : { ...state, desktopRightOpen: open }
}

function isSideOpen(
  state: ResponsivePanelState,
  mode: WorkspaceLayoutMode,
  side: PanelSide,
): boolean {
  if (mode === 'wide') {
    return side === 'left' ? state.desktopLeftOpen : state.desktopRightOpen
  }
  if (mode === 'medium') return state.mediumOpenSide === side
  return state.drawerSide === side
}

export function reduceResponsivePanels(
  state: ResponsivePanelState,
  event: ResponsivePanelEvent,
): ResponsivePanelState {
  if (event.type === 'modeChanged') {
    return event.mode === 'narrow' || state.drawerSide === null
      ? state
      : { ...state, drawerSide: null }
  }

  const open = event.type === 'open'
    || (event.type === 'toggle' && !isSideOpen(state, event.mode, event.side))

  if (event.mode === 'wide') return updateWidePanel(state, event.side, open)
  if (event.mode === 'medium') {
    return { ...state, mediumOpenSide: open ? event.side : null }
  }
  return { ...state, drawerSide: open ? event.side : null }
}
