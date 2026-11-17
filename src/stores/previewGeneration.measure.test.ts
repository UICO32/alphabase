// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { renderBlocksToHTML } from '../converters/renderBlocks'

// C-4 测量：预览 HTML 生成的单卡耗时，用于判断批次大小（BATCH_SIZE=4）是否合适。
// 结论写进 docs/26-10-25修复计划.md；这里只做基线测量 + 很宽松的上限断言，避免 CI 抖动。
const SAMPLE_COUNT = 120

function plainCard(index: number): string {
  return JSON.stringify([
    { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: `标题 ${index}`, styles: {} }], children: [] },
    ...Array.from({ length: 6 }, (_, paragraphIndex) => ({
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text: `第 ${index} 张卡片第 ${paragraphIndex} 段内容，用于模拟真实卡片文本长度。`, styles: {} }],
      children: [],
    })),
  ])
}

function longCard(index: number): string {
  return JSON.stringify(Array.from({ length: 30 }, (_, paragraphIndex) => ({
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: `长文卡片 ${index} 段落 ${paragraphIndex}：${'内容'.repeat(40)}`, styles: {} }],
    children: [],
  })))
}

function measure(makeContent: (index: number) => string): { perCardMs: number; totalMs: number } {
  const samples = Array.from({ length: SAMPLE_COUNT }, (_, index) => makeContent(index))
  for (const sample of samples.slice(0, 20)) renderBlocksToHTML(sample)
  const startedAt = performance.now()
  for (const sample of samples) renderBlocksToHTML(sample)
  const totalMs = performance.now() - startedAt
  return { perCardMs: totalMs / samples.length, totalMs }
}

describe('C-4 预览生成耗时测量', () => {
  it('记录不同内容规模下单卡预览生成耗时', () => {
    const plain = measure(plainCard)
    const long = measure(longCard)

    const report = {
      scenario: 'renderBlocksToHTML',
      sampleCount: SAMPLE_COUNT,
      plainPerCardMs: Number(plain.perCardMs.toFixed(3)),
      longPerCardMs: Number(long.perCardMs.toFixed(3)),
      // 当前批次大小 4：一批的估算耗时。
      plainBatch4Ms: Number((plain.perCardMs * 4).toFixed(2)),
      longBatch4Ms: Number((long.perCardMs * 4).toFixed(2)),
    }
    console.log(JSON.stringify(report))

    expect(plain.perCardMs).toBeGreaterThan(0)
    expect(long.perCardMs).toBeGreaterThan(0)
    // 很宽松的兜底：单卡生成超过 50ms 说明渲染路径退化，需要重新评估批次。
    expect(plain.perCardMs).toBeLessThan(50)
    expect(long.perCardMs).toBeLessThan(50)
  })
})
