import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, basename } from 'path'
import { InferenceSession, Tensor } from 'onnxruntime-node'
import {
  ZVecCreateAndOpen,
  ZVecOpen,
  ZVecCollectionSchema,
  ZVecCollection,
  ZVecDoc,
  ZVecDataType,
  ZVecIndexType,
  ZVecMetricType,
} from '@zvec/zvec'
import { extractEmbeddingText } from './textExtractor'

// --- Constants ---
const MODEL_ID = 'jina-embeddings-v5'
const TRUNCATED_DIMENSIONS = 256
const DEFAULT_THRESHOLD = 0.7
const VECTORS_DIR_NAME = '.vectors'
const META_FILE = 'meta.json'
const COLLECTION_NAME = 'cards'

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

// --- ZVec collection schema ---
const collectionSchema = new ZVecCollectionSchema({
  name: COLLECTION_NAME,
  vectors: {
    name: 'embedding',
    dataType: ZVecDataType.VECTOR_FP32,
    dimension: TRUNCATED_DIMENSIONS,
    indexParams: {
      indexType: ZVecIndexType.HNSW,
      metricType: ZVecMetricType.COSINE,
      m: 16,
      efConstruction: 200,
    },
  },
  fields: [
    { name: 'updatedAt', dataType: ZVecDataType.STRING },
    { name: 'modality', dataType: ZVecDataType.STRING },
  ],
})

/**
 * EmbeddingService: coordinates ONNX Runtime for embedding generation
 * and ZVec for vector storage/search.
 */
export class EmbeddingService {
  private session: InferenceSession | null = null
  private collection: ZVecCollection | null = null
  private vectorsDir: string = ''
  private isIndexing: boolean = false
  private abortController: AbortController | null = null
  private threshold: number = DEFAULT_THRESHOLD

  async init(workspacePath: string): Promise<void> {
    this.vectorsDir = join(workspacePath, VECTORS_DIR_NAME)

    // 1. Ensure vectors directory exists
    if (!existsSync(this.vectorsDir)) {
      mkdirSync(this.vectorsDir, { recursive: true })
    }

    // 2. Check model file exists
    const modelPath = join(this.vectorsDir, 'model.onnx')
    if (!existsSync(modelPath)) {
      throw new Error(EMBEDDING_ERRORS.MODEL_MISSING)
    }

    // 3. Create ONNX InferenceSession
    try {
      this.session = await InferenceSession.create(modelPath, {
        executionProviders: ['cuda', 'cpu'],
      })
    } catch (err) {
      this.session = null
      throw new Error(`${EMBEDDING_ERRORS.INIT_FAILED}: ${(err as Error).message}`)
    }

    // 4. Open or create ZVec collection
    const collectionPath = join(this.vectorsDir, 'zvec_data')
    try {
      this.collection = ZVecOpen(collectionPath)
    } catch {
      // Collection doesn't exist yet, create it
      this.collection = ZVecCreateAndOpen(collectionPath, collectionSchema)
    }
  }

  async indexAll(
    cardsDir: string,
    onProgress?: (progress: IndexProgress) => void,
  ): Promise<{ indexed: number; skipped: number }> {
    if (!this.session || !this.collection) {
      throw new Error(EMBEDDING_ERRORS.NOT_INITIALIZED)
    }
    if (this.isIndexing) {
      throw new Error(EMBEDDING_ERRORS.INDEXING_IN_PROGRESS)
    }

    this.isIndexing = true
    this.abortController = new AbortController()

    let indexed = 0
    let skipped = 0

    try {
      const files = readdirSync(cardsDir).filter(
        (f) => f.endsWith('.json') && !f.endsWith('.trash.json'),
      )
      const total = files.length

      for (let i = 0; i < files.length; i++) {
        // Check abort signal
        if (this.abortController.signal.aborted) break

        const filePath = join(cardsDir, files[i])
        const cardId = basename(files[i], '.json')

        try {
          const raw = readFileSync(filePath, 'utf-8')
          const card = JSON.parse(raw)

          const text = extractEmbeddingText(card.content ?? '')
          if (!text) {
            skipped++
            if (onProgress) onProgress({ indexed, skipped, total })
            continue
          }

          const vector = await this.encode(text)
          const updatedAt = card.updatedAt ?? new Date().toISOString().split('T')[0]
          const modality = 'text'

          this.collection.upsertSync({
            id: `card:${cardId}`,
            vectors: { embedding: vector },
            fields: { updatedAt, modality },
          })

          indexed++
        } catch {
          skipped++
        }

        if (onProgress) onProgress({ indexed, skipped, total })
      }

      // Optimize index after bulk insert
      this.collection.optimizeSync()

      // Write meta.json
      this.writeMeta(indexed)

      return { indexed, skipped }
    } finally {
      this.isIndexing = false
      this.abortController = null
    }
  }

  async search(cardId: string, topK: number = 20): Promise<SearchResult[]> {
    if (!this.collection) {
      throw new Error(EMBEDDING_ERRORS.NOT_INITIALIZED)
    }

    // Fetch the card's vector
    const docs = this.collection.fetchSync(`card:${cardId}`)
    const doc = docs[`card:${cardId}`]
    if (!doc) return []

    const targetVector = doc.vectors.embedding as number[]

    // Query with topK+1 to filter out self
    const results = this.collection.querySync({
      fieldName: 'embedding',
      topk: topK + 1,
      vector: targetVector,
      params: { indexType: ZVecIndexType.HNSW, ef: 300 },
    })

    // Filter out self and results below threshold
    return results
      .filter((r: ZVecDoc) => r.id !== `card:${cardId}` && r.score >= this.threshold)
      .slice(0, topK)
      .map((r: ZVecDoc) => ({
        cardId: r.id.replace('card:', ''),
        score: r.score,
        modality: r.fields.modality as string,
      }))
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort()
    }
  }

  isModelAvailable(): boolean {
    if (!this.vectorsDir) return false
    return existsSync(join(this.vectorsDir, 'model.onnx'))
  }

  isInitialized(): boolean {
    return this.session !== null && this.collection !== null
  }

  getStatus(): {
    initialized: boolean
    modelAvailable: boolean
    indexing: boolean
    docCount: number
    indexCompleteness: Record<string, number>
  } {
    const stats = this.collection?.stats ?? {
      docCount: 0,
      indexCompleteness: {},
    }
    return {
      initialized: this.isInitialized(),
      modelAvailable: this.isModelAvailable(),
      indexing: this.isIndexing,
      docCount: stats.docCount,
      indexCompleteness: stats.indexCompleteness,
    }
  }

  getThreshold(): number {
    return this.threshold
  }

  setThreshold(value: number): void {
    this.threshold = value
  }

  dispose(): void {
    if (this.collection) {
      this.collection.closeSync()
      this.collection = null
    }
    if (this.session) {
      this.session.release()
      this.session = null
    }
    this.isIndexing = false
    this.abortController = null
  }

  // --- Private methods ---

  /**
   * Encode text to truncated + L2-normalized embedding vector.
   * Matryoshka: model outputs 1024-dim, truncate to first 256, then normalize.
   */
  private async encode(text: string): Promise<number[]> {
    if (!this.session) {
      throw new Error(EMBEDDING_ERRORS.NOT_INITIALIZED)
    }

    // TODO: Replace with actual jina tokenizer integration.
    // For now, use a simple placeholder tokenizer that produces
    // token IDs from character codes. This will NOT produce meaningful
    // embeddings — it's a stub for integration testing only.
    const tokens = this.placeholderTokenize(text)

    const inputIds = new Tensor('int64', BigInt64Array.from(tokens.map(BigInt)), [1, tokens.length])
    const attentionMask = new Tensor('int64', BigInt64Array.from(tokens.map(() => BigInt(1))), [1, tokens.length])

    const output = await this.session.run({
      input_ids: inputIds,
      attention_mask: attentionMask,
    })

    // Get the embedding output tensor
    const outputName = this.session.outputNames[0]
    const embeddingTensor = output[outputName]
    if (!embeddingTensor) {
      throw new Error('ONNX model did not produce expected output')
    }

    const fullVector = embeddingTensor.data as Float32Array

    // Matryoshka truncation: take first 256 elements
    const truncated = fullVector.slice(0, TRUNCATED_DIMENSIONS)

    // L2 normalize
    return this.l2Normalize(Array.from(truncated))
  }

  /**
   * Placeholder tokenizer — maps characters to small integer token IDs.
   * This is NOT a real tokenizer and will produce meaningless embeddings.
   * Replace with the actual jina tokenizer when available.
   */
  private placeholderTokenize(text: string): number[] {
    // Simple: split by whitespace, map each char to a code offset
    // This is purely for structural testing — real tokenizer TBD
    const chars = text.split('')
    const ids = chars.map((c) => {
      const code = c.charCodeAt(0)
      // Clamp to a range that won't go out of vocabulary bounds
      return code % 50000 + 1
    })
    // Truncate to max length (8192 tokens for jina v5)
    return ids.slice(0, 8192)
  }

  /**
   * L2-normalize a vector: divide each element by the L2 norm.
   */
  private l2Normalize(vec: number[]): number[] {
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
    if (norm === 0) return vec
    return vec.map((v) => v / norm)
  }

  /**
   * Write meta.json with indexing metadata.
   */
  private writeMeta(cardCount: number): void {
    const meta: MetaInfo = {
      lastIndexedAt: new Date().toISOString(),
      cardCount,
      modelId: MODEL_ID,
      dimensions: TRUNCATED_DIMENSIONS,
      threshold: this.threshold,
    }
    writeFileSync(join(this.vectorsDir, META_FILE), JSON.stringify(meta, null, 2), 'utf-8')
  }
}