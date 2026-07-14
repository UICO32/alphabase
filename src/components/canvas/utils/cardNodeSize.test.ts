import { describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'
import { COLLAPSED_CARD_HEIGHT, DEFAULT_CARD_HEIGHT, DEFAULT_CARD_WIDTH } from '../../../types/card'
import { getCardNodeSize } from './cardNodeSize'

function cardNode(data: Record<string, unknown>): Node {
  return {
    id: 'card-1',
    type: 'card',
    position: { x: 0, y: 0 },
    data,
  }
}

describe('getCardNodeSize', () => {
  it('uses default card dimensions when size data is absent', () => {
    expect(getCardNodeSize(cardNode({ cardId: 'card-1' }))).toEqual({
      w: DEFAULT_CARD_WIDTH,
      h: DEFAULT_CARD_HEIGHT,
    })
  })

  it('uses explicit width and height for expanded cards', () => {
    expect(getCardNodeSize(cardNode({ cardId: 'card-1', width: 320, height: 240 }))).toEqual({
      w: 320,
      h: 240,
    })
  })

  it('uses collapsed height while preserving explicit width', () => {
    expect(getCardNodeSize(cardNode({
      cardId: 'card-1',
      width: 360,
      height: 240,
      collapsed: true,
    }))).toEqual({
      w: 360,
      h: COLLAPSED_CARD_HEIGHT,
    })
  })
})
