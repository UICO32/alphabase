import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { EmbeddingService } from './EmbeddingService'

const tempPaths: string[] = []

afterEach(() => {
  for (const path of tempPaths.splice(0)) rmSync(path, { recursive: true, force: true })
})

describe('EmbeddingService native runtime boundary', () => {
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
    writeFileSync(join(vectorsPath, 'vectors.json'), JSON.stringify({
      docs: {
        card1: {
          id: 'card1',
          vector: [1, 0],
          fields: { title: 'Cached card' },
        },
      },
    }))

    const service = new EmbeddingService()
    await service.init(workspacePath, join(workspacePath, 'missing-model'))
    const result = await service.cluster(2)

    expect(service.getStatus().docCount).toBe(1)
    expect(result.orphanCards).toContain('card1')
  })
})
