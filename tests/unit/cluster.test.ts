import { describe, it, expect } from 'vitest'

// Re-implement the core clustering logic as a pure function for testing
// (EmbeddingService.cluster() requires ONNX runtime, so we test the algorithm directly)

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  if (denom === 0) return 0
  return dot / denom
}

interface Doc { id: string; vector: number[]; title: string }

interface ClusterResult {
  clusters: Array<{
    id: string
    label: string
    cardIds: string[]
    cohesion: number
    cardSimilarities: Record<string, number>
  }>
  orphanCards: string[]
}

function cluster(docs: Doc[], threshold: number, minClusterSize: number): ClusterResult {
  if (docs.length === 0) return { clusters: [], orphanCards: [] }

  const n = docs.length
  const adj: number[][] = Array.from({ length: n }, () => [])
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (cosineSimilarity(docs[i].vector, docs[j].vector) >= threshold) {
        adj[i].push(j)
        adj[j].push(i)
      }
    }
  }

  const visited = new Uint8Array(n)
  const components: number[][] = []
  for (let start = 0; start < n; start++) {
    if (visited[start]) continue
    visited[start] = 1
    const component: number[] = [start]
    const queue = [start]
    while (queue.length > 0) {
      const cur = queue.shift()!
      for (const neighbor of adj[cur]) {
        if (!visited[neighbor]) {
          visited[neighbor] = 1
          component.push(neighbor)
          queue.push(neighbor)
        }
      }
    }
    components.push(component)
  }

  const clusters: ClusterResult['clusters'] = []
  const orphanCards: string[] = []

  for (const component of components) {
    const memberDocs = component.map(i => docs[i])

    if (component.length < minClusterSize) {
      for (const doc of memberDocs) orphanCards.push(doc.id)
      continue
    }

    const dim = memberDocs[0].vector.length
    const centroid = new Array(dim).fill(0)
    for (const doc of memberDocs) {
      for (let d = 0; d < dim; d++) centroid[d] += doc.vector[d]
    }
    for (let d = 0; d < dim; d++) centroid[d] /= memberDocs.length

    let totalSim = 0, pairCount = 0
    for (let i = 0; i < memberDocs.length; i++) {
      for (let j = i + 1; j < memberDocs.length; j++) {
        totalSim += cosineSimilarity(memberDocs[i].vector, memberDocs[j].vector)
        pairCount++
      }
    }
    const cohesion = pairCount > 0 ? totalSim / pairCount : 1

    const cardSimilarities: Record<string, number> = {}
    let bestLabel = '', bestSim = -1
    for (const doc of memberDocs) {
      const sim = cosineSimilarity(centroid, doc.vector)
      cardSimilarities[doc.id] = sim
      if (sim > bestSim) { bestSim = sim; bestLabel = doc.title || doc.id }
    }

    clusters.push({
      id: `cluster-${clusters.length}`,
      label: bestLabel,
      cardIds: memberDocs.map(d => d.id),
      cohesion,
      cardSimilarities,
    })
  }

  return { clusters, orphanCards }
}

// Helpers to create test vectors
function unitVec(dim: number, idx: number): number[] {
  const v = new Array(dim).fill(0)
  v[idx] = 1
  return v
}

function similarVec(base: number[], noise: number = 0.1): number[] {
  return base.map(v => v + (Math.random() - 0.5) * noise)
}

describe('cluster algorithm', () => {
  it('returns empty for no docs', () => {
    const result = cluster([], 0.5, 2)
    expect(result.clusters).toHaveLength(0)
    expect(result.orphanCards).toHaveLength(0)
  })

  it('puts a single doc into orphanCards', () => {
    const docs = [{ id: 'a', vector: unitVec(4, 0), title: 'Solo' }]
    const result = cluster(docs, 0.5, 2)
    expect(result.clusters).toHaveLength(0)
    expect(result.orphanCards).toEqual(['a'])
  })

  it('clusters two similar docs together', () => {
    const base = [1, 0.8, 0.1, 0]
    const docs = [
      { id: 'a', vector: base, title: 'Doc A' },
      { id: 'b', vector: [0.9, 0.85, 0.15, 0.05], title: 'Doc B' },
    ]
    const result = cluster(docs, 0.5, 2)
    expect(result.clusters).toHaveLength(1)
    expect(result.clusters[0].cardIds).toContain('a')
    expect(result.clusters[0].cardIds).toContain('b')
    expect(result.orphanCards).toHaveLength(0)
  })

  it('separates dissimilar docs into orphans', () => {
    const docs = [
      { id: 'a', vector: unitVec(4, 0), title: 'X' },
      { id: 'b', vector: unitVec(4, 3), title: 'Y' },
    ]
    // Cosine similarity of orthogonal vectors = 0
    const result = cluster(docs, 0.5, 2)
    expect(result.clusters).toHaveLength(0)
    expect(result.orphanCards).toHaveLength(2)
  })

  it('forms 3 clusters from 3 distinct topic groups', () => {
    const docs = [
      // Topic A
      { id: 'a1', vector: [1, 0.9, 0, 0], title: 'AI 1' },
      { id: 'a2', vector: [0.9, 1, 0, 0], title: 'AI 2' },
      // Topic B
      { id: 'b1', vector: [0, 0, 1, 0.9], title: 'Bio 1' },
      { id: 'b2', vector: [0, 0, 0.9, 1], title: 'Bio 2' },
      // Topic C
      { id: 'c1', vector: [0.9, -0.9, 0, 0], title: 'Math 1' },
      { id: 'c2', vector: [1, -0.8, 0, 0], title: 'Math 2' },
    ]
    const result = cluster(docs, 0.5, 2)
    expect(result.clusters).toHaveLength(3)
    expect(result.orphanCards).toHaveLength(0)

    const labels = result.clusters.map(c => c.cardIds.sort().join(',')).sort()
    expect(labels).toContain('a1,a2')
    expect(labels).toContain('b1,b2')
    expect(labels).toContain('c1,c2')
  })

  it('computes cohesion as mean pairwise similarity', () => {
    const docs = [
      { id: 'a', vector: [1, 0, 0], title: 'A' },
      { id: 'b', vector: [0.8, 0.6, 0], title: 'B' },
    ]
    const result = cluster(docs, 0.5, 2)
    expect(result.clusters).toHaveLength(1)
    // Cohesion of 2 docs = their pairwise similarity
    const expectedSim = cosineSimilarity(docs[0].vector, docs[1].vector)
    expect(result.clusters[0].cohesion).toBeCloseTo(expectedSim, 5)
  })

  it('picks the most central doc as cluster label', () => {
    const docs = [
      { id: 'a', vector: [1, 0.5, 0], title: 'Peripheral' },
      { id: 'b', vector: [0.8, 0.8, 0], title: 'Central' },
      { id: 'c', vector: [0.5, 1, 0], title: 'Other' },
    ]
    const result = cluster(docs, 0.5, 2)
    expect(result.clusters).toHaveLength(1)
    // The label should be the doc closest to centroid
    expect(result.clusters[0].label).toBe('Central')
  })

  it('respects minClusterSize', () => {
    const docs = [
      { id: 'a', vector: [1, 0], title: 'A' },
      { id: 'b', vector: [0.9, 0.4], title: 'B' },
      { id: 'c', vector: [0, 1], title: 'C' },
    ]
    // With minClusterSize=3, all go to orphans
    const result3 = cluster(docs, 0.5, 3)
    expect(result3.clusters).toHaveLength(0)
    expect(result3.orphanCards).toHaveLength(3)

    // With minClusterSize=2, a+b form a cluster, c is orphan
    const result2 = cluster(docs, 0.5, 2)
    expect(result2.clusters).toHaveLength(1)
    expect(result2.orphanCards).toHaveLength(1)
  })
})