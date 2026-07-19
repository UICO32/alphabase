// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { beginRightPanelResize } from './RightPanel'

afterEach(() => {
  document.body.innerHTML = ''
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  delete document.documentElement.dataset.rightPanelResizing
  vi.unstubAllGlobals()
})

describe('beginRightPanelResize', () => {
  it('previews a clamped width without committing store state during pointer moves', () => {
    const panel = document.createElement('div')
    panel.style.transition = 'transform 200ms ease'
    const aperture = document.createElement('div')
    aperture.className = 'workspace-canvas-aperture'
    aperture.style.transition = 'right 160ms ease'
    document.body.append(panel, aperture)

    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const onWidthChange = vi.fn()

    beginRightPanelResize({ startX: 500, startWidth: 300, panel, onWidthChange })
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 480 }))
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: -1000 }))

    expect(frames).toHaveLength(1)
    expect(onWidthChange).not.toHaveBeenCalled()
    expect(panel.style.transition).toBe('none')
    expect(aperture.style.transition).toBe('none')
    expect(document.body.style.cursor).toBe('col-resize')
    expect(document.body.style.userSelect).toBe('none')
    expect(document.documentElement.dataset.rightPanelResizing).toBe('true')

    frames[0](0)
    expect(panel.style.width).toBe('600px')
    expect(onWidthChange).not.toHaveBeenCalled()
  })

  it.each(['pointerup', 'pointercancel'])('commits and restores state on %s', (eventName) => {
    const panel = document.createElement('div')
    panel.style.transition = 'transform 200ms ease'
    const strip = document.createElement('div')
    strip.className = 'workspace-chrome-strip'
    strip.style.transition = 'width 160ms ease'
    document.body.append(panel, strip)

    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 42))
    const cancelAnimationFrame = vi.fn()
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame)
    const onWidthChange = vi.fn()

    beginRightPanelResize({ startX: 500, startWidth: 300, panel, onWidthChange })
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 650 }))
    document.dispatchEvent(new PointerEvent(eventName))

    expect(cancelAnimationFrame).toHaveBeenCalledWith(42)
    expect(onWidthChange).toHaveBeenCalledTimes(1)
    expect(onWidthChange).toHaveBeenLastCalledWith(260)
    expect(panel.style.transition).toBe('transform 200ms ease')
    expect(strip.style.transition).toBe('width 160ms ease')
    expect(document.body.style.cursor).toBe('')
    expect(document.body.style.userSelect).toBe('')
    expect(document.documentElement.dataset.rightPanelResizing).toBeUndefined()

    onWidthChange.mockClear()
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 0 }))
    expect(onWidthChange).not.toHaveBeenCalled()
  })
})
