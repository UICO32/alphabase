import { describe, expect, it, vi } from 'vitest'
import { getImageMimeType, shouldStoreAsWorkspaceMedia, storeMediaFileForWorkspace } from './imagePipeline'

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

  it('uses the disk-backed preload path without reading the whole file in the renderer', async () => {
    const arrayBuffer = vi.fn().mockRejectedValue(new Error('renderer bytes should not be read'))
    const file = new File(['ignored'], 'photo.png', { type: 'image/png' })
    Object.defineProperty(file, 'arrayBuffer', { value: arrayBuffer })
    const stored = {
      assetId: 'a'.repeat(64),
      kind: 'image' as const,
      mimeType: 'image/png',
      name: 'photo.png',
      size: 7,
      url: 'hepta-media://asset/photo.png',
      variants: [],
    }
    const previousApi = window.electronAPI
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        media: {
          storeFile: vi.fn().mockResolvedValue(stored),
          store: vi.fn(),
        },
      } as unknown as Window['electronAPI'],
    })

    try {
      await expect(storeMediaFileForWorkspace('D:/workspace', file)).resolves.toEqual(stored)
      expect(arrayBuffer).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(window, 'electronAPI', { configurable: true, value: previousApi })
    }
  })
})
