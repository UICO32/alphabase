import { describe, expect, it } from 'vitest'
import { resolveMediaUrlForDisplay } from './resolveMediaUrl'

describe('resolveMediaUrlForDisplay', () => {
  it('returns non-media urls unchanged', () => {
    expect(resolveMediaUrlForDisplay('https://example.com/a.png', 'D:/ws')).toBe('https://example.com/a.png')
  })

  it('resolves media urls to workspace-aware protocol urls', () => {
    expect(resolveMediaUrlForDisplay('hepta-media://media-1/media-1.png', 'D:/ws')).toBe('hepta-media://media-1.png?workspace=D%3A%2Fws')
  })

  it('returns original media url when workspace path is unavailable', () => {
    expect(resolveMediaUrlForDisplay('hepta-media://media-1/media-1.png', null)).toBe('hepta-media://media-1/media-1.png')
  })
})
