import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildDensityOverviewModel } from './densityOverviewModel'
import type { DensitySourceCard, DensitySourceEdge } from './densityOverviewModel'
import type { GlobalCard } from '../../../stores/cardStore'

function makeCard(index: number, content = `[{"type":"paragraph","content":[{"type":"text","text":"卡片 ${index} 内容"}]}]`): GlobalCard {
  return {
    id: `card-${index}`,
    title: `卡片 ${index}`,
    color: 'white',
    createdAt: index,
    content,
    tags: [`tag-${index % 3}`],
  }
}

function makeSourceCard(index: number, x: number, y: number, card = makeCard(index)): DensitySourceCard {
  return {
    nodeId: `node-${index}`,
    cardId: card.id,
    x,
    y,
    width: 260,
    height: 200,
    card,
  }
}

// 内容统计要 JSON.parse 卡片内容：用调用次数代表“是否重算”。
let parseCount: () => number

beforeEach(() => {
  const spy = vi.spyOn(JSON, 'parse')
  parseCount = () => spy.mock.calls.length
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('密度统计按卡片对象缓存', () => {
  it('节点位置变化重建模型时不重算内容统计', () => {
    const cards = Array.from({ length: 50 }, (_, index) => makeSourceCard(index, index * 10, index * 10))
    const edges: DensitySourceEdge[] = []

    buildDensityOverviewModel(cards, edges, null)
    const parsesAfterFirstBuild = parseCount()
    expect(parsesAfterFirstBuild).toBe(50)

    // 只移动位置：卡片对象引用不变，第二次建模应全部命中缓存。
    const movedCards = cards.map((card) => ({ ...card, x: card.x + 40, y: card.y + 25 }))
    const model = buildDensityOverviewModel(movedCards, edges, null)
    expect(parseCount()).toBe(parsesAfterFirstBuild)
    // 位置变化仍然生效。
    expect(model.cards[1].center).toEqual({ x: 10 + 40 + 260 / 2, y: 10 + 25 + 200 / 2 })
  })

  it('内容变化（卡片对象被替换）时重算统计', () => {
    const card = makeCard(1)
    const source = makeSourceCard(1, 0, 0, card)

    buildDensityOverviewModel([source], [], null)
    buildDensityOverviewModel(
      [{ ...source, card: { ...card, content: '[{"type":"paragraph","content":[]}]' } }],
      [],
      null,
    )

    expect(parseCount()).toBe(2)
  })

  it('边度数独立计算，不受内容缓存影响', () => {
    const cards = [makeSourceCard(0, 0, 0), makeSourceCard(1, 400, 0)]
    const edges: DensitySourceEdge[] = [{ source: 'node-0', target: 'node-1' }]

    const model = buildDensityOverviewModel(cards, edges, null)

    expect(model.cards.find(card => card.nodeId === 'node-0')?.edgeDegree).toBe(1)
    expect(model.cards.find(card => card.nodeId === 'node-1')?.edgeDegree).toBe(1)
  })
})
