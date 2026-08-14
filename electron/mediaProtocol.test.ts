import { describe, expect, it } from 'vitest'
import { mediaMimeType, parseByteRange } from './mediaProtocol'

describe('parseByteRange', () => {
  it('parses bounded and open-ended ranges', () => {
    expect(parseByteRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 })
    expect(parseByteRange('bytes=90-', 100)).toEqual({ start: 90, end: 99 })
  })

  it('parses suffix ranges and clamps them to the file', () => {
    expect(parseByteRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 })
    expect(parseByteRange('bytes=-200', 100)).toEqual({ start: 0, end: 99 })
  })

  it('rejects unsupported or unsatisfiable ranges', () => {
    expect(parseByteRange('bytes=100-120', 100)).toBe('invalid')
    expect(parseByteRange('bytes=0-1,4-5', 100)).toBe('invalid')
    expect(parseByteRange('items=0-1', 100)).toBe('invalid')
  })
})

describe('mediaMimeType', () => {
  it('recognizes image and video media types', () => {
    expect(mediaMimeType('asset.w512.webp')).toBe('image/webp')
    expect(mediaMimeType('clip.mp4')).toBe('video/mp4')
    expect(mediaMimeType('clip.webm')).toBe('video/webm')
  })
})
