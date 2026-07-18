import { describe, expect, it } from 'vitest'
import {
  getCardSelectAllDecision,
  isCardSelectAllShortcut,
  resetCardSelectAllStage,
  type CardSelectAllStage,
} from './BlockNoteEditor'

describe('card editor Command/Ctrl+A selection state', () => {
  it.each([
    ['empty', ''],
    ['whitespace-only', ' \t '],
    ['line-break-only', '\n\r\n'],
  ])('selects the whole card on the first shortcut for a %s block', (_label, text) => {
    expect(getCardSelectAllDecision(text, 0)).toEqual({
      selection: 'card',
      nextStage: 0,
    })
  })

  it('keeps the two-stage model for a non-empty block', () => {
    const first = getCardSelectAllDecision('Visible text', 0)
    expect(first).toEqual({ selection: 'block', nextStage: 1 })

    expect(getCardSelectAllDecision('Visible text', first.nextStage as CardSelectAllStage)).toEqual({
      selection: 'card',
      nextStage: 0,
    })
  })

  it.each([
    ['Control', { key: 'a', ctrlKey: true, metaKey: false }],
    ['Command', { key: 'a', ctrlKey: false, metaKey: true }],
    ['uppercase Control', { key: 'A', ctrlKey: true, metaKey: false }],
  ])('recognizes the %s modifier variant', (_label, event) => {
    expect(isCardSelectAllShortcut(event)).toBe(true)
  })

  it.each([
    ['unrelated key', { key: 'x', ctrlKey: true, metaKey: false }],
    ['plain A', { key: 'a', ctrlKey: false, metaKey: false }],
  ])('rejects an %s so the staged selection can reset', (_label, event) => {
    expect(isCardSelectAllShortcut(event)).toBe(false)
  })

  it.each(['click', 'unrelated key'])('resets the staged selection after a %s', () => {
    const first = getCardSelectAllDecision('Visible text', 0)
    const resetStage = resetCardSelectAllStage(first.nextStage)

    expect(getCardSelectAllDecision('Visible text', resetStage)).toEqual({
      selection: 'block',
      nextStage: 1,
    })
  })
})
