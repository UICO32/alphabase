import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Edge, Node, ReactFlowInstance } from '@xyflow/react'
import { AlignmentToolbar } from '../../src/components/canvas/AlignmentToolbar'

const reactFlowInstance = {
  current: {
    flowToScreenPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
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

function renderToolbar(selectedNodes: Node[], selectedEdges: Edge[] = []) {
  const onApplyAlignment = vi.fn()
  render(React.createElement(AlignmentToolbar, {
    selectedNodes,
    selectedEdges,
    reactFlowInstance,
    onApplyAlignment,
  }))
  return onApplyAlignment
}

afterEach(() => {
  cleanup()
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
    const onApplyAlignment = renderToolbar([node('a', 20, 0), node('b', 200, 100, 'media')])

    expect(screen.getByTestId('alignment-toolbar')).not.toBeNull()

    fireEvent.click(screen.getAllByRole('button')[0])

    expect(onApplyAlignment).toHaveBeenCalledTimes(1)
    expect(onApplyAlignment.mock.calls[0][0]).toEqual(new Map([
      ['a', { x: 20, y: 0 }],
      ['b', { x: 20, y: 100 }],
    ]))
  })
})
