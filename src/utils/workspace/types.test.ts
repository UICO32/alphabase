import { describe, expect, it } from 'vitest'
import { DEFAULT_BOARD_VIEWPORT, getPersistedBoardViewport } from './types'

describe('board viewport persistence', () => {
  it('treats the legacy fixed viewport as an unvisited board', () => {
    expect(getPersistedBoardViewport(DEFAULT_BOARD_VIEWPORT)).toBeUndefined()
  })

  it('keeps a valid user viewport', () => {
    expect(getPersistedBoardViewport({ x: -320, y: 180, zoom: 1.25 })).toEqual({
      x: -320,
      y: 180,
      zoom: 1.25,
    })
  })

  it('rejects invalid viewport values', () => {
    expect(getPersistedBoardViewport({ x: 0, y: 0, zoom: 0 })).toBeUndefined()
    expect(getPersistedBoardViewport({ x: Number.NaN, y: 0, zoom: 1 })).toBeUndefined()
  })
})
