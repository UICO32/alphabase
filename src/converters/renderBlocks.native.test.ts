import { describe, it, expect, vi } from 'vitest'
import { renderBlocksToHTML } from './renderBlocks'

/**
 * 验证 renderBlocksToHTML 对各类 BlockNote 块生成的原生 HTML：
 * - 输出含 bn-block-group / bn-block-outer / bn-block / bn-block-content / bn-inline-content 层次
 * - 不含内联 style（由原生 CSS 控制）
 * - 覆盖 heading / paragraph / bulletListItem / numberedListItem / checkListItem
 *   / quote / codeBlock / image / link / 嵌套 / 空数组 / 非数组
 */

function blocksJSON(blocks: object[]) {
  return JSON.stringify(blocks)
}

function heading(text: string, level = 1) {
  return { type: 'heading', props: { level }, content: [{ type: 'text', text }] }
}
function para(text: string) {
  return { type: 'paragraph', content: [{ type: 'text', text }] }
}
function bullet(text: string, children?: object[]) {
  const b: any = { type: 'bulletListItem', content: [{ type: 'text', text }] }
  if (children) b.children = children
  return b
}
function numbered(text: string, children?: object[]) {
  const b: any = { type: 'numberedListItem', content: [{ type: 'text', text }] }
  if (children) b.children = children
  return b
}
function checkItem(text: string, checked: boolean) {
  return { type: 'checkListItem', props: { checked }, content: [{ type: 'text', text }] }
}
function quote(text: string) {
  return { type: 'quote', content: [{ type: 'text', text }] }
}
function codeBlock(lang: string, text: string) {
  return { type: 'codeBlock', props: { language: lang }, content: [{ type: 'text', text }] }
}
function image(url: string) {
  return { type: 'image', props: { url } }
}
function link(text: string, href: string) {
  return { type: 'paragraph', content: [{ type: 'text', text, styles: {} }, { type: 'link', href, content: [{ type: 'text', text }] }] }
}

describe('renderBlocksToHTML — native 输出', () => {
  // ─── 基础块类型 ───

  it('heading h1', () => {
    const html = renderBlocksToHTML(blocksJSON([heading('Hello', 1)]))
    expect(html).toContain('data-content-type="heading"')
    expect(html).toContain('bn-block-content')
    expect(html).toContain('bn-inline-content')
    expect(html).toContain('Hello')
  })

  it('heading h2 / h3', () => {
    const html = renderBlocksToHTML(blocksJSON([heading('H2', 2), heading('H3', 3)]))
    expect(html).toMatch(/H2.*H3/)
    // 应有两个 heading
    const matches = html.match(/data-content-type="heading"/g)
    expect(matches?.length).toBe(2)
  })

  it('paragraph', () => {
    const html = renderBlocksToHTML(blocksJSON([para('一段文本')]))
    expect(html).toContain('data-content-type="paragraph"')
    expect(html).toContain('一段文本')
  })

  it('多段落', () => {
    const html = renderBlocksToHTML(blocksJSON([para('P1'), para('P2'), para('P3')]))
    expect(html).toMatch(/P1.*P2.*P3/)
    const matches = html.match(/data-content-type="paragraph"/g)
    expect(matches?.length).toBe(3)
  })

  // ─── 列表 ───

  it('bulletListItem', () => {
    const html = renderBlocksToHTML(blocksJSON([bullet('item1')]))
    expect(html).toContain('data-content-type="bulletListItem"')
    expect(html).toContain('item1')
  })

  it('bulletListItem 嵌套', () => {
    const html = renderBlocksToHTML(blocksJSON([
      bullet('parent', [bullet('child', [bullet('grandchild')])]),
    ]))
    expect(html).toContain('parent')
    expect(html).toContain('child')
    expect(html).toContain('grandchild')
    // 嵌套结构应出现 blockGroup
    expect(html).toContain('data-node-type="blockGroup"')
  })

  it('numberedListItem', () => {
    const html = renderBlocksToHTML(blocksJSON([numbered('1'), numbered('2'), numbered('3')]))
    expect(html).toContain('data-content-type="numberedListItem"')
    // 原生 serialization 用 data-index 而非手写序号
    expect(html).toContain('data-index="1"')
    expect(html).toContain('data-index="2"')
    expect(html).toContain('data-index="3"')
  })

  it('checkListItem unchecked', () => {
    const html = renderBlocksToHTML(blocksJSON([checkItem('todo', false)]))
    expect(html).toContain('data-content-type="checkListItem"')
    expect(html).toContain('todo')
  })

  it('checkListItem checked', () => {
    const html = renderBlocksToHTML(blocksJSON([checkItem('done', true)]))
    expect(html).toContain('data-content-type="checkListItem"')
    expect(html).toContain('done')
  })

  // ─── 特殊块类型 ───

  it('quote', () => {
    const html = renderBlocksToHTML(blocksJSON([quote('引用内容')]))
    expect(html).toContain('data-content-type="quote"')
    expect(html).toContain('引用内容')
  })

  it('codeBlock', () => {
    const html = renderBlocksToHTML(blocksJSON([codeBlock('typescript', 'const x = 1')]))
    expect(html).toContain('data-content-type="codeBlock"')
    expect(html).toContain('const x = 1')
  })

  it('image', () => {
    const html = renderBlocksToHTML(blocksJSON([image('https://example.com/pic.png')]))
    expect(html).toContain('data-content-type="image"')
    expect(html).toContain('example.com/pic.png')
  })

  // ─── 内联样式 ───

  it('link', () => {
    const html = renderBlocksToHTML(blocksJSON([link('click', 'https://example.com')]))
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('click')
  })

  it('bold + italic text (prosemirror 序列化)', () => {
    const content = JSON.stringify([
      { type: 'paragraph', content: [
        { type: 'text', text: 'Hello', styles: { bold: true, italic: true } },
      ]}])
    const html = renderBlocksToHTML(content)
    expect(html).toContain('Hello')
  })

  // ─── 边界条件 ───

  it('空字符串 → ""', () => {
    expect(renderBlocksToHTML('')).toBe('')
  })

  it('空数组 → ""', () => {
    expect(renderBlocksToHTML('[]')).toBe('')
  })

  it('非法 JSON — 走 legacy 回退', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const html = renderBlocksToHTML('not json at all')
    // legacy: escape & 回退到纯文本
    expect(typeof html).toBe('string')
    expect(html.length).toBeGreaterThan(0)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('原生 HTML 生成失败'),
      expect.any(SyntaxError),
    )
    warnSpy.mockRestore()
  })

  it('混合块类型', () => {
    const html = renderBlocksToHTML(blocksJSON([
      heading('标题', 1),
      para('正文段落'),
      bullet('要点', [bullet('子点')]),
      checkItem('待办', false),
    ]))
    const types = ['heading', 'paragraph', 'bulletListItem', 'checkListItem']
    for (const t of types) {
      expect(html).toContain(`data-content-type="${t}"`)
    }
  })
})
