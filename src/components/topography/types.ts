import type { TerrainCluster } from '../../stores/embeddingStore'

export interface TopicPeak {
  id: string
  label: string
  x: number
  z: number
  notes: number
  color: string
  cardIds: string[]
  cardSimilarities: Record<string, number>
}

function isUUID(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

// Simple PCA via power iteration: find the first 2 principal components
// of a set of vectors, then project each vector to get 2D coordinates.
function pca2d(vectors: number[][]): number[][] {
  const n = vectors.length
  const dim = vectors[0].length
  if (n === 0) return []
  if (n === 1) return [[0, 0]]

  // Center the data
  const mean = new Array(dim).fill(0)
  for (const v of vectors) for (let d = 0; d < dim; d++) mean[d] += v[d]
  for (let d = 0; d < dim; d++) mean[d] /= n

  const centered = vectors.map(v => v.map((val, d) => val - mean[d]))

  // Power iteration to find first two principal components
  function powerIteration(centered: number[][], dim: number, maxIter = 100): number[] {
    let pc = Array.from({ length: dim }, () => Math.random() - 0.5)
    const norm = Math.sqrt(pc.reduce((s, v) => s + v * v, 0))
    for (let d = 0; d < dim; d++) pc[d] /= norm

    for (let iter = 0; iter < maxIter; iter++) {
      // Multiply by covariance-like: pc' = X^T (X pc)
      const xpc = centered.map(row => {
        let dot = 0
        for (let d = 0; d < dim; d++) dot += row[d] * pc[d]
        return dot
      })
      const newPc = new Array(dim).fill(0)
      for (let i = 0; i < centered.length; i++) {
        for (let d = 0; d < dim; d++) newPc[d] += centered[i][d] * xpc[i]
      }
      const n = Math.sqrt(newPc.reduce((s, v) => s + v * v, 0))
      for (let d = 0; d < dim; d++) newPc[d] /= n
      pc = newPc
    }
    return pc
  }

  const pc1 = powerIteration(centered, dim)

  // Deflate: remove pc1 component from centered data
  const deflated = centered.map(row => {
    let dot = 0
    for (let d = 0; d < dim; d++) dot += row[d] * pc1[d]
    return row.map((val, d) => val - dot * pc1[d])
  })

  const pc2 = powerIteration(deflated, dim)

  // Project each vector to 2D
  return vectors.map(v => {
    let x = 0, z = 0
    for (let d = 0; d < dim; d++) {
      x += (v[d] - mean[d]) * pc1[d]
      z += (v[d] - mean[d]) * pc2[d]
    }
    return [x, z]
  })
}

export function buildTopicPeaks(
  clusters: TerrainCluster[],
  _orphanIds: string[],
  _cardPositions: Record<string, { x: number; y: number }>,
  _cardLabels: Record<string, string>,
): TopicPeak[] {
  if (clusters.length === 0) return []

  const centroids = clusters.map(c => c.centroid)
  const coords = pca2d(centroids)

  // Normalize to [-5, 5] range for the terrain
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const [x, z] of coords) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (z < minZ) minZ = z
    if (z > maxZ) maxZ = z
  }
  const rangeX = maxX - minX || 1
  const rangeZ = maxZ - minZ || 1

  const peaks: TopicPeak[] = clusters.map((cluster, i) => {
    const [px, pz] = coords[i]
    const x = ((px - minX) / rangeX - 0.5) * 20
    const z = ((pz - minZ) / rangeZ - 0.5) * 20

    // Pick the most representative card label for this cluster
    let label = cluster.label
    if (!label || isUUID(label)) {
      // Find the card with highest similarity to centroid
      const entries = Object.entries(cluster.cardSimilarities)
      if (entries.length > 0) {
        entries.sort((a, b) => b[1] - a[1])
        const bestCardId = entries[0][0]
        label = _cardLabels[bestCardId] || bestCardId
      }
    }
    if (!label || isUUID(label)) {
      label = '未命名'
    }

    return {
      id: cluster.id,
      label,
      x, z,
      notes: cluster.cardIds.length,
      color: '#ffcc00',
      cardIds: cluster.cardIds,
      cardSimilarities: cluster.cardSimilarities,
    }
  })

  return peaks
}