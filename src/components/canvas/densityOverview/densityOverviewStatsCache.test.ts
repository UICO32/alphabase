import { describe, expect, it } from 'vitest'
import {
  buildDensityOverviewModel,
  clearDensityStatsCache,
  extractCardDensityStatsCached,
  getDensityStatsCacheCounters,
} from './densityOverviewModel'
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

describe('密度统计内容缓存', () => {
  it('内容/标题/标签相同则复用统计结果', () => {
    clearDensityStatsCache()
    const card = makeCard(1)

    const first = extractCardDensityStatsCached(card)
    const second = extractCardDensityStatsCached({ ...card })

    expect(second).toEqual(first)
    // 命中缓存：未命中计数仍为 1。
    expect(getDensityStatsCacheCounters()).toMatchObject({ hits: 1, misses: 1 })
  })

  it('内容变化会生成新的缓存条目', () => {
    clearDensityStatsCache()
    const card = makeCard(1)

    extractCardDensityStatsCached(card)
    extractCardDensityStatsCached({ ...card, content: '[{"type":"paragraph","content":[]}]' })

    expect(getDensityStatsCacheCounters().misses).toBe(2)
  })

  it('节点位置变化重建模型时不重算内容统计', () => {
    clearDensityStatsCache()
    const cards = Array.from({ length: 50 }, (_, index) => makeSourceCard(index, index * 10, index * 10))
    const edges: DensitySourceEdge[] = []

    buildDensityOverviewModel(cards, edges, null)
    const afterFirstBuild = getDensityStatsCacheCounters()
    expect(afterFirstBuild.misses).toBe(50)

    // 只移动位置：内容签名不变，第二次建模应全部命中缓存。
    const movedCards = cards.map((card) => ({ ...card, x: card.x + 40, y: card.y + 25 }))
    const model = buildDensityOverviewModel(movedCards, edges, null)
    const afterSecondBuild = getDensityStatsCacheCounters()
    // 计数是累计的：第二次建模不新增未命中，全部算命中。
    expect(afterSecondBuild.misses).toBe(afterFirstBuild.misses)
    expect(afterSecondBuild.hits).toBe(afterFirstBuild.hits + 50)
    // 位置变化仍然生效。
    expect(model.cards[1].center).toEqual({ x: 10 + 40 + 260 / 2, y: 10 + 25 + 200 / 2 })
  })

  it('边度数独立计算，不受内容缓存影响', () => {
    clearDensityStatsCache()
    const cards = [makeSourceCard(0, 0, 0), makeSourceCard(1, 400, 0)]
    const edges: DensitySourceEdge[] = [{ source: 'node-0', target: 'node-1' }]

    const model = buildDensityOverviewModel(cards, edges, null)

    expect(model.cards.find(card => card.nodeId === 'node-0')?.edgeDegree).toBe(1)
    expect(model.cards.find(card => card.nodeId === 'node-1')?.edgeDegree).toBe(1)
  })
})
