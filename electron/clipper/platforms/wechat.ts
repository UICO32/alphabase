import { JSDOM } from 'jsdom'
import { log } from '../logger'
import type { ClipResult } from '../types'

export function extractWeChat(url: string, rawHtml: string): ClipResult {
  if (/captcha|TCaptcha|secitptpage|__DEBUGINFO/.test(rawHtml)) {
    throw Object.assign(
      new Error('微信公众号反爬验证拦截，请尝试在浏览器中打开文章后再剪藏'),
      { code: 'WECHAT_CAPTCHA' }
    )
  }

  const doc = new JSDOM(rawHtml, { url })
  const document = doc.window.document

  const titleEl = document.querySelector('#activity-name')
  const contentEl = document.querySelector('#js_content')
  const authorEl = document.querySelector('#js_name')

  if (!contentEl) {
    throw Object.assign(new Error('无法提取微信文章正文'), { code: 'NO_CONTENT' })
  }

  const clone = contentEl.cloneNode(true) as Element

  clone.querySelectorAll('*').forEach((el) => {
    el.removeAttribute('style')
    if (el.hasAttribute('class')) {
      const cls = el.getAttribute('class') || ''
      el.setAttribute('class', cls.replace(/wx_[\w-]*/g, '').trim())
    }
  })

  for (const img of clone.querySelectorAll('img')) {
    const src =
      img.getAttribute('data-src') ||
      img.getAttribute('data-original') ||
      img.getAttribute('data-url') ||
      img.getAttribute('src') ||
      ''
    if (src) img.setAttribute('src', src)
    img.removeAttribute('style')
    img.removeAttribute('width')
    img.removeAttribute('height')
  }

  const html = clone.innerHTML
  const title = titleEl?.textContent?.trim() || '微信公众号文章'
  const author = authorEl?.textContent?.trim() || ''

  const imageUrls = Array.from(clone.querySelectorAll('img'))
    .map((img) => img.getAttribute('src')?.trim())
    .filter((src): src is string => Boolean(src))

  log.info(`WeChat extracted: title="${title}", author="${author}", images=${imageUrls.length}`)

  return {
    title,
    html,
    markdown: '',
    sourceUrl: url,
    sourceName: author ? `微信公众号 · ${author}` : '微信公众号',
    images: [],
    imageUrls,
  }
}
