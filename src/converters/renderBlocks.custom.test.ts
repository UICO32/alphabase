import { describe, it, expect } from 'vitest'
import { renderBlocksToHTML } from './renderBlocks'

/**
 * 测试自定义 BlockNote 元素的原生 HTML 序列化：
 * - @卡片引用 (cardReference inline content)
 * - #标签 (tag inline content)
 * - 图片分列 (imageRow block)
 */

describe('renderBlocksToHTML — 自定义元素 (@ / # / imageRow)', () => {
  // ─── cardReference ───

  it('@卡片引用生成 [data-card-id]', () => {
    const blocks = [{
      type: 'paragraph',
      content: [
        { type: 'cardReference', props: { cardId: 'card-abc-123' }, content: [{ type: 'text', text: '' }] },
        { type: 'text', text: ' 剩余' },
      ],
    }]
    const html = renderBlocksToHTML(JSON.stringify(blocks))
    expect(html).toContain('data-card-id="card-abc-123"')
  })

  it('多个 @卡片引用', () => {
    const blocks = [{
      type: 'paragraph',
      content: [
        { type: 'cardReference', props: { cardId: 'card-1' }, content: [{ type: 'text', text: '' }] },
        { type: 'text', text: ' ' },
        { type: 'cardReference', props: { cardId: 'card-2' }, content: [{ type: 'text', text: '' }] },
      ],
    }]
    const html = renderBlocksToHTML(JSON.stringify(blocks))
    const match1 = html.match(/data-card-id="card-1"/g)
    const match2 = html.match(/data-card-id="card-2"/g)
    expect(match1?.length).toBe(1)
    expect(match2?.length).toBe(1)
  })

  // ─── tag ───

  it('#标签生成 [data-tag-name]', () => {
    const blocks = [{
      type: 'paragraph',
      content: [
        { type: 'text', text: '前置 ' },
        { type: 'tag', props: { tagName: '项目A' }, content: [{ type: 'text', text: '' }] },
      ],
    }]
    const html = renderBlocksToHTML(JSON.stringify(blocks))
    expect(html).toContain('data-tag-name="项目A"')
  })

  it('多个 #标签', () => {
    const blocks = [{
      type: 'paragraph',
      content: [
        { type: 'tag', props: { tagName: 'urgent' }, content: [{ type: 'text', text: '' }] },
        { type: 'text', text: ' ' },
        { type: 'tag', props: { tagName: 'design' }, content: [{ type: 'text', text: '' }] },
      ],
    }]
    const html = renderBlocksToHTML(JSON.stringify(blocks))
    expect(html).toContain('data-tag-name="urgent"')
    expect(html).toContain('data-tag-name="design"')
  })

  // ─── @ + # 混合 ───

  it('@卡片引用 + #标签同段', () => {
    const blocks = [{
      type: 'paragraph',
      content: [
        { type: 'cardReference', props: { cardId: 'ref-card' }, content: [{ type: 'text', text: '' }] },
        { type: 'text', text: ' and ' },
        { type: 'tag', props: { tagName: 'label' }, content: [{ type: 'text', text: '' }] },
      ],
    }]
    const html = renderBlocksToHTML(JSON.stringify(blocks))
    expect(html).toContain('data-card-id="ref-card"')
    expect(html).toContain('data-tag-name="label"')
  })

  // ─── imageRow ───

  it('imageRow 单图片', () => {
    const blocks = [{
      type: 'imageRow',
      props: {
        urlsJson: JSON.stringify(['https://example.com/a.jpg']),
        captionsJson: JSON.stringify(['caption A']),
        textAlignment: 'left',
        backgroundColor: 'default',
      },
      content: 'none',
    }]
    const html = renderBlocksToHTML(JSON.stringify(blocks))
    expect(html).toContain('data-content-type="imageRow"')
    // imageRow 用 react render 渲染，应该包含 img 或对应结构
    expect(html).toContain('example.com/a.jpg')
  })

  it('imageRow 多图片（分列）', () => {
    const blocks = [{
      type: 'imageRow',
      props: {
        urlsJson: JSON.stringify(['https://example.com/1.jpg', 'https://example.com/2.jpg']),
        captionsJson: JSON.stringify(['', '']),
        textAlignment: 'center',
        backgroundColor: 'default',
      },
      content: 'none',
    }]
    const html = renderBlocksToHTML(JSON.stringify(blocks))
    expect(html).toContain('data-content-type="imageRow"')
    expect(html).toContain('1.jpg')
    expect(html).toContain('2.jpg')
  })

  it('imageRow 空 urls — 不渲染图片', () => {
    const blocks = [{
      type: 'imageRow',
      props: {
        urlsJson: '[]',
        captionsJson: '[]',
        textAlignment: 'left',
        backgroundColor: 'default',
      },
      content: 'none',
    }]
    const html = renderBlocksToHTML(JSON.stringify(blocks))
    // 空图片列表应不崩溃
    expect(typeof html).toBe('string')
  })

  // ─── cardReference 在 heading 中 ───

  it('@卡片引用在 heading 中', () => {
    const blocks = [{
      type: 'heading',
      props: { level: 1 },
      content: [
        { type: 'cardReference', props: { cardId: 'hcard' }, content: [{ type: 'text', text: '' }] },
      ],
    }]
    const html = renderBlocksToHTML(JSON.stringify(blocks))
    expect(html).toContain('data-content-type="heading"')
    expect(html).toContain('data-card-id="hcard"')
  })

  // ─── 自定义元素样式属性 ───

  it('@卡片引用的 style 含 CSS 变量', () => {
    const blocks = [{
      type: 'paragraph',
      content: [
        { type: 'cardReference', props: { cardId: 'test-id' }, content: [{ type: 'text', text: '' }] },
      ],
    }]
    const html = renderBlocksToHTML(JSON.stringify(blocks))
    // 应该有 var(--card-ref-bg, ...) 或 var(--card-ref-color, ...)
    expect(html).toContain('--card-ref')
  })

  it('#标签的 style 含 CSS 变量', () => {
    const blocks = [{
      type: 'paragraph',
      content: [
        { type: 'tag', props: { tagName: 'mytag' }, content: [{ type: 'text', text: '' }] },
      ],
    }]
    const html = renderBlocksToHTML(JSON.stringify(blocks))
    expect(html).toContain('--tag')
  })
})
