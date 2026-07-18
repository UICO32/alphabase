import { describe, expect, it } from 'vitest'
import {
  getWorkspaceLayoutMode,
  reduceResponsivePanels,
  type ResponsivePanelState,
} from './workspaceLayout'

const initial: ResponsivePanelState = {
  desktopLeftOpen: true,
  desktopRightOpen: true,
  mediumOpenSide: 'left',
  drawerSide: null,
}

describe('getWorkspaceLayoutMode', () => {
  it.each([
    [1099, 'medium'],
    [1100, 'wide'],
    [819, 'narrow'],
    [820, 'medium'],
  ] as const)('maps %dpx to %s', (width, expected) => {
    expect(getWorkspaceLayoutMode(width)).toBe(expected)
  })
})

describe('reduceResponsivePanels', () => {
  it('opens only one medium panel', () => {
    const next = reduceResponsivePanels(initial, { type: 'open', mode: 'medium', side: 'right' })

    expect(next.mediumOpenSide).toBe('right')
  })

  it('opens only one transient narrow drawer', () => {
    const opened = reduceResponsivePanels(initial, { type: 'open', mode: 'narrow', side: 'left' })
    const switched = reduceResponsivePanels(opened, { type: 'open', mode: 'narrow', side: 'right' })

    expect(switched.drawerSide).toBe('right')
  })

  it('toggles the active narrow drawer closed', () => {
    const opened = reduceResponsivePanels(initial, { type: 'open', mode: 'narrow', side: 'left' })

    expect(reduceResponsivePanels(opened, { type: 'toggle', mode: 'narrow', side: 'left' }).drawerSide).toBeNull()
  })

  it('does not overwrite wide preferences while using a drawer', () => {
    const opened = reduceResponsivePanels(initial, { type: 'open', mode: 'narrow', side: 'right' })
    const closed = reduceResponsivePanels(opened, { type: 'close', mode: 'narrow', side: 'right' })

    expect(closed.desktopLeftOpen).toBe(true)
    expect(closed.desktopRightOpen).toBe(true)
  })

  it('updates only the requested wide preference', () => {
    const next = reduceResponsivePanels(initial, { type: 'close', mode: 'wide', side: 'left' })

    expect(next.desktopLeftOpen).toBe(false)
    expect(next.desktopRightOpen).toBe(true)
  })

  it('closes the transient drawer when leaving narrow mode', () => {
    const opened = { ...initial, drawerSide: 'left' as const }

    expect(reduceResponsivePanels(opened, { type: 'modeChanged', mode: 'medium' }).drawerSide).toBeNull()
  })
})
