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

  const contentDoc = parseHTML(article.content).document

  for (const img of contentDoc.querySelectorAll('img') as NodeListOf<HTMLImageElement>) {
    const dataSrc =
      img.getAttribute('data-src') ||
      img.getAttribute('data-original') ||
      img.getAttribute('data-lazy-src')
    if (dataSrc && !img.getAttribute('src')) {
      img.setAttribute('src', dataSrc)
    }
    img.removeAttribute('style')
    img.removeAttribute('width')
    img.removeAttribute('height')
  }

  const html = contentDoc.body.innerHTML
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
