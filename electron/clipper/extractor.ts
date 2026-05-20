import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import { turndown } from './turndown'
import { log } from './logger'
import type { ClipResult, Platform } from './types'

export function detectPlatform(url: string): Platform {
  const hostname = new URL(url).hostname
  if (hostname.includes('xiaohongshu.com') || hostname.includes('xhslink.com')) return 'xiaohongshu'
  if (hostname.includes('mp.weixin.qq.com')) return 'wechat'
  return 'generic'
}

export function extractContent(url: string, rawHtml: string): ClipResult {
  const { document } = parseHTML(rawHtml)

  for (const el of document.querySelectorAll(
    'script, style, nav, footer, iframe, .ad, .advertisement'
  )) {
    el.remove()
  }

  const reader = new Readability(document)
  const article = reader.parse()

  if (!article || !article.content) {
    throw Object.assign(new Error('无法提取有效内容'), { code: 'NO_CONTENT' })
  }

  // linkedom parseHTML 对片段 HTML（如 Readability 输出）会把内容放在 body 外面
  // 导致 body.innerHTML 为空，需要用 documentElement.innerHTML 并去掉 head/body 标签
  const contentDoc = parseHTML(article.content).document

  for (const img of contentDoc.querySelectorAll('img') as NodeListOf<HTMLImageElement>) {
    const dataSrc =
      img.getAttribute('data-src') ||
      img.getAttribute('data-original') ||
      img.getAttribute('data-lazy-src')
    const currentSrc = img.getAttribute('src') || ''
    const isPlaceholder = currentSrc.startsWith('data:') || currentSrc.includes('1x1') || currentSrc.includes('spacer')
    if (dataSrc && (!currentSrc || isPlaceholder)) {
      img.setAttribute('src', dataSrc)
    }
    img.removeAttribute('style')
    img.removeAttribute('width')
    img.removeAttribute('height')
  }

  // linkedom body.innerHTML 可能为空（片段 HTML 内容在 body 外），用 body 内容或 fallback 到 documentElement
  let html = contentDoc.body.innerHTML
  if (!html) {
    html = contentDoc.documentElement.innerHTML
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
      .replace(/<\/?body[^>]*>/gi, '')
      .replace(/<\/?html[^>]*>/gi, '')
  }
  const markdown = turndown(html)

  const imageUrls = Array.from(contentDoc.querySelectorAll('img') as NodeListOf<HTMLImageElement>)
    .map((img) => img.getAttribute('src')?.trim())
    .filter((src): src is string => Boolean(src))

  log.info(`extracted: title="${article.title}", images=${imageUrls.length}`)

  return {
    title: article.title || new URL(url).hostname,
    html,
    markdown,
    sourceUrl: url,
    sourceName: new URL(url).hostname,
    images: [],
    imageUrls,
  } as any
}
