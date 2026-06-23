import { describe, it, expect } from 'vitest'
import { buildTopicPeaks, type TopicPeak } from '../../src/components/topography/types'

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

describe('buildTopicPeaks', () => {
  it('maps clusters to TopicPeaks', () => {
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

    const peaks = buildTopicPeaks(clusters, [], positions, labels)

    expect(peaks).toHaveLength(1)
    expect(peaks[0].label).toBe('AI')
    expect(peaks[0].notes).toBe(3)
    expect(peaks[0].cardIds).toHaveLength(3)
  })

  it('uses best card label as fallback when cluster label is a UUID', () => {
    const clusters = [
      makeCluster('c1', '550e8400-e29b-41d4-a716-446655440000', ['a', 'b'], 0.7, {
        a: 0.9, b: 0.5,
      }),
    ]
    const positions = { a: { x: 0, y: 0 }, b: { x: 10, y: 10 } }
    const labels = { a: 'Best Card', b: 'Other' }

    const peaks = buildTopicPeaks(clusters, [], positions, labels)

    expect(peaks).toHaveLength(1)
    // 'a' has highest similarity (0.9) → its label wins
    expect(peaks[0].label).toBe('Best Card')
  })

  it('uses "未命名" when no meaningful label is found', () => {
    const clusters = [
      makeCluster('c1', '550e8400-e29b-41d4-a716-446655440000', ['a'], 0.5, { a: 0.5 }),
    ]
    const positions = { a: { x: 0, y: 0 } }
    const labels = { a: '550e8400-e29b-41d4-a716-446655440000' }

    const peaks = buildTopicPeaks(clusters, [], positions, labels)

    expect(peaks[0].label).toBe('未命名')
  })

  it('returns empty array for empty clusters', () => {
    const peaks = buildTopicPeaks([], [], {}, {})
    expect(peaks).toEqual([])
  })
})