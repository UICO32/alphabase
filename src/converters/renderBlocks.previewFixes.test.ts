import { describe, it, expect } from 'vitest'
import DOMPurify from 'dompurify'
import { renderBlocksToHTML } from './renderBlocks'

const EMPTY_TAG = JSON.stringify([
  { type: 'paragraph', props: { textAlignment: 'left' }, content: [
    { type: 'tag', props: { tagName: '工作' }, content: [] },
  ], children: [] },
])
const HEX_TEXTCOLOR = JSON.stringify([
  { type: 'paragraph', props: { textAlignment: 'left' }, content: [
    { type: 'text', text: 'hex色', styles: { textColor: '#ff5500', backgroundColor: '#112233' } },
    { type: 'text', text: ' 预设红', styles: { textColor: 'red' } },
  ], children: [] },
])
const CHECK = JSON.stringify([
  { type: 'checkListItem', props: { textAlignment: 'left', backgroundColor: 'default', checked: true }, content: [{ type: 'text', text: '待办', styles: {} }], children: [] },
])

describe('preview pipeline fixes', () => {
  it('空 content 的 tag 应兜底显示 tagName 文本', () => {
    const html = renderBlocksToHTML(EMPTY_TAG)
    console.log('=== EMPTY TAG FIXED ===')
    console.log(html)
    expect(html).toMatch(/data-tag-name="工作"[^>]*>工作<\/span>/)
  })

  it('非预设 textColor/backgroundColor 应转内联 style', () => {
    const html = renderBlocksToHTML(HEX_TEXTCOLOR)
    console.log('=== HEX TEXTCOLOR FIXED ===')
    console.log(html)
    expect(html).toMatch(/data-text-color="#ff5500"/)
    expect(html).toMatch(/color: rgb\(255, 85, 0\)|color:#ff5500|color: #ff5500/i)
    expect(html).toMatch(/background-color: rgb\(17, 34, 51\)|background-color:#112233|background-color: #112233/i)
    // 预设色保留 data 属性即可，不强制内联
    expect(html).toContain('data-text-color="red"')
  })

  it('sanitize 应保留 input type', () => {
    const raw = renderBlocksToHTML(CHECK)
    const out = DOMPurify.sanitize(raw, { ALLOWED_URI_REGEXP: /^(?:(?:hepta-media|https?|mailto|tel|data):|[^a-zA-Z]|[^a-zA-Z]javascript:)/i, ADD_URI_SAFE_ATTR: ['type'] })
    console.log('=== CHECKLIST SANITIZED (with type) ===')
    console.log(out)
    expect(out).toContain('<input type="checkbox"')
  })
})
