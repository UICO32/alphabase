import { describe, expect, it } from 'vitest'
import { isDiskAhead, recommendedConflictChoice } from './conflict'

const base = { expectedCards: 10, actualCards: 10, expectedBoards: 2, actualBoards: 2 }

describe('workspace conflict guidance', () => {
  it('treats more disk files than metadata as the disk being ahead', () => {
    expect(isDiskAhead({ ...base, actualCards: 11 })).toBe(true)
    expect(isDiskAhead({ ...base, actualBoards: 3 })).toBe(true)
    expect(isDiskAhead({ ...base, actualCards: 9 })).toBe(false)
    expect(isDiskAhead(base)).toBe(false)
  })

  it('recommends continuing on disk data when the disk holds newer files', () => {
    expect(recommendedConflictChoice({ ...base, actualCards: 12 }, true)).toBe('continue')
  })

  it('recommends restoring a backup only when disk files are missing', () => {
    expect(recommendedConflictChoice({ ...base, actualCards: 3 }, true)).toBe('backup')
  })

  it('never recommends a backup when none exists', () => {
    expect(recommendedConflictChoice({ ...base, actualCards: 3 }, false)).toBe('continue')
  })
})
