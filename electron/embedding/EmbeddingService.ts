import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, basename } from 'path'
import { InferenceSession, Tensor } from 'onnxruntime-node'
import { extractEmbeddingText } from './textExtractor'
import { JinaTokenizer } from './tokenizer'

// --- Constants ---
const MODEL_ID = 'jina-embeddings-v5-text-nano-retrieval'
const TRUNCATED_DIMENSIONS = 256
const DEFAULT_THRESHOLD = 0.5
const VECTORS_DIR_NAME = '.vectors'
const META_FILE = 'meta.json'
const MODEL_FILENAME = 'model_q4f16.onnx'
const TOKENIZER_FILENAME = 'tokenizer.json'
const MAX_SEQ_LENGTH = 8192
const BATCH_SIZE = 8

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
}

interface VectorStore {
  docs: Record<string, VectorDoc>
}

export class EmbeddingService {
  private session: InferenceSession | null = null
  private tokenizer: JinaTokenizer | null = null
  private store: VectorStore = { docs: {} }
  private storePath: string = ''
  private vectorsDir: string = ''
  private modelDir: string = ''
  private isIndexing: boolean = false
  private abortController: AbortController | null = null
  private threshold: number = DEFAULT_THRESHOLD

  async init(workspacePath: string, modelDir?: string): Promise<void> {
    this.vectorsDir = join(workspacePath, VECTORS_DIR_NAME)
    this.modelDir = modelDir || this.vectorsDir
    this.storePath = join(this.vectorsDir, 'vectors.json')

    if (!existsSync(this.vectorsDir)) {
      mkdirSync(this.vectorsDir, { recursive: true })
    }

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

    this.loadStore()
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
    cardsDir: string,
    onProgress?: (progress: IndexProgress) => void,
  ): Promise<{ indexed: number; skipped: number }> {
    if (!this.session) {
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

      // Read and prepare all cards first
      const pending: Array<{ cardId: string; text: string; updatedAt: string }> = []
      for (let i = 0; i < files.length; i++) {
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
          pending.push({
            cardId,
            text,
            updatedAt: card.updatedAt ?? new Date().toISOString().split('T')[0],
          })
        } catch {
          skipped++
          if (onProgress) onProgress({ indexed, skipped, total })
        }
      }

      // Batch encode
      for (let batchStart = 0; batchStart < pending.length; batchStart += BATCH_SIZE) {
        if (this.abortController.signal.aborted) break

        const batch = pending.slice(batchStart, batchStart + BATCH_SIZE)
        const vectors = await this.encodeBatch(batch.map(b => b.text))

        for (let j = 0; j < batch.length; j++) {
          this.store.docs[`card_${batch[j].cardId}`] = {
            id: `card_${batch[j].cardId}`,
            vector: vectors[j],
            fields: { updatedAt: batch[j].updatedAt, modality: 'text' },
          }
          indexed++
        }

        if (onProgress) onProgress({ indexed, skipped, total })
      }

      this.saveStore()
      this.writeMeta(indexed)

      return { indexed, skipped }
    } finally {
      this.isIndexing = false
      this.abortController = null
    }
  }

  async search(cardId: string, topK: number = 20): Promise<SearchResult[]> {
    const doc = this.store.docs[`card_${cardId}`]
    if (!doc) return []

    const targetVector = doc.vector

    const scored = Object.values(this.store.docs)
      .filter(d => d.id !== `card_${cardId}`)
      .map(d => ({
        cardId: d.id.replace('card_', ''),
        score: cosineSimilarity(targetVector, d.vector),
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
    this.store = { docs: {} }
    this.isIndexing = false
    this.abortController = null
  }

  private async encodeBatch(texts: string[]): Promise<number[][]> {
    if (!this.session || !this.tokenizer) {
      throw new Error(EMBEDDING_ERRORS.NOT_INITIALIZED)
    }

    const encoded = texts.map(t => {
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

    const embeddingTensor = output['sentence_embedding']
    if (!embeddingTensor) {
      throw new Error('ONNX model did not produce sentence_embedding output')
    }

    const data = embeddingTensor.data as Float32Array
    const outputDims = embeddingTensor.dims as number[]

    // Output shape: [batchSize, dimensions]
    const dimCount = outputDims[1] || data.length / batchSize

    const results: number[][] = []
    for (let i = 0; i < batchSize; i++) {
      const start = i * dimCount
      const fullVec = data.slice(start, start + TRUNCATED_DIMENSIONS)
      results.push(l2Normalize(Array.from(fullVec)))
    }

    return results
  }

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