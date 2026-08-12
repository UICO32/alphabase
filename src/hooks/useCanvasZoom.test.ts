// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { act, createElement, useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactFlowInstance, Viewport } from '@xyflow/react'
import { useCanvasZoom } from './useCanvasZoom'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function createViewportInstance(initial: Viewport = { x: 0, y: 0, zoom: 1 }) {
  let viewport = initial
  const instance = {
    getViewport: vi.fn(() => viewport),
    setViewport: vi.fn((next: Viewport) => {
      viewport = next
      return Promise.resolve(true)
    }),
  } as unknown as ReactFlowInstance
  return { instance, getViewport: () => viewport }
}

function CanvasZoomHarness({ instance }: { instance: ReactFlowInstance }) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const reactFlowInstance = useRef<ReactFlowInstance | null>(instance)
  useCanvasZoom({ canvasRef, reactFlowInstance })

  return createElement(
    'div',
    { ref: canvasRef },
    createElement(
      'div',
      { 'data-testid': 'd3-zoom' },
      createElement(
        'div',
        { className: 'react-flow__pane' },
        createElement('div', { className: 'react-flow__viewport', 'data-testid': 'viewport' }),
      ),
    ),
  )
}

function installAnimationFrameQueue() {
  const callbacks: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callbacks.push(callback)
    return callbacks.length
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  return callbacks
}

describe('useCanvasZoom wheel smoothing', () => {
  it('interpolates wheel zoom around the pointer and coalesces events', () => {
    const callbacks = installAnimationFrameQueue()
    const { instance, getViewport } = createViewportInstance()
    const { getByTestId } = render(createElement(CanvasZoomHarness, { instance }))
    const target = getByTestId('d3-zoom')

    const firstEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 40,
      clientY: 20,
      deltaY: -100,
    })
    const secondEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 40,
      clientY: 20,
      deltaY: -100,
    })

    expect(target.dispatchEvent(firstEvent)).toBe(false)
    expect(target.dispatchEvent(secondEvent)).toBe(false)
    expect(firstEvent.defaultPrevented).toBe(true)
    expect(secondEvent.defaultPrevented).toBe(true)
    expect(instance.setViewport).not.toHaveBeenCalled()
    expect(callbacks).toHaveLength(1)

    act(() => callbacks.shift()?.(16))

    expect(instance.setViewport).not.toHaveBeenCalled()
    const visualScale = Number(/scale\(([^)]+)/.exec(getByTestId('viewport').getAttribute('style') || '')?.[1])
    expect(visualScale).toBeGreaterThan(1)
    expect(callbacks).toHaveLength(1)

    let renderedFrames = 1
    for (let frame = 0; frame < 16 && callbacks.length > 0; frame += 1) {
      act(() => callbacks.shift()?.(16 + frame))
      renderedFrames += 1
    }
    expect(renderedFrames).toBeLessThanOrEqual(12)
    expect(instance.setViewport).toHaveBeenCalledOnce()
    expect(getViewport().zoom).toBeGreaterThan(1)
    expect(getViewport().zoom).toBeLessThan(1.2)
  })

  it('leaves ctrl-wheel available for React Flow pinch zoom', () => {
    const callbacks = installAnimationFrameQueue()
    const { instance } = createViewportInstance()
    const { getByTestId } = render(createElement(CanvasZoomHarness, { instance }))
    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY: 100,
    })

    expect(getByTestId('d3-zoom').dispatchEvent(event)).toBe(true)
    expect(event.defaultPrevented).toBe(false)
    expect(instance.setViewport).not.toHaveBeenCalled()
    expect(callbacks).toHaveLength(0)
  })
})
