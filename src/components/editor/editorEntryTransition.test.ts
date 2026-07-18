import { describe, expect, it } from 'vitest'
import {
  createEditorEntryState,
  editorEntryReducer,
  shouldRevealEditorImmediately,
} from './editorEntryTransition'

describe('editorEntryReducer', () => {
  it('moves the current entry from mounting to ready to interactive', () => {
    const initial = createEditorEntryState('card-a')
    const ready = editorEntryReducer(initial, { type: 'ready', entryKey: 'card-a' })
    const interactive = editorEntryReducer(ready, { type: 'interactive', entryKey: 'card-a' })

    expect(ready.phase).toBe('ready')
    expect(interactive.phase).toBe('interactive')
  })

  it('ignores readiness from a stale card', () => {
    const current = createEditorEntryState('card-b')
    expect(editorEntryReducer(current, { type: 'ready', entryKey: 'card-a' })).toBe(current)
    expect(editorEntryReducer(current, { type: 'interactive', entryKey: 'card-a' })).toBe(current)
  })

  it('resets when the entry key changes', () => {
    const interactive = { entryKey: 'card-a', phase: 'interactive' as const }
    expect(editorEntryReducer(interactive, { type: 'reset', entryKey: 'card-b' })).toEqual({
      entryKey: 'card-b',
      phase: 'mounting',
    })
  })

  it('reveals immediately only for reduced motion', () => {
    expect(shouldRevealEditorImmediately(true)).toBe(true)
    expect(shouldRevealEditorImmediately(false)).toBe(false)
  })
})
