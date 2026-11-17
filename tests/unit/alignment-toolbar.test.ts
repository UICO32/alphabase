import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Edge, Node, ReactFlowInstance } from '@xyflow/react'
import { AlignmentToolbar } from '../../src/components/canvas/AlignmentToolbar'

// 画布实例的坐标换算依赖当前 transform：这里用一个可变的 mock 视口模拟平移/缩放。
let mockViewport = { x: 0, y: 0, zoom: 1 }

const reactFlowInstance = {
  current: {
    flowToScreenPosition: ({ x, y }: { x: number; y: number }) => ({
      x: x * mockViewport.zoom + mockViewport.x,
      y: y * mockViewport.zoom + mockViewport.y,
    }),
  } as ReactFlowInstance,
}

function node(id: string, x: number, y: number, type = 'card'): Node {
  return {
    id,
    type,
    position: { x, y },
    data: { width: 100, height: 80 },
    selected: true,
  } as Node
}

function renderToolbar(
  selectedNodes: Node[],
  selectedEdges: Edge[] = [],
  viewport: { x: number; y: number; zoom: number } | null = null,
) {
  const onApplyAlignment = vi.fn()
  const renderToolbarWith = (nextViewport: { x: number; y: number; zoom: number } | null) => (
    React.createElement(AlignmentToolbar, {
      selectedNodes,
      selectedEdges,
      reactFlowInstance,
      viewport: nextViewport,
      onApplyAlignment,
    })
  )
  const view = render(renderToolbarWith(viewport))
  return { onApplyAlignment, view, renderToolbarWith }
}

afterEach(() => {
  cleanup()
  mockViewport = { x: 0, y: 0, zoom: 1 }
})

describe('AlignmentToolbar', () => {
  it('does not show for a single selected card', () => {
    renderToolbar([node('a', 0, 0)])

    expect(screen.queryByTestId('alignment-toolbar')).toBeNull()
  })

  it('does not show when an edge is selected with cards', () => {
    renderToolbar(
      [node('a', 0, 0), node('b', 200, 100)],
      [{ id: 'edge-a-b', source: 'a', target: 'b', selected: true } as Edge],
    )

    expect(screen.queryByTestId('alignment-toolbar')).toBeNull()
  })

  it('shows for multiple alignable nodes and applies alignment to them', () => {
    const { onApplyAlignment } = renderToolbar([node('a', 20, 0), node('b', 200, 100, 'media')])

    expect(screen.getByTestId('alignment-toolbar')).not.toBeNull()

    fireEvent.click(screen.getAllByRole('button')[0])

    expect(onApplyAlignment).toHaveBeenCalledTimes(1)
    expect(onApplyAlignment.mock.calls[0][0]).toEqual(new Map([
      ['a', { x: 20, y: 0 }],
      ['b', { x: 20, y: 100 }],
    ]))
  })

  it('repositions after pan and zoom settle', () => {
    const { view, renderToolbarWith } = renderToolbar(
      [node('a', 20, 0), node('b', 200, 100)],
      [],
      { x: 0, y: 0, zoom: 1 },
    )

    const before = (screen.getByTestId('alignment-toolbar') as HTMLElement).style.left
    expect(before).toBe('160px')

    // 平移 + 放大后，画布实例的换算结果变化；视口快照变化应触发工具栏重算。
    mockViewport = { x: 100, y: 40, zoom: 2 }
    view.rerender(renderToolbarWith({ x: 100, y: 40, zoom: 2 }))

    const after = (screen.getByTestId('alignment-toolbar') as HTMLElement).style.left
    expect(after).toBe('420px')
  })
})
