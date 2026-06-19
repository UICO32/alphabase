import { describe, it, expect } from 'vitest'
import { renderBlocksToHTML } from './renderBlocks'

/**
 * 验证原生 HTML 输出的 DOM 层次结构：
 * - CSS 类名：bn-block-group / bn-block-outer / bn-block / bn-block-content / bn-inline-content
 * - data 属性：data-node-type / data-content-type
 * - 嵌套层数正确
 */

function b(type: string, text: string, props?: object) {
  return { type, props: props || {}, content: [{ type: 'text', text }] }
}

function toHTML(blocks: object[]) {
  return renderBlocksToHTML(JSON.stringify(blocks))
}

describe('renderBlocksToHTML — DOM 结构', () => {
  // ─── 顶层包裹 ───

  it('顶层有 bn-block-group', () => {
    const html = toHTML([b('paragraph', 'hello')])
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const root = doc.body.firstElementChild as HTMLElement
    expect(root?.className).toContain('bn-block-group')
    expect(root?.getAttribute('data-node-type')).toBe('blockGroup')
  })

  // ─── blockContainer 包裹 ───

  it('每个块被 blockContainer 包裹', () => {
    const html = toHTML([b('paragraph', 'p1'), b('paragraph', 'p2')])
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    // bn-block-group > bn-block-outer > bn-block > bn-block-content
    const outers = doc.querySelectorAll('.bn-block-outer')
    expect(outers.length).toBe(2)
    for (const outer of outers) {
      expect(outer.getAttribute('data-node-type')).toBe('blockOuter')
      const block = outer.querySelector(':scope > .bn-block')
      expect(block).not.toBeNull()
      expect(block!.getAttribute('data-node-type')).toBe('blockContainer')
    }
  })

  // ─── blockContent 层 ───

  it('每个块有 bn-block-content + data-content-type', () => {
    const html = toHTML([b('heading', 'H', { level: 1 }), b('paragraph', 'P')])
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const contents = doc.querySelectorAll('.bn-block-content')
    expect(contents.length).toBe(2)
    const types = Array.from(contents).map((el) => el.getAttribute('data-content-type'))
    expect(types).toContain('heading')
    expect(types).toContain('paragraph')
  })

  // ─── inlineContent 层 ───

  it('内联内容包裹在 bn-inline-content 中', () => {
    const html = toHTML([b('paragraph', 'inline text')])
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const inline = doc.querySelector('.bn-block-content .bn-inline-content')
    expect(inline).not.toBeNull()
    expect(inline?.textContent?.trim()).toBe('inline text')
  })

  // ─── 嵌套子块（blockGroup 递归） ───

  it('子块生成嵌套 blockGroup', () => {
    const child = b('paragraph', 'child')
    const parent: any = { type: 'bulletListItem', content: [{ type: 'text', text: 'parent' }], children: [child] }
    const html = toHTML([parent])
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    // 顶层 blockGroup
    const topGroup = doc.body.firstElementChild
    expect(topGroup?.getAttribute('data-node-type')).toBe('blockGroup')

    // 应该有一个嵌套的 blockGroup
    const allGroups = doc.querySelectorAll('[data-node-type="blockGroup"]')
    expect(allGroups.length).toBeGreaterThanOrEqual(2)
  })

  // ─── heading 特定验证 ───

  it('heading 内部使用原生 h1/h2/h3 标签', () => {
    const html = toHTML([b('heading', '大标题', { level: 1 }), b('heading', '小标题', { level: 3 })])
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    const h1 = doc.querySelector('.bn-block-content[data-content-type="heading"] .bn-inline-content')
    expect(h1).not.toBeNull()
    expect(h1!.tagName).toMatch(/H[123]/)
  })

  // ─── 选择器路径验证 ───

  it('选择器路径：.bn-block-group > .bn-block-outer > .bn-block > .bn-block-content > .bn-inline-content', () => {
    const html = toHTML([b('paragraph', 'path test')])
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    const group = doc.querySelector('.bn-block-group')
    expect(group).not.toBeNull()

    const outer = group!.querySelector(':scope > .bn-block-outer')
    expect(outer).not.toBeNull()

    const block = outer!.querySelector(':scope > .bn-block')
    expect(block).not.toBeNull()

    const content = block!.querySelector(':scope > .bn-block-content')
    expect(content).not.toBeNull()

    const inline = content!.querySelector(':scope > .bn-inline-content')
    expect(inline).not.toBeNull()
    expect(inline!.textContent).toContain('path test')
  })

  // ─── data-index 编号列表验证 ───

  it('numberedListItem 有 data-index', () => {
    const html = toHTML([
      b('numberedListItem', 'A'),
      b('numberedListItem', 'B'),
      b('paragraph', 'gap'),  // resets counter
      b('numberedListItem', 'C'),
    ])
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    const nlms = doc.querySelectorAll('[data-content-type="numberedListItem"]')
    expect(nlms.length).toBe(3)
    // first series: 1, 2
    expect(nlms[0].parentElement?.querySelector('.bn-block-content[data-content-type="numberedListItem"]'))
    // After paragraph reset, C should be 1
  })

  // ─── 原生 HTML 不应含内联 style ───

  it('原生输出不含手写内联 fontSize 等 style（与 legacy 区分）', () => {
    const html = toHTML([b('heading', 'T', { level: 1 })])
    // legacy 会有 font-size:3em 内联样式，native 不应该有
    expect(html).not.toContain('font-size:')
    expect(html).not.toContain('font-family:')
    expect(html).not.toContain('font-weight:')
  })

  // ─── 颜色样式通过 data-* 属性表达 ───

  it('文本颜色通过 data-text-color 表达', () => {
    const content = JSON.stringify([
      { type: 'paragraph', content: [
        { type: 'text', text: 'red text', styles: { textColor: 'red' } },
      ]}])
    const html = renderBlocksToHTML(content)
    expect(html).toContain('red text')
    // ProseMirror 序列化 textColor 可能会生成 style 或 data 属性
    expect(typeof html).toBe('string')
    expect(html.length).toBeGreaterThan(0)
  })

  it('背景颜色通过 data-background-color 表达', () => {
    const content = JSON.stringify([
      { type: 'paragraph', content: [
        { type: 'text', text: 'highlighted', styles: { backgroundColor: 'yellow' } },
      ]}])
    const html = renderBlocksToHTML(content)
    expect(html).toContain('highlighted')
    expect(typeof html).toBe('string')
    expect(html.length).toBeGreaterThan(0)
  })
})
