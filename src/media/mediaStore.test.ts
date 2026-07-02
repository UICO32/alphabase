import { describe, expect, it } from 'vitest'
import { getMediaFileName, getMediaPath, mimeToExtension } from './mediaStore'

describe('mediaStore', () => {
  it('maps common image MIME types to extensions', () => {
    expect(mimeToExtension('image/png')).toBe('png')
    expect(mimeToExtension('image/jpeg')).toBe('jpg')
    expect(mimeToExtension('image/webp')).toBe('webp')
    expect(mimeToExtension('image/gif')).toBe('gif')
    expect(mimeToExtension('image/unknown')).toBe('bin')
  })

  it('builds stable media file names', () => {
    expect(getMediaFileName('media-1', 'image/png')).toBe('media-1.png')
  })

  it('builds workspace media paths with forward slashes', () => {
    expect(getMediaPath('D:\\workspace', 'media-1.png')).toBe('D:/workspace/media/media-1.png')
  })
})
