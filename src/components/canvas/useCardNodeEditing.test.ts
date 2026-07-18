import { describe, expect, it } from 'vitest'
import { takeEditorFocusIntent } from './useCardNodeEditing'

describe('takeEditorFocusIntent', () => {
  it('returns and clears the semantic click intent', () => {
    const ref = { current: { x: 120, y: 80, textOffset: 27 } }
    expect(takeEditorFocusIntent(ref)).toEqual({ x: 120, y: 80, textOffset: 27 })
    expect(ref.current).toBeNull()
  })

  it('returns null when auto-edit has no click point', () => {
    const ref = { current: null }
    expect(takeEditorFocusIntent(ref)).toBeNull()
  })
})
