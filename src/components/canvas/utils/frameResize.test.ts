import { describe, it, expect } from 'vitest'
import { computeResize } from './frameResize'

describe('computeResize', () => {
  const startW = 600
  const startH = 400

  it('enforces minimum width of 300 and keeps the east edge fixed', () => {
    const result = computeResize('w', 400, 0, startW, startH)
    expect(result.width).toBe(300)
    expect(result.offsetX).toBe(300)
  })

  it('enforces minimum height of 200 and keeps the south edge fixed', () => {
    const result = computeResize('n', 0, 300, startW, startH)
    expect(result.height).toBe(200)
    expect(result.offsetY).toBe(200)
  })

  it('expands east without moving the origin', () => {
    const result = computeResize('e', 100, 0, startW, startH)
    expect(result).toMatchObject({ width: 700, height: 400, offsetX: 0, offsetY: 0 })
  })

  it('shrinks west and moves the origin right', () => {
    const result = computeResize('w', 100, 0, startW, startH)
    expect(result).toMatchObject({ width: 500, offsetX: 100, offsetY: 0 })
  })

  it('expands west and moves the origin left', () => {
    const result = computeResize('w', -100, 0, startW, startH)
    expect(result).toMatchObject({ width: 700, offsetX: -100 })
  })

  it('expands south without moving the origin', () => {
    const result = computeResize('s', 0, 50, startW, startH)
    expect(result).toMatchObject({ width: 600, height: 450, offsetX: 0, offsetY: 0 })
  })

  it('shrinks north and moves the origin down', () => {
    const result = computeResize('n', 0, 50, startW, startH)
    expect(result).toMatchObject({ height: 350, offsetY: 50 })
  })

  it('expands north and moves the origin up', () => {
    const result = computeResize('n', 0, -50, startW, startH)
    expect(result).toMatchObject({ height: 450, offsetY: -50 })
  })

  it('handles diagonal resize (se) without moving the origin', () => {
    const result = computeResize('se', 100, -50, startW, startH)
    expect(result).toMatchObject({ width: 700, height: 350, offsetX: 0, offsetY: 0 })
  })

  it('handles diagonal resize (nw) moving both axes', () => {
    const result = computeResize('nw', 50, 30, startW, startH)
    expect(result).toMatchObject({ width: 550, height: 370, offsetX: 50, offsetY: 30 })
  })

  it('does not change dimensions or position for zero delta', () => {
    const result = computeResize('ne', 0, 0, startW, startH)
    expect(result).toMatchObject({ width: startW, height: startH, offsetX: 0, offsetY: 0 })
  })

  it('clamps both axes simultaneously when both hit minimum', () => {
    const result = computeResize('nw', 400, 300, startW, startH)
    expect(result).toMatchObject({ width: 300, height: 200, offsetX: 300, offsetY: 200 })
  })

  it('keeps the origin still when the size is already at the minimum', () => {
    const result = computeResize('w', 100, 0, 300, 200)
    expect(result).toMatchObject({ width: 300, offsetX: 0 })

    const northResult = computeResize('n', 0, 100, 300, 200)
    expect(northResult).toMatchObject({ height: 200, offsetY: 0 })
  })
})
