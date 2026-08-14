import { describe, expect, it, vi } from 'vitest'
import { migrateInlineImagesInContent } from './migrateInlineImages'

describe('migrateInlineImagesInContent', () => {
  it('replaces large inline image block urls', async () => {
    const store = vi.fn().mockResolvedValue('hepta-media://media-1/media-1.png')
    const content = JSON.stringify([
      { type: 'image', props: { url: `data:image/png;base64,${'a'.repeat(400_000)}` } },
    ])

    const result = await migrateInlineImagesInContent(content, store)

    expect(result.changed).toBe(true)
    expect(result.content).toContain('hepta-media://media-1/media-1.png')
  })

  it('also migrates small inline images so card JSON is byte-free', async () => {
    const store = vi.fn().mockResolvedValue('hepta-media://asset/small.png')
    const content = JSON.stringify([
      { type: 'image', props: { url: 'data:image/png;base64,YQ==' } },
    ])

    const result = await migrateInlineImagesInContent(content, store)

    expect(result.changed).toBe(true)
    expect(result.content).not.toContain('data:image/')
  })

  it('leaves invalid json unchanged', async () => {
    const result = await migrateInlineImagesInContent('not-json', async () => 'x')
    expect(result).toEqual({ changed: false, content: 'not-json' })
  })
})
