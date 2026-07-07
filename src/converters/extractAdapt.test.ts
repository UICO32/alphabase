import { describe, it, expect } from 'vitest'
import {
  extractTitleFromJSON,
  extractTitleFromHTML,
  extractFirstTextFromHTML,
  extractPreviewTextFromHTML,
  extractImagesFromHTML,
} from '../components/canvas/utils/cardPreview'

/**
 * 验证文本提取组件适配 native HTML 结构：
 * - native 结构: [data-content-type="heading"] .bn-inline-content
 * - legacy 回退: h1, h2, h3
 */

function nativeHeadingHTML(text: string, level = 1) {
  return `<div class="bn-block-group" data-node-type="blockGroup">
  <div class="bn-block-outer" data-node-type="blockOuter">
    <div class="bn-block" data-node-type="blockContainer">
      <div class="bn-block-content" data-content-type="heading">
        <h${level} class="bn-inline-content">${text}</h${level}>
      </div>
    </div>
  </div>
</div>`
}

function nativeParaHTML(text: string) {
  return `<div class="bn-block-group" data-node-type="blockGroup">
  <div class="bn-block-outer" data-node-type="blockOuter">
    <div class="bn-block" data-node-type="blockContainer">
      <div class="bn-block-content" data-content-type="paragraph">
        <p class="bn-inline-content">${text}</p>
      </div>
    </div>
  </div>
</div>`
}

describe('extractTitleFromJSON', () => {
  it('heading type', () => {
    expect(extractTitleFromJSON(JSON.stringify([
      { type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'My Title' }] },
    ]))).toBe('My Title')
  })

  it('优先第一个 heading', () => {
    expect(extractTitleFromJSON(JSON.stringify([
      { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: 'First' }] },
      { type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'Second' }] },
    ]))).toBe('First')
  })

  it('无 heading → ""', () => {
    expect(extractTitleFromJSON(JSON.stringify([
      { type: 'paragraph', content: [{ type: 'text', text: 'no heading' }] },
    ]))).toBe('')
  })

  it('空数组 → ""', () => {
    expect(extractTitleFromJSON('[]')).toBe('')
  })

  it('非法 JSON → ""', () => {
    expect(extractTitleFromJSON('bad json')).toBe('')
  })
})

describe('extractTitleFromHTML — native 结构', () => {
  it('native heading -> 提取标题', () => {
    expect(extractTitleFromHTML(nativeHeadingHTML('大标题', 1))).toBe('大标题')
  })

  it('native heading h3', () => {
    expect(extractTitleFromHTML(nativeHeadingHTML('小标题', 3))).toBe('小标题')
  })

  it('native 无 heading → ""', () => {
    expect(extractTitleFromHTML(nativeParaHTML('just text'))).toBe('')
  })

  it('native heading + para 混合 → 提取第一个 heading', () => {
    const html = nativeHeadingHTML('H1 Title', 1) + nativeParaHTML('body text')
    expect(extractTitleFromHTML(html)).toBe('H1 Title')
  })
})

describe('extractTitleFromHTML — legacy 回退', () => {
  it('legacy h1/h2/h3 → 提取标题', () => {
    expect(extractTitleFromHTML('<h1>Legacy Title</h1><p>body</p>')).toBe('Legacy Title')
  })

  it('legacy h2 → 提取标题', () => {
    expect(extractTitleFromHTML('<h2>H2 Title</h2>')).toBe('H2 Title')
  })

  it('legacy h3 → 提取标题', () => {
    expect(extractTitleFromHTML('<h3>H3 Title</h3>')).toBe('H3 Title')
  })

  it('legacy 无 heading → ""', () => {
    expect(extractTitleFromHTML('<p>no heading here</p>')).toBe('')
  })
})

describe('extractFirstTextFromHTML — native 结构', () => {
  it('跳过 heading，返回第一个非 heading 文本', () => {
    const html = nativeHeadingHTML('标题', 1) + nativeParaHTML('第一段文本')
    expect(extractFirstTextFromHTML(html)).toBe('第一段文本')
  })

  it('全是 heading → ""', () => {
    const html = nativeHeadingHTML('H1', 1) + nativeHeadingHTML('H2', 2)
    expect(extractFirstTextFromHTML(html)).toBe('')
  })

  it('只有 paragraph', () => {
    expect(extractFirstTextFromHTML(nativeParaHTML('only text'))).toBe('only text')
  })
})

describe('extractFirstTextFromHTML — legacy 回退', () => {
  it('legacy 跳过 h1，返回 p', () => {
    expect(extractFirstTextFromHTML('<h1>Skip</h1><p>First text</p>')).toBe('First text')
  })

  it('legacy 无内容 → ""', () => {
    expect(extractFirstTextFromHTML('<h1>Only heading</h1>')).toBe('')
  })
})

describe('extractPreviewTextFromHTML', () => {
  it('合并多个正文块用于缩放预览', () => {
    const html = nativeParaHTML('第一段文本') + nativeParaHTML('第二段文本')
    expect(extractPreviewTextFromHTML(html)).toBe('第一段文本 第二段文本')
  })

  it('跳过 heading 并截断长正文', () => {
    const html = nativeHeadingHTML('标题', 1) + nativeParaHTML('abcdefghijklmnopqrstuvwxyz')
    expect(extractPreviewTextFromHTML(html, 10)).toBe('abcdefghi…')
  })
})

describe('extractImagesFromHTML', () => {
  it('native image 中的 img', () => {
    const html = `<div class="bn-block-group" data-node-type="blockGroup">
      <div class="bn-block-outer"><div class="bn-block">
        <div class="bn-block-content" data-content-type="image">
          <div class="bn-inline-content">
            <img src="https://img.example.com/a.png" />
          </div>
        </div>
      </div></div>
    </div>`
    const result = extractImagesFromHTML(html)
    expect(result).toContain('https://img.example.com/a.png')
  })

  it('多张图片', () => {
    const html = `<div>
      <img src="https://a.com/1.jpg" />
      <img src="https://a.com/2.jpg" />
    </div>`
    const result = extractImagesFromHTML(html)
    expect(result).toEqual(['https://a.com/1.jpg', 'https://a.com/2.jpg'])
  })

  it('无图片 → []', () => {
    expect(extractImagesFromHTML('<p>text only</p>')).toEqual([])
  })

  it('非法 HTML → []', () => {
    // DOMParser 容错，不会抛异常
    expect(extractImagesFromHTML('')).toEqual([])
  })
})
