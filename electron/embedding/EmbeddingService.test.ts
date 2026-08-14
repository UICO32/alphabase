import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CURRENT_INDEX_VERSION, CURRENT_MODEL_VERSION, EmbeddingService } from './EmbeddingService'

const tempPaths: string[] = []

function vectorStore(docs: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return {
    indexVersion: CURRENT_INDEX_VERSION,
    modelVersion: CURRENT_MODEL_VERSION,
    dimensions: 256,
    docs,
    ...overrides,
  }
}

afterEach(() => {
  for (const path of tempPaths.splice(0)) rmSync(path, { recursive: true, force: true })
})

describe('EmbeddingService native runtime boundary', () => {
  it('requires the ONNX graph, external data, and tokenizer before reporting the model available', () => {
    const modelDir = mkdtempSync(join(tmpdir(), 'abase-model-'))
    tempPaths.push(modelDir)
    const service = new EmbeddingService()
    ;(service as unknown as { modelDir: string }).modelDir = modelDir

    writeFileSync(join(modelDir, 'model_q4f16.onnx'), 'model')
    expect(service.isModelAvailable()).toBe(false)

    writeFileSync(join(modelDir, 'model_q4f16.onnx_data'), 'data')
    writeFileSync(join(modelDir, 'tokenizer.json'), '{}')
    expect(service.isModelAvailable()).toBe(true)
  })

  it('can load cached-vector services without loading onnxruntime-node', () => {
    const service = new EmbeddingService()

    expect(service.getStatus()).toMatchObject({
      initialized: false,
      initializationError: null,
      docCount: 0,
    })
  })

  it('keeps cached-vector clustering available when no native model can initialize', async () => {
    const workspacePath = mkdtempSync(join(tmpdir(), 'abase-embedding-'))
    tempPaths.push(workspacePath)
    const vectorsPath = join(workspacePath, '.vectors')
    mkdirSync(vectorsPath, { recursive: true })
    writeFileSync(join(vectorsPath, 'vectors.json'), JSON.stringify(vectorStore({
        card1: {
          id: 'card1',
          vector: [1, 0],
          fields: { title: 'Cached card' },
          contentHash: 'cached',
        },
    })))

    const service = new EmbeddingService()
    await service.init(workspacePath, join(workspacePath, 'missing-model'))
    const result = await service.cluster(2)

    expect(service.getStatus().docCount).toBe(1)
    expect(result.orphanCards).toContain('card1')
  })

  it('removes a stale vector when a card no longer has indexable text', async () => {
    const workspacePath = mkdtempSync(join(tmpdir(), 'abase-embedding-'))
    tempPaths.push(workspacePath)
    const vectorsPath = join(workspacePath, '.vectors')
    const cardsPath = join(workspacePath, 'cards')
    mkdirSync(vectorsPath, { recursive: true })
    mkdirSync(cardsPath, { recursive: true })
    writeFileSync(join(vectorsPath, 'vectors.json'), JSON.stringify(vectorStore({
      card1: { id: 'card1', vector: [1, 0], fields: { title: 'Old title' }, contentHash: 'stale' },
    })))
    writeFileSync(join(cardsPath, 'card1.json'), JSON.stringify({ id: 'card1', title: '', content: '' }))

    const service = new EmbeddingService()
    await service.init(workspacePath, join(workspacePath, 'missing-model'))
    ;(service as unknown as { session: object }).session = {}
    ;(service as unknown as { tokenizer: object }).tokenizer = {}

    const result = await service.indexCard('card1')

    expect(result).toEqual({ indexed: false, changed: true, reason: 'empty' })
    expect(service.getStatus().docCount).toBe(0)
  })

  it('reports title-only, empty, and failed cards during reconciliation', async () => {
    const workspacePath = mkdtempSync(join(tmpdir(), 'abase-embedding-'))
    tempPaths.push(workspacePath)
    const vectorsPath = join(workspacePath, '.vectors')
    const cardsPath = join(workspacePath, 'cards')
    mkdirSync(vectorsPath, { recursive: true })
    mkdirSync(cardsPath, { recursive: true })
    writeFileSync(join(vectorsPath, 'vectors.json'), JSON.stringify(vectorStore({
      empty: { id: 'empty', vector: [1, 0], fields: { title: 'Stale' }, contentHash: 'stale' },
    })))
    writeFileSync(join(cardsPath, 'title-only.json'), JSON.stringify({ id: 'title-only', title: 'Useful title', content: '' }))
    writeFileSync(join(cardsPath, 'empty.json'), JSON.stringify({ id: 'empty', title: '', content: '' }))
    writeFileSync(join(cardsPath, 'broken.json'), '{')

    const service = new EmbeddingService()
    await service.init(workspacePath, join(workspacePath, 'missing-model'))
    ;(service as unknown as { session: object }).session = {}
    ;(service as unknown as { tokenizer: object }).tokenizer = {}
    const encodeText = vi.fn().mockResolvedValue([0.5, 0.5])
    ;(service as unknown as { encodeText: typeof encodeText }).encodeText = encodeText
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    try {
      const result = await service.indexAll()

      expect(result).toMatchObject({
        totalCards: 3,
        indexedCount: 1,
        newIndexed: 1,
        empty: 1,
        failed: 1,
        removed: 1,
      })
      expect(encodeText).toHaveBeenCalledWith('Useful title')

      const secondResult = await service.indexAll()
      expect(secondResult).toMatchObject({ newIndexed: 0, skipped: 1, empty: 1, failed: 1 })
      expect(encodeText).toHaveBeenCalledTimes(1)

      const saved = JSON.parse(readFileSync(join(vectorsPath, 'vectors.json'), 'utf-8'))
      expect(saved).toMatchObject({
        indexVersion: CURRENT_INDEX_VERSION,
        modelVersion: CURRENT_MODEL_VERSION,
        dimensions: 256,
      })
      expect(saved.docs['title-only'].contentHash).toMatch(/^[a-f0-9]{64}$/)
    } finally {
      warn.mockRestore()
    }
  })

  it('reuses vectors by content hash even when a workspace file is rewritten', async () => {
    const workspacePath = mkdtempSync(join(tmpdir(), 'abase-embedding-'))
    tempPaths.push(workspacePath)
    const cardsPath = join(workspacePath, 'cards')
    mkdirSync(cardsPath, { recursive: true })
    const cardPath = join(cardsPath, 'card1.json')
    const cardJson = JSON.stringify({ id: 'card1', title: 'Same title', content: 'Same body' })
    writeFileSync(cardPath, cardJson)

    const service = new EmbeddingService()
    await service.init(workspacePath, join(workspacePath, 'missing-model'))
    ;(service as unknown as { session: object }).session = {}
    ;(service as unknown as { tokenizer: object }).tokenizer = {}
    const encodeText = vi.fn().mockResolvedValue([0.5, 0.5])
    ;(service as unknown as { encodeText: typeof encodeText }).encodeText = encodeText

    expect(await service.indexAll()).toMatchObject({ newIndexed: 1, skipped: 0 })
    writeFileSync(cardPath, cardJson)
    expect(await service.indexAll()).toMatchObject({ newIndexed: 0, skipped: 1 })
    expect(encodeText).toHaveBeenCalledTimes(1)
  })

  it('skips incremental card indexing when normalized content is unchanged', async () => {
    const workspacePath = mkdtempSync(join(tmpdir(), 'abase-embedding-'))
    tempPaths.push(workspacePath)
    const cardsPath = join(workspacePath, 'cards')
    mkdirSync(cardsPath, { recursive: true })
    writeFileSync(join(cardsPath, 'card1.json'), JSON.stringify({ id: 'card1', title: 'Same title', content: 'Same body' }))

    const service = new EmbeddingService()
    await service.init(workspacePath, join(workspacePath, 'missing-model'))
    ;(service as unknown as { session: object }).session = {}
    ;(service as unknown as { tokenizer: object }).tokenizer = {}
    const encodeText = vi.fn().mockResolvedValue([0.5, 0.5])
    ;(service as unknown as { encodeText: typeof encodeText }).encodeText = encodeText

    expect(await service.indexCard('card1')).toEqual({ indexed: true, changed: true })
    expect(await service.indexCard('card1')).toEqual({ indexed: true, changed: false })
    expect(encodeText).toHaveBeenCalledTimes(1)
  })

  it('rebuilds cached vectors when the model metadata is incompatible', async () => {
    const workspacePath = mkdtempSync(join(tmpdir(), 'abase-embedding-'))
    tempPaths.push(workspacePath)
    const vectorsPath = join(workspacePath, '.vectors')
    const cardsPath = join(workspacePath, 'cards')
    mkdirSync(vectorsPath, { recursive: true })
    mkdirSync(cardsPath, { recursive: true })
    writeFileSync(join(cardsPath, 'card1.json'), JSON.stringify({ id: 'card1', title: 'Same title' }))
    writeFileSync(join(vectorsPath, 'vectors.json'), JSON.stringify(vectorStore({
      card1: { id: 'card1', vector: [1, 0], fields: { title: 'Same title' }, contentHash: 'same' },
    }, { modelVersion: 'old-model' })))

    const service = new EmbeddingService()
    await service.init(workspacePath, join(workspacePath, 'missing-model'))
    ;(service as unknown as { session: object }).session = {}
    ;(service as unknown as { tokenizer: object }).tokenizer = {}
    const encodeText = vi.fn().mockResolvedValue([0.5, 0.5])
    ;(service as unknown as { encodeText: typeof encodeText }).encodeText = encodeText

    expect(service.getStatus().docCount).toBe(0)
    expect(await service.indexAll()).toMatchObject({ newIndexed: 1, skipped: 0 })
    expect(encodeText).toHaveBeenCalledTimes(1)
  })
})
