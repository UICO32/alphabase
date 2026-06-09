import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'fs'
import { join, basename } from 'path'
import { InferenceSession, Tensor } from 'onnxruntime-node'
import { extractEmbeddingText } from './textExtractor'
import { JinaTokenizer } from './tokenizer'

// --- Constants ---
const TRUNCATED_DIMENSIONS = 256
const DEFAULT_THRESHOLD = 0.45
const VECTORS_DIR_NAME = '.vectors'
const MODEL_FILENAME = 'model_q4f16.onnx'
const TOKENIZER_FILENAME = 'tokenizer.json'
const MAX_SEQ_LENGTH = 8192

// --- Error codes ---
export const EMBEDDING_ERRORS = {
  MODEL_MISSING: 'MODEL_MISSING',
  NOT_INITIALIZED: 'NOT_INITIALIZED',
  INIT_FAILED: 'INIT_FAILED',
  INDEXING_IN_PROGRESS: 'INDEXING_IN_PROGRESS',
} as const

// --- Types ---
export interface SearchResult {
  cardId: string
  score: number
  modality: string
}

export interface IndexProgress {
  indexed: number
  skipped: number
  total: number
}

export interface MetaInfo {
  lastIndexedAt: string
  cardCount: number
  modelId: string
  dimensions: number
  threshold: number
}

interface VectorDoc {
  id: string
  vector: number[]
  fields: Record<string, string>
  updatedAt?: number
}

interface VectorStore {
  docs: Record<string, VectorDoc>
}

export interface TerrainCluster {
  id: string
  label: string
  centroid: number[]
  cardIds: string[]
  cohesion: number
  cardSimilarities: Record<string, number>
}

export interface ClusterResult {
  clusters: TerrainCluster[]
  orphanCards: string[]
  computedAt: number
}

export class EmbeddingService {
  private session: InferenceSession | null = null
  private tokenizer: JinaTokenizer | null = null
  private store: VectorStore = { docs: {} }
  modelLoaded: boolean = false
  private storePath: string = ''
  private vectorsDir: string = ''
  private modelDir: string = ''
  private cardsDir: string = ''
  private isIndexing: boolean = false
  private abortController: AbortController | null = null
  private threshold: number = DEFAULT_THRESHOLD

  async init(workspacePath: string, modelDir?: string): Promise<{ modelLoaded: boolean; storeLoaded: boolean; docCount: number }> {
    this.cardsDir = join(workspacePath, 'cards')
    this.vectorsDir = join(workspacePath, VECTORS_DIR_NAME)
    this.modelDir = modelDir || join(workspacePath, '.embedding-model')
    this.storePath = join(this.vectorsDir, 'vectors.json')

    if (!existsSync(this.vectorsDir)) {
      mkdirSync(this.vectorsDir, { recursive: true })
    }

    let storeLoaded = false
    let docCount = 0
    try {
      this.loadStore()
      storeLoaded = true
      docCount = Object.keys(this.store.docs).length
    } catch {
      // No saved store yet
    }

    // Return immediately after store loads — model loads in background
    // Clustering only needs vectors, not the model
    this.loadModelInBackground()

    return { modelLoaded: false, storeLoaded, docCount }
  }

  private loadModelInBackground(): void {
    this.loadModel()
      .then(() => { this.modelLoaded = true })
      .catch(() => { /* Model unavailable — store still usable */ })
  }

  private async loadModel(): Promise<void> {
    const modelPath = join(this.modelDir, MODEL_FILENAME)
    const tokenizerPath = join(this.modelDir, TOKENIZER_FILENAME)
    if (!existsSync(modelPath)) {
      throw new Error(EMBEDDING_ERRORS.MODEL_MISSING)
    }

    try {
      this.tokenizer = new JinaTokenizer(tokenizerPath)
    } catch (err) {
      this.tokenizer = null
      throw new Error(`${EMBEDDING_ERRORS.INIT_FAILED}: tokenizer load failed - ${(err as Error).message}`)
    }

    const providers: string[] = ['dml', 'cpu']
    try {
      this.session = await InferenceSession.create(modelPath, {
        executionProviders: providers,
      })
    } catch {
      try {
        this.session = await InferenceSession.create(modelPath, {
          executionProviders: ['cpu'],
        })
      } catch (err) {
        this.session = null
        throw new Error(`${EMBEDDING_ERRORS.INIT_FAILED}: ${(err as Error).message}`)
      }
    }
  }

  private loadStore(): void {
    if (existsSync(this.storePath)) {
      try {
        const raw = readFileSync(this.storePath, 'utf-8')
        this.store = JSON.parse(raw)
      } catch {
        this.store = { docs: {} }
      }
    } else {
      this.store = { docs: {} }
    }
  }

  private saveStore(): void {
    writeFileSync(this.storePath, JSON.stringify(this.store), 'utf-8')
  }

  async indexAll(
    onProgress?: (done: number, total: number) => void,
  ): Promise<{ totalCards: number; newIndexed: number; skipped: number; removed: number }> {
    if (this.isIndexing) throw new Error(EMBEDDING_ERRORS.INDEXING_IN_PROGRESS)
    if (!this.session || !this.tokenizer) throw new Error(EMBEDDING_ERRORS.NOT_INITIALIZED)

    this.isIndexing = true
    this.abortController = new AbortController()

    try {
      if (!existsSync(this.cardsDir)) {
        return { totalCards: 0, newIndexed: 0, skipped: 0, removed: 0 }
      }

      const cardFiles = readdirSync(this.cardsDir).filter(f => f.endsWith('.json'))
      const totalCards = cardFiles.length
      let newIndexed = 0
      let skipped = 0

      for (let i = 0; i < cardFiles.length; i++) {
        if (this.abortController.signal.aborted) break

        const filename = cardFiles[i]
        const cardId = basename(filename, '.json')
        const filePath = join(this.cardsDir, filename)

        // Incremental: skip cards whose vector is up-to-date
        const fileMtime = statSync(filePath).mtimeMs
        const existingDoc = this.store.docs[cardId]
        if (existingDoc?.updatedAt && existingDoc.updatedAt >= fileMtime) {
          skipped++
          onProgress?.(i + 1, totalCards)
          continue
        }

        try {
          const raw = readFileSync(filePath, 'utf-8')
          const card = JSON.parse(raw)
          const text = extractEmbeddingText(card.content ?? '')
          if (!text.trim()) {
            onProgress?.(i + 1, totalCards)
            continue
          }

          const vector = await this.encodeText(text)
          this.store.docs[cardId] = {
            id: cardId,
            vector,
            fields: { title: card.title ?? card.name ?? '' },
            updatedAt: Date.now(),
          }
          newIndexed++
        } catch {
          // Skip unreadable cards
        }

        onProgress?.(i + 1, totalCards)
      }

      // Clean up vectors for deleted cards
      const currentCardIds = new Set(cardFiles.map(f => basename(f, '.json')))
      const removed = this.cleanStaleVectors(currentCardIds)

      if (newIndexed > 0 || removed > 0) {
        this.saveStore()
      }

      return { totalCards, newIndexed, skipped, removed }
    } finally {
      this.isIndexing = false
      this.abortController = null
    }
  }

  async indexCard(cardId: string): Promise<boolean> {
    if (!this.session || !this.tokenizer) throw new Error(EMBEDDING_ERRORS.NOT_INITIALIZED)

    const filePath = join(this.cardsDir, `${cardId}.json`)
    if (!existsSync(filePath)) {
      if (this.store.docs[cardId]) {
        delete this.store.docs[cardId]
        this.saveStore()
      }
      return false
    }

    const raw = readFileSync(filePath, 'utf-8')
    const card = JSON.parse(raw)
    const text = extractEmbeddingText(card.content ?? '')
    if (!text.trim()) return false

    const vector = await this.encodeText(text)
    this.store.docs[cardId] = {
      id: cardId,
      vector,
      fields: { title: card.title || '' },
      updatedAt: Date.now(),
    }
    this.saveStore()
    return true
  }

  private cleanStaleVectors(currentCardIds: Set<string>): number {
    let removed = 0
    for (const docId of Object.keys(this.store.docs)) {
      if (!currentCardIds.has(docId)) {
        delete this.store.docs[docId]
        removed++
      }
    }
    return removed
  }

  async search(cardId: string, topK: number = 20): Promise<SearchResult[]> {
    // Support both old (card_xxx) and new (xxx) key formats
    const doc = this.store.docs[cardId] || this.store.docs[`card_${cardId}`]
    if (!doc) return []

    const targetVector = doc.vector

    const scored = Object.values(this.store.docs)
      .filter(d => d !== doc)
      .map(d => ({
        cardId: d.id.replace(/^card_/, ''),
        score: cosineSimilarity(targetVector, d.vector),
        modality: d.fields.modality,
      }))
      .filter(r => r.score >= this.threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)

    return scored
  }

  async searchByText(query: string, topK: number = 20): Promise<SearchResult[]> {
    if (!this.session) {
      throw new Error(EMBEDDING_ERRORS.NOT_INITIALIZED)
    }

    const vectors = await this.encodeBatch([query], true)
    const queryVector = vectors[0]

    const scored = Object.values(this.store.docs)
      .map(d => ({
        cardId: d.id.replace('card_', ''),
        score: cosineSimilarity(queryVector, d.vector),
        modality: d.fields.modality,
      }))
      .filter(r => r.score >= this.threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)

    return scored
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort()
    }
  }

  // --- Clustering ---

  async cluster(minClusterSize = 2, _clusterThreshold?: number): Promise<ClusterResult> {
    const docs = Object.values(this.store.docs)
    if (docs.length === 0) {
      return { clusters: [], orphanCards: [], computedAt: Date.now() }
    }

    const n = docs.length
    const targetCount = Math.max(4, Math.min(12, Math.floor(n / 8)))
    const maxClusterSize = Math.ceil(n / targetCount)
    console.log(`[embedding/cluster] START agglomerative: n=${n}, target=${targetCount}, maxSize=${maxClusterSize}`)

    // Agglomerative clustering: start with each doc as its own cluster,
    // merge the two closest clusters until target count is reached.
    const clusters: Array<{ members: number[]; centroid: number[] }> = docs.map(d => ({
      members: [docs.indexOf(d)],
      centroid: [...d.vector],
    }))
    // Fix: use index from map
    clusters.length = 0
    for (let i = 0; i < n; i++) {
      clusters.push({ members: [i], centroid: [...docs[i].vector] })
    }

    // Cosine distance
    function dist(a: number[], b: number[]): number {
      let dot = 0, na = 0, nb = 0
      for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
      const d = Math.sqrt(na) * Math.sqrt(nb)
      return 1 - (d === 0 ? 0 : dot / d)
    }

    // Distance cache
    const distCache = new Map<string, number>()
    const cacheKey = (a: number, b: number) => a < b ? `${a},${b}` : `${b},${a}`
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        distCache.set(cacheKey(i, j), dist(clusters[i].centroid, clusters[j].centroid))
      }
    }

    const alive = new Set(clusters.map((_, i) => i))

    while (alive.size > targetCount) {
      let bestDist = Infinity, bestA = -1, bestB = -1
      const aliveArr = [...alive]
      for (let ai = 0; ai < aliveArr.length; ai++) {
        for (let bi = ai + 1; bi < aliveArr.length; bi++) {
          const aIdx = aliveArr[ai], bIdx = aliveArr[bi]
          // Skip if merged cluster would be too large
          if (clusters[aIdx].members.length + clusters[bIdx].members.length > maxClusterSize) continue
          const key = cacheKey(aIdx, bIdx)
          let d = distCache.get(key)
          if (d === undefined) {
            d = dist(clusters[aIdx].centroid, clusters[bIdx].centroid)
            distCache.set(key, d)
          }
          if (d < bestDist) { bestDist = d; bestA = aIdx; bestB = bIdx }
        }
      }
      if (bestA === -1) break

      const a = clusters[bestA], b = clusters[bestB]
      const total = a.members.length + b.members.length
      const wA = a.members.length / total, wB = b.members.length / total
      for (let d = 0; d < a.centroid.length; d++) a.centroid[d] = a.centroid[d] * wA + b.centroid[d] * wB
      a.members.push(...b.members)
      alive.delete(bestB)

      if (alive.size % 50 === 0 || alive.size <= targetCount + 1) {
        const sizes = [...alive].map(i => clusters[i].members.length).sort((a, b) => b - a)
        console.log(`[embedding/cluster] alive=${alive.size}, top sizes: ${sizes.slice(0, 5).join(',')}`)
      }

      for (const idx of alive) {
        if (idx !== bestA) {
          distCache.delete(cacheKey(bestA, idx))
          distCache.set(cacheKey(bestA, idx), dist(clusters[bestA].centroid, clusters[idx].centroid))
        }
      }
    }

    // Build result
    const resultClusters: TerrainCluster[] = []
    const orphanCards: string[] = []

    for (const idx of alive) {
      const c = clusters[idx]
      if (c.members.length < minClusterSize) {
        for (const mi of c.members) orphanCards.push(docs[mi].id.replace(/^card_/, ''))
        continue
      }

      const memberDocs = c.members.map(i => docs[i])
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
        const cardId = doc.id.replace(/^card_/, '')
        const sim = cosineSimilarity(c.centroid, doc.vector)
        cardSimilarities[cardId] = sim
        if (sim > bestSim) { bestSim = sim; bestLabel = doc.fields.title || cardId }
      }

      resultClusters.push({
        id: `cluster-${resultClusters.length}`,
        label: bestLabel,
        centroid: c.centroid,
        cardIds: memberDocs.map(d => d.id.replace(/^card_/, '')),
        cohesion,
        cardSimilarities,
      })
    }

    console.log(`[embedding/cluster] DONE: ${resultClusters.length} clusters, ${orphanCards.length} orphans`,
      resultClusters.map(c => ({ label: c.label, count: c.cardIds.length })))
    return { clusters: resultClusters, orphanCards, computedAt: Date.now() }
  }

  isModelAvailable(): boolean {
    if (!this.modelDir) return false
    return existsSync(join(this.modelDir, MODEL_FILENAME))
  }

  getModelDir(): string {
    return this.modelDir
  }

  isInitialized(): boolean {
    return this.session !== null
  }

  getStatus(): {
    initialized: boolean
    modelAvailable: boolean
    indexing: boolean
    docCount: number
    modelDir: string
  } {
    return {
      initialized: this.isInitialized(),
      modelAvailable: this.isModelAvailable(),
      indexing: this.isIndexing,
      docCount: Object.keys(this.store.docs).length,
      modelDir: this.modelDir,
    }
  }

  getThreshold(): number {
    return this.threshold
  }

  setThreshold(value: number): void {
    this.threshold = value
  }

  dispose(): void {
    if (this.session) {
      this.session.release()
      this.session = null
    }
    this.tokenizer = null
    // Keep store in memory — it will be re-loaded from disk on next init()
    this.isIndexing = false
    this.abortController = null
  }

  private async encodeText(text: string, isQuery: boolean = false): Promise<number[]> {
    const vectors = await this.encodeBatch([text], isQuery)
    return vectors[0]
  }

  private async encodeBatch(texts: string[], isQuery: boolean = false): Promise<number[][]> {
    if (!this.session || !this.tokenizer) {
      throw new Error(EMBEDDING_ERRORS.NOT_INITIALIZED)
    }

    // text-matching 模型需要前缀区分查询和文档
    const prefix = isQuery ? 'Query: ' : 'Document: '
    const prefixedTexts = texts.map(t => `${prefix}${t}`)

    const encoded = prefixedTexts.map(t => {
      const e = this.tokenizer!.encode(t)
      return {
        ids: e.ids.slice(0, MAX_SEQ_LENGTH),
        mask: e.attentionMask.slice(0, MAX_SEQ_LENGTH),
      }
    })

    // Pad all sequences to the max length in this batch
    const maxLen = Math.max(...encoded.map(e => e.ids.length))

    const batchSize = encoded.length
    const flatIds = new BigInt64Array(batchSize * maxLen)
    const flatMask = new BigInt64Array(batchSize * maxLen)

    for (let i = 0; i < batchSize; i++) {
      const ids = encoded[i].ids
      const mask = encoded[i].mask
      for (let j = 0; j < maxLen; j++) {
        flatIds[i * maxLen + j] = j < ids.length ? BigInt(ids[j]) : BigInt(0)
        flatMask[i * maxLen + j] = j < mask.length ? BigInt(mask[j]) : BigInt(0)
      }
    }

    const inputIds = new Tensor('int64', flatIds, [batchSize, maxLen])
    const attentionMask = new Tensor('int64', flatMask, [batchSize, maxLen])

    const output = await this.session.run({
      input_ids: inputIds,
      attention_mask: attentionMask,
    })

    // text-matching 模型使用 last-token pooling，从 last_hidden_state 提取
    const hiddenStateTensor = output['last_hidden_state']
    if (!hiddenStateTensor) {
      throw new Error('ONNX model did not produce last_hidden_state output')
    }

    const data = hiddenStateTensor.data as Float32Array
    const outputDims = hiddenStateTensor.dims as number[]

    // Output shape: [batchSize, seqLen, hiddenDim]
    const seqLen = outputDims[1]
    const hiddenDim = outputDims[2]

    // 计算每个序列的实际长度（最后一个非 padding token 的位置）
    const sequenceLengths: number[] = []
    for (let i = 0; i < batchSize; i++) {
      let length = 0
      for (let j = 0; j < maxLen; j++) {
        if (flatMask[i * maxLen + j] === BigInt(1)) {
          length = j
        }
      }
      sequenceLengths.push(length)
    }

    const results: number[][] = []
    for (let i = 0; i < batchSize; i++) {
      const lastTokenIdx = sequenceLengths[i]
      const start = i * seqLen * hiddenDim + lastTokenIdx * hiddenDim
      const fullVec = data.slice(start, start + TRUNCATED_DIMENSIONS)
      results.push(l2Normalize(Array.from(fullVec)))
    }

    return results
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  if (denom === 0) return 0
  return dot / denom
}

function l2Normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
  if (norm === 0) return vec
  return vec.map((v) => v / norm)
}