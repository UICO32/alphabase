import { ipcMain, BrowserWindow } from 'electron'
import { log } from './logger'
import { detectPlatform, extractContent } from './extractor'
import { extractXHS } from './platforms/xhs'
import { extractWeChat } from './platforms/wechat'
import { downloadImages, replaceImageUrls } from './imageDownloader'
import { turndown } from './turndown'
import type { ClipRequest, ClipResult, ClipErrorBody } from './types'

async function handleClip(_event: any, body: ClipRequest): Promise<ClipResult> {
  const { url, workspacePath } = body

  log.info(`clipping: ${url}`)

  // 1. fetch HTML
  let rawHtml: string
  try {
    rawHtml = await fetchHtml(url)
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.code === 'TimeoutError') {
      throw Object.assign(new Error('请求超时'), { code: 'TIMEOUT' })
    }
    if (err.code === 'FETCH_ERROR') throw err
    throw Object.assign(new Error(`无法访问该页面 (${err.message})`), { code: 'FETCH_ERROR' })
  }

  // 2. platform detection + extraction
  const platform = detectPlatform(url)
  let result: ClipResult | null = null
  let extractionFailed = false

  try {
    result = extractWithPlatform(platform, url, rawHtml)
  } catch (err: any) {
    if (err.code === 'WECHAT_CAPTCHA') {
      extractionFailed = true
    } else if (err.code) {
      throw err
    } else {
      extractionFailed = true
      log.warn(`extraction failed: ${err.message}`)
    }
  }

  // 3. 如果提取失败（反爬/空内容），用静默浏览器重新加载
  if (extractionFailed || !result) {
    log.info('extraction failed, loading page with headless browser')
    try {
      rawHtml = await loadWithBrowser(url)
      result = extractWithPlatform(platform, url, rawHtml)
    } catch (err: any) {
      if (err.code) throw err
      throw Object.assign(new Error(`解析失败: ${err.message}`), { code: 'PARSE_ERROR' })
    }
  }

  // 4. turndown fallback
  if (!result.markdown && result.html) {
    result.markdown = turndown(result.html)
  }

  // 5. download images
  const imageUrls = result.imageUrls || []
  delete result.imageUrls

  log.info(`imageUrls count: ${imageUrls.length}, workspacePath: ${workspacePath || '(empty)'}`)

  if (imageUrls.length > 0 && workspacePath) {
    const imageInfos = await downloadImages(imageUrls, workspacePath)
    log.info(`images downloaded: ${imageInfos.length}/${imageUrls.length}`)
    const replaced = replaceImageUrls(result.html, result.markdown, imageInfos, workspacePath || '')
    result.html = replaced.html
    result.markdown = replaced.markdown
    result.images = imageInfos
  }

  log.info(`clip complete: title="${result.title}", images=${result.images.length}`)
  return result
}

function extractWithPlatform(platform: string, url: string, rawHtml: string): ClipResult {
  if (platform === 'xiaohongshu') {
    const xhsResult = extractXHS(url, rawHtml)
    return xhsResult || extractContent(url, rawHtml)
  }
  if (platform === 'wechat') {
    return extractWeChat(url, rawHtml)
  }
  return extractContent(url, rawHtml)
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(25000),
  })
  if (!response.ok) {
    const errBody: ClipErrorBody = { error: `HTTP ${response.status}`, code: 'FETCH_ERROR' }
    throw Object.assign(new Error(errBody.error), { code: errBody.code })
  }
  return await response.text()
}

async function loadWithBrowser(url: string): Promise<string> {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    focusable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      javascript: true,
      offscreen: true,
    },
  })

  try {
    win.webContents.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
    )
    await win.loadURL(url)

    // 等待页面完全加载（包括 JS 渲染）
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        log.info('browser load timeout, proceeding with current content')
        resolve()
      }, 10000)
      win.webContents.on('did-finish-load', () => {
        clearTimeout(timeout)
        // 等待额外 2 秒让 JS 渲染完成
        setTimeout(() => resolve(), 2000)
      })
    })

    const html = await win.webContents.executeJavaScript('document.documentElement.outerHTML')
    log.info(`browser loaded: ${html.length} chars`)
    return html
  } finally {
    win.destroy()
  }
}

export function registerClipperHandlers() {
  ipcMain.handle('clipper:clip', handleClip)
}
