import { describe, expect, it } from 'vitest'
import { serializeBoardData } from './boardSnapshot'

describe('serializeBoardData', () => {
  it('preserves node position, data, dimensions, and connection handles', () => {
    const result = serializeBoardData(
      [{
        id: 'card-1',
        type: 'card',
        position: { x: 10, y: 20 },
        data: { cardId: 'card-1', color: 'blue' },
        width: 280,
        height: 200,
      } as any],
      [{
        id: 'edge-1',
        source: 'card-1',
        target: 'card-2',
        type: 'connection',
        sourceHandle: 'right',
        targetHandle: 'left',
      } as any],
    )

    expect(result.nodes[0]).toMatchObject({
      id: 'card-1',
      type: 'card',
      position: { x: 10, y: 20 },
      data: { cardId: 'card-1', color: 'blue' },
      width: 280,
      height: 200,
    })
    expect(result.edges[0]).toMatchObject({
      id: 'edge-1',
      source: 'card-1',
      target: 'card-2',
      type: 'connection',
      sourceHandle: 'right',
      targetHandle: 'left',
    })
  })
})
