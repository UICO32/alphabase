import { describe, expect, it } from 'vitest'
import { formatMediaUrl, isMediaUrl, parseMediaUrl } from './mediaUrl'

describe('mediaUrl', () => {
  it('formats media ids as hepta-media urls', () => {
    expect(formatMediaUrl('media-123')).toBe('hepta-media://media-123')
  })

  it('detects hepta-media urls', () => {
    expect(isMediaUrl('hepta-media://media-123')).toBe(true)
    expect(isMediaUrl('data:image/png;base64,abc')).toBe(false)
    expect(isMediaUrl('https://example.com/a.png')).toBe(false)
  })

  it('parses media id and optional filename', () => {
    expect(parseMediaUrl('hepta-media://media-123')).toEqual({ mediaId: 'media-123', name: undefined })
    expect(parseMediaUrl('hepta-media://media-123/screenshot.png')).toEqual({ mediaId: 'media-123', name: 'screenshot.png' })
  })

  it('returns null for invalid urls', () => {
    expect(parseMediaUrl('')).toBeNull()
    expect(parseMediaUrl('https://example.com/a.png')).toBeNull()
    expect(parseMediaUrl('hepta-media://')).toBeNull()
  })
})
