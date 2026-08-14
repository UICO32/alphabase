import { describe, expect, it } from 'vitest'
import { selectMediaVariant } from './selectMediaVariant'

const variants = [
  { width: 2048, url: 'w2048' },
  { width: 512, url: 'w512' },
  { width: 1024, url: 'w1024' },
]

describe('selectMediaVariant', () => {
  it('chooses the smallest source that covers the screen target', () => {
    expect(selectMediaVariant('original', variants, 480)).toBe('w512')
    expect(selectMediaVariant('original', variants, 900)).toBe('w1024')
    expect(selectMediaVariant('original', variants, 1600)).toBe('w2048')
  })

  it('uses the original above the largest tier or without variants', () => {
    expect(selectMediaVariant('original', variants, 3000)).toBe('original')
    expect(selectMediaVariant('original', [], 300)).toBe('original')
  })
})
