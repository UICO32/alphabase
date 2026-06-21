import { ipcMain, BrowserWindow } from 'electron'
import { log } from './logger'
import { detectPlatform, extractContent } from './extractor'
import { extractXHS } from './platforms/xhs'
import { extractWeChat } from './platforms/wechat'
import { extractBilibili } from './platforms/bilibili'
import { extractYouTube } from './platforms/youtube'
import { extractTwitter } from './platforms/twitter'
import { extractXiaoyuzhou } from './platforms/xiaoyuzhou'
import { downloadImages, replaceImageUrls } from './imageDownloader'
import { turndown } from './turndown'
import { loadConfig } from './cliConfig'
import { execCli, cliExists } from './cliExecutor'
import type { ClipRequest, ClipResult, ClipErrorBody, AgentReachBrowseRequest, AgentReachBrowseResult } from './types'

const CLI_PLATFORMS = ['twitter', 'bilibili', 'youtube', 'xiaoyuzhou']

async function handleClip(_event: any, body: ClipRequest): Promise<ClipResult> {
  const { url, workspacePath } = body

  log.info(`clipping: ${url}`)

  const platform = detectPlatform(url)
  let result: ClipResult | null = null

  // 1. CLI-first platforms: skip HTML fetch, try CLI extractor directly
  if (CLI_PLATFORMS.includes(platform)) {
    try {
      result = await extractWithCli(platform, url)
      if (result) {
        log.info(`CLI extraction succeeded for ${platform}: title="${result.title}"`)
      }
    } catch (err: any) {
      if (err.code === 'CLI_NOT_FOUND') {
        log.info(`CLI tool not found for ${platform}, falling back to HTML`)
      } else if (err.code === 'CLI_TIMEOUT' || err.code === 'CLI_ERROR') {
        log.warn(`CLI extraction failed for ${platform}: ${err.message}`)
      } else {
        throw err
      }
    }
  }

  // 2. HTML-based extraction (existing path or CLI fallback)
  if (!result) {
    result = await extractViaHtml(platform, url)
  }

  // 3. turndown fallback
  if (!result.markdown && result.html) {
    result.markdown = turndown(result.html)
  }

  // 4. download images
  const imageUrls = result.imageUrls || []
  delete result.imageUrls

  log.info(`imageUrls count: ${imageUrls.length}, workspacePath: ${workspacePath || '(empty)'}`)

  if (imageUrls.length > 0 && workspacePath) {
    const imageInfos = await downloadImages(imageUrls, workspacePath, url)
    log.info(`images downloaded: ${imageInfos.length}/${imageUrls.length}`)
    const replaced = replaceImageUrls(result.html, result.markdown, imageInfos, workspacePath || '')
    result.html = replaced.html
    result.markdown = replaced.markdown
    result.images = imageInfos
  }

  log.info(`clip complete: title="${result.title}", images=${result.images.length}`)
  return result
}

async function extractWithCli(platform: string, url: string): Promise<ClipResult | null> {
  switch (platform) {
    case 'bilibili':
      return extractBilibili(url)
    case 'youtube':
      return extractYouTube(url)
    case 'twitter':
      return extractTwitter(url)
    case 'xiaoyuzhou':
      return extractXiaoyuzhou(url)
    default:
      return null
  }
}

async function extractViaHtml(platform: string, url: string): Promise<ClipResult> {
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

  if (extractionFailed || !result) {
    // 小红书：尝试 opencli fallback
    if (platform === 'xiaohongshu') {
      try {
        const cfg = loadConfig()
        if (await cliExists(cfg.opencli)) {
          log.info('xhs extraction failed, trying opencli xiaohongshu')
          const opencliResult = await extractXHSViaOpenCLI(url, cfg.opencli)
          if (opencliResult) return opencliResult
        }
      } catch (err: any) {
        log.warn(`opencli xhs fallback failed: ${err.message}`)
      }
    }

    log.info('extraction failed, loading page with headless browser')
    try {
      rawHtml = await loadWithBrowser(url)
      result = extractWithPlatform(platform, url, rawHtml)
    } catch (err: any) {
      if (err.code) throw err
      throw Object.assign(new Error(`解析失败: ${err.message}`), { code: 'PARSE_ERROR' })
    }
  }

  return result
}

function extractWithPlatform(platform: string, url: string, rawHtml: string): ClipResult {
  if (platform === 'xiaohongshu') {
    const xhsResult = extractXHS(url, rawHtml)
    return xhsResult || extractContent(url, rawHtml)
  }
  if (platform === 'wechat') {
    const wechatResult = extractWeChat(url, rawHtml)
    return wechatResult || extractContent(url, rawHtml)
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

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        log.info('browser load timeout, proceeding with current content')
        resolve()
      }, 10000)
      win.webContents.on('did-finish-load', () => {
        clearTimeout(timeout)
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

async function extractXHSViaOpenCLI(url: string, opencliPath: string): Promise<ClipResult | null> {
  const result = await execCli({
    command: opencliPath,
    args: ['xiaohongshu', 'note', url, '-f', 'json'],
    timeout: 30000,
  })
  if (result.exitCode !== 0 || !result.stdout) return null

  let data: any
  try { data = JSON.parse(result.stdout) } catch { return null }

  const title = data.title || '小红书笔记'
  const desc = data.desc || data.description || data.content || ''
  const imageUrls: string[] = []
  if (data.images) {
    for (const img of data.images) {
      if (img.urlDefault || img.url) imageUrls.push(img.urlDefault || img.url)
    }
  }

  const htmlParts = [`<h1>${title}</h1>`]
  if (desc) htmlParts.push(`<p>${desc.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>`)
  for (const imgUrl of imageUrls) {
    htmlParts.push(`<p><img src="${imgUrl}" /></p>`)
  }

  const html = htmlParts.join('\n')
  return {
    title,
    html,
    markdown: turndown(html),
    sourceUrl: url,
    sourceName: '小红书',
    images: [],
    imageUrls,
  } as any
}

// --- Agent Reach Browse ---

async function handleAgentReachBrowse(_event: any, req: AgentReachBrowseRequest): Promise<AgentReachBrowseResult> {
  const config = loadConfig(req.workspacePath)

  switch (req.platform) {
    case 'bilibili':
      return browseBilibili(config, req)
    case 'xiaohongshu':
      return browseXiaohongshu(config, req)
    default:
      throw Object.assign(new Error(`Unsupported platform: ${req.platform}`), { code: 'CLI_ERROR' })
  }
}

async function browseBilibili(config: ReturnType<typeof loadConfig>, req: AgentReachBrowseRequest): Promise<AgentReachBrowseResult> {
  const limit = req.limit || 20
  let args: string[]

  switch (req.action) {
    case 'search':
      if (!req.query) throw Object.assign(new Error('Search requires a query'), { code: 'CLI_ERROR' })
      args = ['search', req.query, '--type', 'video', '--json', '-n', String(limit)]
      break
    case 'hot':
      args = ['hot', '--json', '-n', String(limit)]
      break
    case 'rank':
      args = ['rank', '--json', '-n', String(limit)]
      break
    default:
      throw Object.assign(new Error(`Unsupported action for bilibili: ${req.action}`), { code: 'CLI_ERROR' })
  }

  let command = config.bili
  if (!(await cliExists(command))) {
    log.warn(`bili CLI not found at configured path: ${command}`)
    if (command !== 'bili' && (await cliExists('bili'))) {
      command = 'bili'
    } else {
      throw Object.assign(new Error(
        `未找到 bili CLI。请先安装 bili 命令行工具，或在配置文件中设置 "bili" 路径。\n` +
        `当前配置路径: ${config.bili}\n` +
        `可通过环境变量 HEPTA_AGENT_REACH_CONFIG 指定配置文件，或在 workspace 下创建 .hepta/agent-reach.json 配置 { "bili": "/path/to/bili" }`
      ), { code: 'CLI_NOT_FOUND' })
    }
  }

  let result
  try {
    result = await execCli({ command, args, timeout: 30000, env: { PYTHONIOENCODING: 'utf-8' } })
  } catch (err: any) {
    throw Object.assign(new Error(`bili CLI 执行失败: ${err.message}`), { code: 'CLI_ERROR' })
  }

  if (result.timedOut) throw Object.assign(new Error('bili CLI 执行超时，请稍后重试'), { code: 'CLI_TIMEOUT' })
  if (result.exitCode !== 0) throw Object.assign(new Error(`bili CLI 执行失败 (exit ${result.exitCode}): ${result.stderr.slice(0, 300)}`), { code: 'CLI_ERROR' })

  let data
  try { data = JSON.parse(result.stdout) } catch { throw Object.assign(new Error('bili CLI 返回的内容不是有效的 JSON'), { code: 'CLI_ERROR' }) }

  if (req.action === 'search') {
    const items = (data.data || []).map((v: any) => mapBiliItem(v))
    return { items, hasMore: items.length >= limit }
  }

  const items = (data.data?.items || []).map((v: any) => mapBiliItem(v))
  return { items, hasMore: items.length >= limit }
}

function mapBiliItem(v: any): AgentReachBrowseResult['items'][0] {
  return {
    id: v.bvid || v.id,
    title: v.title,
    author: v.owner?.name,
    url: v.url || `https://www.bilibili.com/video/${v.bvid}`,
    thumbnail: v.pic,
    description: v.description,
    stats: v.stats ? { 播放: v.stats.view, 点赞: v.stats.like } : undefined,
    duration: v.duration,
  }
}

async function browseXiaohongshu(config: ReturnType<typeof loadConfig>, req: AgentReachBrowseRequest): Promise<AgentReachBrowseResult> {
  const limit = req.limit || 20
  let args: string[]

  switch (req.action) {
    case 'search':
      if (!req.query) throw Object.assign(new Error('Search requires a query'), { code: 'CLI_ERROR' })
      args = ['xiaohongshu', 'search', req.query, '-f', 'json', '--limit', String(limit)]
      break
    case 'hot':
      args = ['xiaohongshu', 'feed', '-f', 'json', '--limit', String(limit)]
      break
    default:
      throw Object.assign(new Error(`Unsupported action for xiaohongshu: ${req.action}`), { code: 'CLI_ERROR' })
  }

  let command = config.opencli
  if (!(await cliExists(command))) {
    log.warn(`opencli not found at configured path: ${command}`)
    if (command !== 'opencli' && (await cliExists('opencli'))) {
      command = 'opencli'
    } else {
      throw Object.assign(new Error(
        `未找到 opencli。请先安装 opencli，或在配置文件中设置 "opencli" 路径。\n` +
        `当前配置路径: ${config.opencli}\n` +
        `可通过环境变量 HEPTA_AGENT_REACH_CONFIG 指定配置文件，或在 workspace 下创建 .hepta/agent-reach.json 配置 { "opencli": "/path/to/opencli" }`
      ), { code: 'CLI_NOT_FOUND' })
    }
  }

  let result
  try {
    result = await execCli({ command, args, timeout: 30000 })
  } catch (err: any) {
    throw Object.assign(new Error(`opencli 执行失败: ${err.message}`), { code: 'CLI_ERROR' })
  }

  if (result.timedOut) throw Object.assign(new Error('opencli 执行超时，请稍后重试'), { code: 'CLI_TIMEOUT' })
  if (result.exitCode !== 0) throw Object.assign(new Error(`opencli 执行失败 (exit ${result.exitCode}): ${result.stderr.slice(0, 300)}`), { code: 'CLI_ERROR' })

  let data
  try { data = JSON.parse(result.stdout) } catch { throw Object.assign(new Error('opencli 返回的内容不是有效的 JSON'), { code: 'CLI_ERROR' }) }

  const rawItems = Array.isArray(data) ? data : (data.data || data.items || [])
  const items = rawItems.map((v: any) => mapXHSItem(v))
  return { items, hasMore: items.length >= limit }
}

function mapXHSItem(v: any): AgentReachBrowseResult['items'][0] {
  return {
    id: v.noteId || v.id || v.note_id,
    title: v.title || v.displayTitle || v.display_title,
    author: v.user?.nickname || v.user?.name,
    url: v.noteId ? `https://www.xiaohongshu.com/explore/${v.noteId}` : (v.url || v.share_info?.url),
    thumbnail: v.cover || v.image || v.pic,
    description: v.desc || v.description,
    stats: (v.interactInfo || v.stats) ? {
      点赞: v.interactInfo?.likedCount || v.stats?.likes,
      收藏: v.interactInfo?.collectedCount || v.stats?.collects,
    } : undefined,
  }
}

export function registerClipperHandlers() {
  ipcMain.handle('clipper:clip', handleClip)
  ipcMain.handle('clipper:agentReachBrowse', handleAgentReachBrowse)
}
