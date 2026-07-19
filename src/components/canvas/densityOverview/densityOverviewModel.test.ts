import { describe, expect, it } from 'vitest'
import type { GlobalCard } from '../../../stores/cardStore'
import {
  buildDensityOverviewModel,
  calculateInformationDensity,
  getAdaptiveGridSpacing,
  getDensityOverviewProgress,
  hitTestDensityGroup,
  projectDensityCard,
  type DensitySourceCard,
} from './densityOverviewModel'

function card(id: string, overrides: Partial<GlobalCard> = {}): GlobalCard {
  return {
    id,
    content: 'short note',
    color: 'white',
    createdAt: 1,
    title: id,
    ...overrides,
  }
}

function source(id: string, x = 0, overrides: Partial<GlobalCard> = {}): DensitySourceCard {
  return { nodeId: `node-${id}`, cardId: id, x, y: 20, width: 280, height: 200, card: card(id, overrides) }
}

describe('density overview model', () => {
  it('starts the default transition below 25% zoom and completes at 20%', () => {
    expect(getDensityOverviewProgress(0.26)).toBe(0)
    expect(getDensityOverviewProgress(0.25)).toBe(0)
    expect(getDensityOverviewProgress(0.225)).toBeCloseTo(0.5, 5)
    expect(getDensityOverviewProgress(0.2)).toBe(1)
    expect(getDensityOverviewProgress(0.1)).toBe(1)
  })

  it('moves the same smooth transition with a custom entry threshold', () => {
    expect(getDensityOverviewProgress(0.5, 0.5)).toBe(0)
    expect(getDensityOverviewProgress(0.475, 0.5)).toBeCloseTo(0.5, 5)
    expect(getDensityOverviewProgress(0.45, 0.5)).toBe(1)
  })

  it('increases density with content richness and graph centrality while staying capped', () => {
    const sparse = calculateInformationDensity({ textChars: 20, blockCount: 1, mediaCount: 0, tagCount: 0 }, 0)
    const rich = calculateInformationDensity({ textChars: 5000, blockCount: 60, mediaCount: 8, tagCount: 6 }, 0)
    const connected = calculateInformationDensity({ textChars: 5000, blockCount: 60, mediaCount: 8, tagCount: 6 }, 12)
    const enormous = calculateInformationDensity({ textChars: 1_000_000, blockCount: 10_000, mediaCount: 1000, tagCount: 1000 }, 1000)
    expect(rich).toBeGreaterThan(sparse)
    expect(connected).toBeGreaterThan(rich)
    expect(enormous).toBe(1)
  })

  it('keeps embedding groups board-local and leaves embedding orphans ungrouped', () => {
    const model = buildDensityOverviewModel(
      [source('a'), source('b'), source('orphan')],
      [],
      {
        clusters: [{
          id: 'cluster-1', label: 'Topic', centroid: [], cardIds: ['a', 'b', 'outside'], cohesion: 0.9,
          cardSimilarities: { a: 0.9, b: 0.8, outside: 0.7 },
        }],
        orphanCards: ['orphan'],
        computedAt: 1,
      },
    )
    expect(model.groups[0].cardIds).toEqual(['a', 'b'])
    expect(model.cards.find(item => item.cardId === 'orphan')?.groupId).toBeNull()
  })

  it('falls back to explicit edges and shared tags when embeddings are unavailable', () => {
    const model = buildDensityOverviewModel(
      [source('a', 0, { tags: ['design'] }), source('b', 300, { tags: ['design'] }), source('c', 600), source('d', 900)],
      [{ source: 'node-c', target: 'node-d' }],
      null,
    )
    expect(model.groups).toHaveLength(2)
    expect(model.groups.every(group => group.source === 'fallback')).toBe(true)
    expect(model.groups.map(group => [...group.cardIds].sort())).toEqual(expect.arrayContaining([['a', 'b'], ['c', 'd']]))
  })

  it('ignores null and malformed persisted tags in fallback grouping', () => {
    const malformedTags = ['design', null, 42, ''] as unknown as string[]
    const model = buildDensityOverviewModel(
      [source('a', 0, { tags: malformedTags }), source('b', 300, { tags: ['design'] })],
      [],
      null,
    )

    expect(model.groups).toHaveLength(1)
    expect(model.groups[0]).toMatchObject({ label: 'design', cardIds: ['a', 'b'] })
  })

  it('does not replace a usable embedding result with fallback groups', () => {
    const model = buildDensityOverviewModel(
      [source('a', 0, { tags: ['same'] }), source('b', 300, { tags: ['same'] }), source('c', 600)],
      [],
      {
        clusters: [{ id: 'semantic', label: 'Semantic', centroid: [], cardIds: ['a', 'c'], cohesion: 0.8, cardSimilarities: { a: 0.9, c: 0.9 } }],
        orphanCards: ['b'], computedAt: 1,
      },
    )
    expect(model.groups).toHaveLength(1)
    expect(model.groups[0].id).toBe('semantic')
    expect(model.cards.find(item => item.cardId === 'b')?.groupId).toBeNull()
  })

  it('keeps embedding orphans gray instead of regrouping them by fallback tags', () => {
    const model = buildDensityOverviewModel(
      [source('a', 0, { tags: ['same'] }), source('b', 300, { tags: ['same'] })],
      [],
      { clusters: [], orphanCards: ['a', 'b'], computedAt: 1 },
    )
    expect(model.groups).toEqual([])
    expect(model.cards.every(item => item.groupId === null)).toBe(true)
  })

  it('projects card centers and hit-tests the strongest grouped field', () => {
    const model = buildDensityOverviewModel(
      [source('a')],
      [],
      { clusters: [], orphanCards: [], computedAt: 1 },
    )
    const overviewCard = { ...model.cards[0], groupId: 'group' }
    const projected = projectDensityCard(overviewCard, { x: 10, y: 30, zoom: 0.5 })
    expect(projected.screenX).toBe((140 * 0.5) + 10)
    expect(projected.screenY).toBe((120 * 0.5) + 30)
    expect(hitTestDensityGroup([projected], { x: projected.screenX, y: projected.screenY })).toBe('group')
    expect(hitTestDensityGroup([projected], { x: projected.screenX + projected.radius * 2, y: projected.screenY })).toBeNull()
  })

  it('adapts grid spacing only beyond the 1000-card target', () => {
    expect(getAdaptiveGridSpacing(1000)).toBe(18)
    expect(getAdaptiveGridSpacing(5000)).toBeGreaterThan(18)
    expect(getAdaptiveGridSpacing(1_000_000)).toBe(32)
  })
})
