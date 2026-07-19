// @vitest-environment jsdom

import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DensityOverviewDrawer } from './DensityOverviewDrawer'
import type { DensityOverviewGroup, ProjectedDensityCard } from './densityOverviewModel'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const group: DensityOverviewGroup = {
  id: 'cluster-a',
  label: 'Design systems',
  cardIds: ['a', 'b'],
  cohesion: 0.88,
  source: 'embedding',
}

function projected(cardId: string, x: number, y: number): ProjectedDensityCard {
  return {
    nodeId: `node-${cardId}`,
    cardId,
    x,
    y,
    width: 280,
    height: 200,
    card: {
      id: cardId,
      title: `Card ${cardId.toUpperCase()}`,
      content: `<p>Preview ${cardId}</p>`,
      color: 'white',
      createdAt: 1,
      tags: ['design'],
    },
    center: { x: x + 140, y: y + 100 },
    density: 0.7,
    textChars: 100,
    blockCount: 3,
    mediaCount: 0,
    tagCount: 1,
    edgeDegree: 2,
    groupId: group.id,
    similarity: 0.85,
    screenX: x,
    screenY: y,
    radius: 90,
  }
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('DensityOverviewDrawer', () => {
  it('renders current-cluster cards in canvas reading order', () => {
    render(createElement(DensityOverviewDrawer, {
      group,
      cards: [projected('b', 500, 400), projected('a', 100, 100)],
      pinned: true,
      activeCardId: null,
      onActiveCardChange: vi.fn(),
      onFocusCard: vi.fn(),
    }))

    const buttons = screen.getAllByRole('button')
    expect(buttons.map(button => button.textContent)).toEqual([
      expect.stringContaining('Card A'),
      expect.stringContaining('Card B'),
    ])
    expect(screen.getByRole('complementary', { name: 'Design systems semantic cluster' }).className).toContain('is-pinned')
  })

  it('focuses the source node from a preview card', () => {
    const onFocusCard = vi.fn()
    render(createElement(DensityOverviewDrawer, {
      group,
      cards: [projected('a', 100, 100)],
      pinned: true,
      activeCardId: null,
      onActiveCardChange: vi.fn(),
      onFocusCard,
    }))

    fireEvent.click(screen.getByRole('button', { name: /Card A/ }))
    expect(onFocusCard).toHaveBeenCalledWith('node-a')
  })

  it('keeps hover previews non-interactive until pinned', () => {
    const { rerender } = render(createElement(DensityOverviewDrawer, {
      group,
      cards: [projected('a', 100, 100)],
      pinned: false,
      activeCardId: null,
      onActiveCardChange: vi.fn(),
      onFocusCard: vi.fn(),
    }))
    expect(screen.getByRole('complementary').className).toContain('is-preview')

    rerender(createElement(DensityOverviewDrawer, {
      group,
      cards: [projected('a', 100, 100)],
      pinned: true,
      activeCardId: null,
      onActiveCardChange: vi.fn(),
      onFocusCard: vi.fn(),
    }))
    expect(screen.getByRole('complementary').className).toContain('is-pinned')
  })
})
