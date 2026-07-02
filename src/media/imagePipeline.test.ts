import { describe, expect, it } from 'vitest'
import { getImageMimeType, shouldStoreAsWorkspaceMedia } from './imagePipeline'

describe('imagePipeline', () => {
  it('stores large data urls as workspace media', () => {
    const largeDataUrl = `data:image/png;base64,${'a'.repeat(400_000)}`
    expect(shouldStoreAsWorkspaceMedia(largeDataUrl)).toBe(true)
  })

  it('allows tiny data urls to remain inline during fallback', () => {
    const tinyDataUrl = 'data:image/png;base64,abc'
    expect(shouldStoreAsWorkspaceMedia(tinyDataUrl)).toBe(false)
  })

  it('extracts mime type from data urls', () => {
    expect(getImageMimeType('data:image/webp;base64,abc')).toBe('image/webp')
    expect(getImageMimeType('not-data')).toBe('application/octet-stream')
  })
})
