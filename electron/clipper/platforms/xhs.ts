import { log } from '../logger'
import type { ClipResult } from '../types'

export function extractXHS(url: string, rawHtml: string): ClipResult | null {
  try {
    const match = rawHtml.match(/window\.__INITIAL_STATE__\s*=\s*({.+?})\s*<\/script>/s)
    if (!match) return null

    const jsonStr = match[1].replace(/undefined/g, 'null')
    const noteData = JSON.parse(jsonStr)

    const noteMap = noteData?.note?.noteDetailMap
    if (!noteMap) return null

    const noteEntry = Object.values(noteMap)[0] as any
    if (!noteEntry?.note) return null

    const { title, desc, imageList } = noteEntry.note

    const htmlParts: string[] = []
    if (title) htmlParts.push(`<h1>${title}</h1>`)
    if (desc) htmlParts.push(`<p>${desc}</p>`)

    const imageUrls: string[] = []
    if (imageList && Array.isArray(imageList)) {
      for (const img of imageList) {
        const imgUrl = img?.urlDefault || img?.url || img?.infoList?.[0]?.url
        if (imgUrl) {
          imageUrls.push(imgUrl)
          htmlParts.push(`<p><img src="${imgUrl}" /></p>`)
        }
      }
    }

    if (htmlParts.length === 0) return null

    const html = htmlParts.join('\n')
    log.info(`XHS extracted: title="${title}", images=${imageUrls.length}`)

    return {
      title: title || '小红书笔记',
      html,
      markdown: '',
      sourceUrl: url,
      sourceName: '小红书',
      images: [],
      imageUrls,
    }
  } catch (err) {
    log.warn(`XHS parse failed, falling back to generic: ${err}`)
    return null
  }
}
