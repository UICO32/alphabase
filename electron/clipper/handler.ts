import { ipcMain } from 'electron'
import { log } from './logger'
import { detectPlatform, extractContent } from './extractor'
import { extractXHS } from './platforms/xhs'
import { extractWeChat } from './platforms/wechat'
import { downloadImages, replaceImageUrls } from './imageDownloader'
import type { ClipRequest, ClipResult, ClipErrorBody } from './types'

async function handleClip(_event: any, body: ClipRequest): Promise<ClipResult> {
  const { url, workspacePath } = body

  log.info(`clipping: ${url}`)

  // 1. fetch HTML
  let rawHtml: string
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(25000),
    })
    if (!response.ok) {
      const errBody: ClipErrorBody = { error: `HTTP ${response.status}`, code: 'FETCH_ERROR' }
      throw Object.assign(new Error(errBody.error), { code: errBody.code })
    }
    rawHtml = await response.text()
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.code === 'TimeoutError') {
      throw Object.assign(new Error('请求超时'), { code: 'TIMEOUT' })
    }
    if (err.code === 'FETCH_ERROR' || err.code === 'WECHAT_CAPTCHA' || err.code === 'NO_CONTENT') throw err
    throw Object.assign(new Error(`无法访问该页面 (${err.message})`), { code: 'FETCH_ERROR' })
  }

  // 2. platform detection + extraction
  const platform = detectPlatform(url)
  let result: ClipResult

  try {
    if (platform === 'xiaohongshu') {
      const xhsResult = extractXHS(url, rawHtml)
      result = xhsResult || extractContent(url, rawHtml)
    } else if (platform === 'wechat') {
      result = extractWeChat(url, rawHtml)
    } else {
      result = extractContent(url, rawHtml)
    }
  } catch (err: any) {
    if (err.code) throw err
    throw Object.assign(new Error(`解析失败: ${err.message}`), { code: 'PARSE_ERROR' })
  }

  // 3. turndown fallback
  if (!result.markdown && result.html) {
    const TurndownService = (await import('turndown')).default
    const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
    result.markdown = td.turndown(result.html)
  }

  // 4. download images
  const imageUrls = result.imageUrls || []
  delete result.imageUrls

  if (imageUrls.length > 0 && workspacePath) {
    const imageInfos = await downloadImages(imageUrls, workspacePath)
    const replaced = replaceImageUrls(result.html, result.markdown, imageInfos, workspacePath || '')
    result.html = replaced.html
    result.markdown = replaced.markdown
    result.images = imageInfos
  }

  log.info(`clip complete: title="${result.title}", images=${result.images.length}`)
  return result
}

export function registerClipperHandlers() {
  ipcMain.handle('clipper:clip', handleClip)
}
