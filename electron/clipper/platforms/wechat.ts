import { parseHTML } from 'linkedom'
import { log } from '../logger'
import type { ClipResult } from '../types'

export function extractWeChat(url: string, rawHtml: string): ClipResult {
  if (/captcha|TCaptcha|secitptpage|__DEBUGINFO/.test(rawHtml)) {
    throw Object.assign(
      new Error('微信公众号反爬验证拦截，请尝试在浏览器中打开文章后再剪藏'),
      { code: 'WECHAT_CAPTCHA' }
    )
  }

  const { document } = parseHTML(rawHtml)

  const titleEl = document.querySelector('#activity-name')
  const contentEl = document.querySelector('#js_content')
  const authorEl = document.querySelector('#js_name')

  if (!contentEl) {
    throw Object.assign(new Error('无法提取微信文章正文'), { code: 'NO_CONTENT' })
  }

  const clone = contentEl.cloneNode(true) as Element

  // 保留文本格式（font-weight:bold → <strong>, font-style:italic → <em>）
  clone.querySelectorAll('span[style], section[style]').forEach((el) => {
    const style = el.getAttribute('style') || ''
    const lower = style.toLowerCase()
    if (lower.includes('font-weight') && /font-weight\s*:\s*(bold|[6-9]00)/i.test(lower)) {
      const strong = document.createElement('strong')
      while (el.firstChild) strong.appendChild(el.firstChild)
      el.parentNode?.replaceChild(strong, el)
      strong.removeAttribute('style')
      return
    }
    if (lower.includes('font-style') && /font-style\s*:\s*italic/i.test(lower)) {
      const em = document.createElement('em')
      while (el.firstChild) em.appendChild(el.firstChild)
      el.parentNode?.replaceChild(em, el)
      em.removeAttribute('style')
      return
    }
    el.removeAttribute('style')
  })

  // 清理微信特有 class，移除其他元素的 style
  clone.querySelectorAll('*').forEach((el) => {
    el.removeAttribute('style')
    if (el.hasAttribute('class')) {
      const cls = el.getAttribute('class') || ''
      el.setAttribute('class', cls.replace(/wx_[\w-]*/g, '').trim())
    }
  })

  // 处理图片：data-src → src
  for (const img of clone.querySelectorAll('img')) {
    const src =
      img.getAttribute('data-src') ||
      img.getAttribute('data-original') ||
      img.getAttribute('data-url') ||
      img.getAttribute('src') ||
      ''
    if (src) img.setAttribute('src', src)
    img.removeAttribute('data-src')
    img.removeAttribute('data-original')
    img.removeAttribute('data-url')
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

  log.info(`WeChat extracted: title="${title}", author="${author}", images=${imageUrls.length}, html=${html.length} chars`)

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