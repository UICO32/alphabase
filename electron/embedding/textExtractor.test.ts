import { describe, expect, it } from 'vitest'
import { extractEmbeddingText } from './textExtractor'

describe('extractEmbeddingText', () => {
  it('indexes a title-only card', () => {
    expect(extractEmbeddingText('', '  Project direction  ')).toBe('Project direction')
  })

  it('places the title before body content', () => {
    const content = JSON.stringify([{ type: 'paragraph', content: [{ type: 'text', text: 'Body text' }] }])
    const result = extractEmbeddingText(content, 'Card title')

    expect(result.startsWith('Card title')).toBe(true)
    expect(result).toContain('Body text')
  })
})
