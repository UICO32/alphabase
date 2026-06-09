import { describe, it, expect } from 'vitest'
import { buildMountains } from '../../src/components/topography/types'

interface TerrainCluster {
  id: string
  label: string
  centroid: number[]
  cardIds: string[]
  cohesion: number
  cardSimilarities: Record<string, number>
}

function makeCluster(
  id: string,
  label: string,
  cardIds: string[],
  cohesion: number,
  similarities: Record<string, number>,
): TerrainCluster {
  const dim = 4
  const centroid = new Array(dim).fill(0.1)
  return { id, label, centroid, cardIds, cohesion, cardSimilarities: similarities }
}

describe('buildMountains', () => {
  it('maps clusters to mountains with correct positions', () => {
    const clusters = [
      makeCluster('c1', 'AI', ['card1', 'card2', 'card3'], 0.8, {
        card1: 0.9, card2: 0.7, card3: 0.6,
      }),
    ]
    const positions = {
      card1: { x: 100, y: 200 },
      card2: { x: 300, y: 400 },
      card3: { x: 500, y: 600 },
    }
    const labels = { card1: 'Neural Nets', card2: 'LLMs', card3: 'Vision' }

    const result = buildMountains(clusters, [], positions, labels)

    expect(result.mountains).toHaveLength(1)
    expect(result.mountains[0].label).toBe('AI')
    expect(result.mountains[0].cardCount).toBe(3)
    expect(result.mountains[0].cards).toHaveLength(3)
    expect(result.orphans).toHaveLength(0)
  })

  it('sorts sub-anchors by altitude (highest first)', () => {
    const clusters = [
      makeCluster('c1', 'Topic', ['a', 'b', 'c'], 0.7, {
        a: 0.5, b: 0.9, c: 0.3,
      }),
    ]
    const positions = { a: { x: 0, y: 0 }, b: { x: 0, y: 0 }, c: { x: 0, y: 0 } }
    const labels = { a: 'Low', b: 'High', c: 'Lowest' }

    const result = buildMountains(clusters, [], positions, labels)

    expect(result.mountains[0].cards[0].id).toBe('b')
    expect(result.mountains[0].cards[0].altitude).toBe(0.9)
    expect(result.mountains[0].cards[2].id).toBe('c')
    expect(result.mountains[0].cards[2].altitude).toBe(0.3)
  })

  it('maps orphan cards to OrphanPeak', () => {
    const clusters: TerrainCluster[] = []
    const orphanIds = ['card1', 'card2']
    const positions = {
      card1: { x: 100, y: 200 },
      card2: { x: 300, y: 400 },
    }
    const labels = { card1: 'Solo1', card2: 'Solo2' }

    const result = buildMountains(clusters, orphanIds, positions, labels)

    expect(result.mountains).toHaveLength(0)
    expect(result.orphans).toHaveLength(2)
    expect(result.orphans[0].label).toBe('Solo1')
    expect(result.orphans[1].label).toBe('Solo2')
  })

  it('skips orphan cards without positions', () => {
    const orphanIds = ['missing']
    const positions: Record<string, { x: number; y: number }> = {}
    const labels: Record<string, string> = {}

    const result = buildMountains([], orphanIds, positions, labels)

    expect(result.orphans).toHaveLength(0)
  })

  it('assigns colors from palette', () => {
    const clusters = [
      makeCluster('c1', 'A', ['a'], 0.5, { a: 0.5 }),
      makeCluster('c2', 'B', ['b'], 0.5, { b: 0.5 }),
      makeCluster('c3', 'C', ['c'], 0.5, { c: 0.5 }),
    ]
    const positions = { a: { x: 0, y: 0 }, b: { x: 0, y: 0 }, c: { x: 0, y: 0 } }
    const labels = { a: 'A', b: 'B', c: 'C' }

    const result = buildMountains(clusters, [], positions, labels)

    expect(result.mountains[0].color).not.toBe(result.mountains[1].color)
    expect(result.mountains[1].color).not.toBe(result.mountains[2].color)
  })
})