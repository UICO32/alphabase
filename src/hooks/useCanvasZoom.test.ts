// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react'
import { createElement, useRef } from 'react'
import type { WheelEvent as ReactWheelEvent } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactFlowInstance } from '@xyflow/react'
import { useCanvasZoom } from './useCanvasZoom'

afterEach(cleanup)

function CanvasZoomHarness({ onWheel }: { onWheel: (event: WheelEvent) => void }) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null)
  useCanvasZoom({ canvasRef, reactFlowInstance })

  return createElement(
    'div',
    { ref: canvasRef },
    createElement(
      'div',
      {
        'data-testid': 'd3-zoom',
        onWheel: (event: ReactWheelEvent) => onWheel(event.nativeEvent),
      },
      createElement('div', { className: 'react-flow__pane' }),
    ),
  )
}

describe('useCanvasZoom wheel smoothing', () => {
  it('softens a wheel delta before React Flow receives the event', () => {
    const onWheel = vi.fn()
    const { getByTestId } = render(createElement(CanvasZoomHarness, { onWheel }))

    fireEvent.wheel(getByTestId('d3-zoom'), { deltaY: 100 })

    expect(onWheel).toHaveBeenCalledOnce()
    expect(onWheel.mock.calls[0][0].deltaY).toBe(40)
  })

  it('preserves ctrl-wheel deltas used for pinch zoom', () => {
    const onWheel = vi.fn()
    const { getByTestId } = render(createElement(CanvasZoomHarness, { onWheel }))

    fireEvent.wheel(getByTestId('d3-zoom'), { ctrlKey: true, deltaY: 100 })

    expect(onWheel).toHaveBeenCalledOnce()
    expect(onWheel.mock.calls[0][0].deltaY).toBe(100)
  })
})
