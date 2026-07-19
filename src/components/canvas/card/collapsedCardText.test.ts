import { describe, expect, it } from 'vitest'
import { extractCollapsedCardText } from './collapsedCardText'

describe('extractCollapsedCardText', () => {
  it('uses block zero as the capped title and later blocks as the body', () => {
    const result = extractCollapsedCardText(JSON.stringify([
      { type: 'paragraph', content: [{ type: 'text', text: '123456789012345678901234567890' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'First body' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Second body' }] },
    ]), '')

    expect(result).toEqual({
      title: '12345678901234567890123…',
      body: 'First body Second body',
    })
  })
})
