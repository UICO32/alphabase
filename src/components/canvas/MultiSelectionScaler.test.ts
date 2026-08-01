import { describe, expect, it } from 'vitest'
import { computeMultiScale, MIN_SCALE, type MultiScaleNode } from './MultiSelectionScaler'

const nodes: MultiScaleNode[] = [
  { id: 'a', x: 100, y: 100, w: 200, h: 150 },
  { id: 'b', x: 400, y: 300, w: 100, h: 100 },
]

describe('computeMultiScale', () => {
  it('缩放比例 = 拖动距离 / 初始对角线，所有节点等比变化', () => {
    // 包围盒：(100,100)-(500,400)，pad 后 startW/startH
    const startW = 400 + 12
    const startH = 300 + 12
    const anchorX = 100 - 6 // se 角的锚点 = 左上角
    const anchorY = 100 - 6
    // 拖动到对角 2 倍距离 → scale ≈ 2
    const mouseX = 500 + 6 + startW
    const mouseY = 400 + 6 + startH
    const result = computeMultiScale(nodes, anchorX, anchorY, startW, startH, mouseX, mouseY)
    const scale = Math.hypot(startW, startH) * 2 / Math.hypot(startW, startH)
    expect(result[0].w).toBeCloseTo(200 * scale)
    expect(result[0].h).toBeCloseTo(150 * scale)
    expect(result[1].w).toBeCloseTo(100 * scale)
    // 锚点（左上角）不动：节点 a 的左上角保持
    expect(result[0].x).toBeCloseTo(anchorX + (100 - anchorX) * scale)
    expect(result[0].y).toBeCloseTo(anchorY + (100 - anchorY) * scale)
    // 等比：所有节点宽高比例一致
    const r0 = result[0].w / result[0].h
    const r1 = result[1].w / result[1].h
    expect(r0).toBeCloseTo(nodes[0].w / nodes[0].h)
    expect(r1).toBeCloseTo(nodes[1].w / nodes[1].h)
  })

  it('缩小时不低于 MIN_SCALE', () => {
    const result = computeMultiScale(nodes, 0, 0, 400, 300, 1, 1)
    const scale = Math.hypot(1, 1) / 500
    expect(scale).toBeLessThan(MIN_SCALE)
    expect(result[0].w).toBeCloseTo(200 * MIN_SCALE)
    expect(result[1].h).toBeCloseTo(100 * MIN_SCALE)
  })

  it('不拖动时（鼠标在锚点）scale = MIN_SCALE 下限', () => {
    const result = computeMultiScale(nodes, 10, 10, 400, 300, 10, 10)
    expect(result[0].w).toBeCloseTo(200 * MIN_SCALE)
  })

  it('拖动距离等于对角线时 scale = 1（尺寸不变）', () => {
    const startW = 400
    const startH = 300
    const anchorX = 100
    const anchorY = 100
    const result = computeMultiScale(nodes, anchorX, anchorY, startW, startH, anchorX + startW, anchorY + startH)
    expect(result[0].w).toBeCloseTo(200)
    expect(result[0].h).toBeCloseTo(150)
    expect(result[0].x).toBeCloseTo(100)
    expect(result[0].y).toBeCloseTo(100)
  })
})
