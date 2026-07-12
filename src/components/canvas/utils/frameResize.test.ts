import { describe, it, expect } from 'vitest'
import { computeResize } from './frameResize'

describe('computeResize', () => {
  const startW = 600
  const startH = 400

  it('enforces minimum width of 300', () => {
    const result = computeResize('w', 400, 0, startW, startH)
    expect(result.width).toBe(300)
  })

  it('enforces minimum height of 200', () => {
    const result = computeResize('n', 0, 300, startW, startH)
    expect(result.height).toBe(200)
  })

  it('expands east correctly', () => {
    const result = computeResize('e', 100, 0, startW, startH)
    expect(result.width).toBe(700)
    expect(result.height).toBe(400)
  })

  it('shrinks west correctly', () => {
    const result = computeResize('w', 100, 0, startW, startH)
    expect(result.width).toBe(500)
    expect(result.height).toBe(400)
  })

  it('expands south correctly', () => {
    const result = computeResize('s', 0, 50, startW, startH)
    expect(result.width).toBe(600)
    expect(result.height).toBe(450)
  })

  it('shrinks north correctly', () => {
    const result = computeResize('n', 0, 50, startW, startH)
    expect(result.width).toBe(600)
    expect(result.height).toBe(350)
  })

  it('handles diagonal resize (se)', () => {
    const result = computeResize('se', 100, -50, startW, startH)
    expect(result.width).toBe(700)
    expect(result.height).toBe(350)
  })

  it('handles diagonal resize (nw)', () => {
    const result = computeResize('nw', 50, 30, startW, startH)
    expect(result.width).toBe(550)
    expect(result.height).toBe(370)
  })

  it('does not change dimensions for zero delta', () => {
    const result = computeResize('ne', 0, 0, startW, startH)
    expect(result.width).toBe(startW)
    expect(result.height).toBe(startH)
  })

  it('clamps both axes simultaneously when both hit minimum', () => {
    const result = computeResize('nw', 400, 300, startW, startH)
    expect(result.width).toBe(300)
    expect(result.height).toBe(200)
  })
})
