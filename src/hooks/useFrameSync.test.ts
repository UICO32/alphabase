// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { describe, expect, it, vi } from 'vitest'
import { useFrameSync } from './useFrameSync'

function frame(id: string, x = 0, y = 0): Node {
  return { id, type: 'frame', position: { x, y }, data: {} }
}

function child(frameId: string): Node {
  return {
    id: 'child',
    type: 'card',
    position: { x: 20, y: 30 },
    data: { frameId, frameLayout: 'free', localX: 20, localY: 30 },
  }
}

describe('useFrameSync', () => {
  it('does not schedule a node update when frame positions are unchanged', () => {
    const setNodes = vi.fn()
    const nodes = [frame('frame'), child('frame')]

    renderHook(() => useFrameSync({ nodes, setNodes }))

    expect(setNodes).not.toHaveBeenCalled()
  })

  it('moves frame children by the frame position delta', () => {
    const setNodes = vi.fn()
    const initialNodes = [frame('frame'), child('frame')]
    const { rerender } = renderHook(
      ({ nodes }) => useFrameSync({ nodes, setNodes }),
      { initialProps: { nodes: initialNodes } },
    )

    act(() => rerender({ nodes: [frame('frame', 12, -8), initialNodes[1]] }))

    expect(setNodes).toHaveBeenCalledOnce()
    const updatedNodes = setNodes.mock.calls[0][0] as Node[]
    expect(updatedNodes.find(node => node.id === 'child')?.position).toEqual({ x: 32, y: 22 })
  })

  it('clears frame metadata when the referenced frame disappears', () => {
    const setNodes = vi.fn()
    const initialNodes = [frame('frame'), child('frame')]
    const { rerender } = renderHook(
      ({ nodes }) => useFrameSync({ nodes, setNodes }),
      { initialProps: { nodes: initialNodes } },
    )

    act(() => rerender({ nodes: [initialNodes[1]] }))

    expect(setNodes).toHaveBeenCalledOnce()
    const updatedNodes = setNodes.mock.calls[0][0] as Node[]
    expect(updatedNodes[0].data).toMatchObject({
      frameId: undefined,
      frameLayout: undefined,
      localX: undefined,
      localY: undefined,
    })
  })
})
