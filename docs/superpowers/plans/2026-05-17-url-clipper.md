# URL 剪藏功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为画布应用添加 URL 剪藏功能，用户粘贴网页 URL 后自动抓取内容、下载图片、创建卡片。

**Architecture:** 后端逻辑放在 Electron 主进程的 IPC handler 中，图片通过自定义协议 `hepta-media://` 提供给渲染进程。前端通过工具栏按钮触发，创建骨架卡片后调用 IPC，成功后更新卡片内容。

**Tech Stack:** Electron IPC, @mozilla/readability, jsdom, turndown, sharp, lucide-react

---

### Task 1: 安装依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装后端依赖**

Run:
```bash
cd d:/USE/save/code/abase && pnpm add @mozilla/readability jsdom turndown sharp
pnpm add -D @types/jsdom @types/turndown
```

- [ ] **Step 2: 验证安装成功**

Run:
```bash
cd d:/USE/save/code/abase && pnpm ls @mozilla/readability jsdom turndown sharp
```
Expected: 四个包均显示版本号

- [ ] **Step 3: Commit**

```bash
cd d:/USE/save/code/abase && git add package.json pnpm-lock.yaml
git commit -m "chore: add clipper dependencies (readability, jsdom, turndown, sharp)"
```

---

### Task 2: 类型定义

**Files:**
- Create: `electron/clipper/types.ts`

- [ ] **Step 1: 创建类型文件**

```typescript
// electron/clipper/types.ts
export interface ClipRequest {
  url: string
  workspacePath?: string
}

export interface ImageInfo {
  originalUrl: string
  localFilename: string
  originalSize: number
  compressedSize: number
}

export interface ClipResult {
  title: string
  html: string
  markdown: string
  sourceUrl: string
  sourceName: string
  favicon?: string
  images: ImageInfo[]
}

export interface ClipErrorBody {
  error: string
  code: 'TIMEOUT' | 'FETCH_ERROR' | 'PARSE_ERROR' | 'UNSUPPORTED_PLATFORM' | 'NO_CONTENT' | 'WECHAT_CAPTCHA'
}

export type Platform = 'xiaohongshu' | 'wechat' | 'generic'
```

- [ ] **Step 2: Commit**

```bash
cd d:/USE/save/code/abase && git add electron/clipper/types.ts
git commit -m "feat(clipper): add type definitions"
```

---

### Task 3: 日志模块

**Files:**
- Create: `electron/clipper/logger.ts`

- [ ] **Step 1: 创建日志模块**

```typescript
// electron/clipper/logger.ts
const DEBUG = process.env.HEPTA_DEBUG === '1'

function prefix(level: string) {
  return level === 'debug' ? '[clipper:debug]' : `[clipper:${level}]`
}

export const log = {
  info(msg: string) { console.log(`${prefix('info')} ${msg}`) },
  debug(msg: string) { DEBUG && console.log(`${prefix('debug')} ${msg}`) },
  warn(msg: string) { console.warn(`${prefix('warn')} ${msg}`) },
  error(msg: string) { console.error(`${prefix('error')} ${msg}`) },
}
```

- [ ] **Step 2: Commit**

```bash
cd d:/USE/save/code/abase && git add electron/clipper/logger.ts
git commit -m "feat(clipper): add logger module"
```

---

### Task 4: 通用网页提取器

**Files:**
- Create: `electron/clipper/extractor.ts`

- [ ] **Step 1: 创建通用提取器**

```typescript
// electron/clipper/extractor.ts
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import TurndownService from 'turndown'
import { log } from './logger'
import type { ClipResult, Platform } from './types'

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
})

export function detectPlatform(url: string): Platform {
  const hostname = new URL(url).hostname
  if (hostname.includes('xiaohongshu.com') || hostname.includes('xhslink.com')) return 'xiaohongshu'
  if (hostname.includes('mp.weixin.qq.com')) return 'wechat'
  return 'generic'
}

export function extractContent(url: string, rawHtml: string): ClipResult {
  const doc = new JSDOM(rawHtml, { url })
  const window = doc.window

  for (const el of window.document.querySelectorAll(
    'script, style, nav, footer, iframe, .ad, .advertisement'
  )) {
    el.remove()
  }

  const reader = new Readability(window.document)
  const article = reader.parse()

  if (!article || !article.content) {
    throw Object.assign(new Error('无法提取有效内容'), { code: 'NO_CONTENT' })
  }

  const contentDoc = new JSDOM(article.content).window.document

  for (const img of contentDoc.querySelectorAll('img')) {
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
  const markdown = turndown.turndown(html)

  const imageUrls = Array.from(contentDoc.querySelectorAll('img'))
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
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd d:/USE/save/code/abase && git add electron/clipper/extractor.ts
git commit -m "feat(clipper): add generic content extractor"
```

---

### Task 5: 小红书专用解析器

**Files:**
- Create: `electron/clipper/platforms/xhs.ts`

- [ ] **Step 1: 创建小红书解析器**

```typescript
// electron/clipper/platforms/xhs.ts
import { JSDOM } from 'jsdom'
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
```

- [ ] **Step 2: Commit**

```bash
cd d:/USE/save/code/abase && git add electron/clipper/platforms/xhs.ts
git commit -m "feat(clipper): add xiaohongshu parser"
```

---

### Task 6: 微信公众号专用解析器

**Files:**
- Create: `electron/clipper/platforms/wechat.ts`

- [ ] **Step 1: 创建微信公众号解析器**

```typescript
// electron/clipper/platforms/wechat.ts
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
```

- [ ] **Step 2: Commit**

```bash
cd d:/USE/save/code/abase && git add electron/clipper/platforms/wechat.ts
git commit -m "feat(clipper): add wechat parser"
```

---

### Task 7: 图片下载与压缩

**Files:**
- Create: `electron/clipper/imageDownloader.ts`

- [ ] **Step 1: 创建图片下载模块**

```typescript
// electron/clipper/imageDownloader.ts
import { writeFile, mkdir } from 'fs/promises'
import { join, extname } from 'path'
import sharp from 'sharp'
import { log } from './logger'
import type { ImageInfo } from './types'

const JPEG_QUALITY = 85
const MAX_WIDTH = 1200
const SKIP_COMPRESS_THRESHOLD = 300 * 1024 // 300KB

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeUrl(url: string): string {
  if (url.startsWith('//')) return `https:${url}`
  return url
}

function getExtFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const ext = extname(pathname).toLowerCase().replace('.', '')
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif'].includes(ext)) return ext === 'svg' ? 'svg' : ext
  } catch {}
  return 'jpg'
}

async function downloadOne(
  url: string,
  index: number,
  mediaDir: string
): Promise<ImageInfo> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Referer: url,
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  const originalSize = buffer.length
  const ext = getExtFromUrl(url)
  const localFilename = `${Date.now()}_${String(index).padStart(2, '0')}.${ext}`
  const localPath = join(mediaDir, localFilename)

  // SVG/GIF 不压缩
  if (ext === 'svg' || ext === 'gif') {
    await writeFile(localPath, buffer)
    return { originalUrl: url, localFilename, originalSize, compressedSize: originalSize }
  }

  // 低于 300KB 跳过压缩
  if (originalSize < SKIP_COMPRESS_THRESHOLD) {
    await writeFile(localPath, buffer)
    return { originalUrl: url, localFilename, originalSize, compressedSize: originalSize }
  }

  let pipeline = sharp(buffer).resize({ width: MAX_WIDTH, withoutEnlargement: true })
  let compressed: Buffer
  if (ext === 'png') compressed = await pipeline.png({ quality: JPEG_QUALITY }).toBuffer()
  else if (ext === 'webp') compressed = await pipeline.webp({ quality: JPEG_QUALITY }).toBuffer()
  else compressed = await pipeline.jpeg({ quality: JPEG_QUALITY }).toBuffer()

  await writeFile(localPath, compressed)
  log.debug(`image compressed: ${url} → ${localFilename} (${originalSize}→${compressed.length})`)

  return { originalUrl: url, localFilename, originalSize, compressedSize: compressed.length }
}

export async function downloadImages(
  imageUrls: string[],
  workspacePath: string
): Promise<ImageInfo[]> {
  const uniqueUrls = [...new Set(imageUrls)]
    .map(normalizeUrl)
    .filter((u) => u.startsWith('http'))

  if (uniqueUrls.length === 0) return []

  const mediaDir = join(workspacePath, 'media')
  await mkdir(mediaDir, { recursive: true })

  const results: ImageInfo[] = []
  for (let i = 0; i < uniqueUrls.length; i++) {
    try {
      const info = await downloadOne(uniqueUrls[i], results.length, mediaDir)
      results.push(info)
    } catch (err: any) {
      log.warn(`image download failed: ${err.message}, keeping original URL`)
    }
  }

  log.info(`images downloaded: ${results.length}/${uniqueUrls.length}`)
  return results
}

export function replaceImageUrls(html: string, markdown: string, imageInfos: ImageInfo[]): { html: string; markdown: string } {
  let newHtml = html
  let newMarkdown = markdown
  for (const info of imageInfos) {
    const localUrl = `hepta-media://${info.localFilename}`
    newHtml = newHtml.replace(new RegExp(escapeRegExp(info.originalUrl), 'g'), localUrl)
    newMarkdown = newMarkdown.replace(new RegExp(escapeRegExp(info.originalUrl), 'g'), localUrl)
  }
  return { html: newHtml, markdown: newMarkdown }
}
```

- [ ] **Step 2: Commit**

```bash
cd d:/USE/save/code/abase && git add electron/clipper/imageDownloader.ts
git commit -m "feat(clipper): add image downloader with sharp compression"
```

---

### Task 8: IPC Handler 主流程

**Files:**
- Create: `electron/clipper/handler.ts`

- [ ] **Step 1: 创建 handler**

```typescript
// electron/clipper/handler.ts
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
  const imageUrls = (result as any).imageUrls || []
  delete (result as any).imageUrls

  if (imageUrls.length > 0 && workspacePath) {
    const imageInfos = await downloadImages(imageUrls, workspacePath)
    const replaced = replaceImageUrls(result.html, result.markdown, imageInfos)
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
```

- [ ] **Step 2: Commit**

```bash
cd d:/USE/save/code/abase && git add electron/clipper/handler.ts
git commit -m "feat(clipper): add IPC handler with main clip flow"
```

---

### Task 9: 注册 IPC handler 和自定义协议

**Files:**
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`

- [ ] **Step 1: 修改 main.ts — 注册 handler 和自定义协议**

在 `app.whenReady().then(createWindow)` 之前添加协议注册，在 IPC handlers 区域添加 clipper handler 注册：

```typescript
// 在文件顶部 import 区域添加：
import { protocol } from 'electron'
import { registerClipperHandlers } from './clipper/handler'
import { readFile } from 'fs/promises'
import { join } from 'path'

// 在 app.whenReady().then(...) 之前添加：
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'hepta-media',
    privileges: { bypassCSP: true, stream: true, supportFetchAPI: false },
  },
])

// 在 createWindow() 函数内，createMenu(mainWindow) 之后添加：
registerClipperHandlers()

// 在 app.whenReady().then(createWindow) 之后添加自定义协议 handler：
app.whenReady().then(() => {
  protocol.handle('hepta-media', async (request) => {
    const filename = decodeURIComponent(request.url.replace('hepta-media://', ''))
    const workspacePath = useWorkspaceStore ? /* will be passed via query */ null : null
    // 从 workspace media 目录读取
    // workspacePath 通过 URL query 传递: hepta-media://filename?workspace=/path
    try {
      const url = new URL(request.url)
      const workspacePath = url.searchParams.get('workspace') || ''
      const filePath = join(workspacePath, 'media', filename)
      const data = await readFile(filePath)
      const ext = filename.split('.').pop()?.toLowerCase() || 'jpg'
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', avif: 'image/avif',
      }
      return new Response(data, {
        headers: { 'content-type': mimeMap[ext] || 'application/octet-stream' },
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
})
```

实际上，由于 `protocol.handle` 必须在 `app.whenReady()` 之后调用，而 `createWindow` 已经在 `app.whenReady().then()` 中，我们需要重构 main.ts 的初始化顺序。完整修改如下：

将 `app.whenReady().then(createWindow)` 替换为：

```typescript
app.whenReady().then(() => {
  // 注册自定义协议
  protocol.handle('hepta-media', async (request) => {
    try {
      const url = new URL(request.url)
      const filename = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
      const workspacePath = url.searchParams.get('workspace') || ''
      const filePath = join(workspacePath, 'media', filename)
      const data = await readFile(filePath)
      const ext = filename.split('.').pop()?.toLowerCase() || 'jpg'
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', avif: 'image/avif',
      }
      return new Response(data, {
        headers: { 'content-type': mimeMap[ext] || 'application/octet-stream' },
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })

  createWindow()
})
```

在 `createWindow` 函数内，`createMenu(mainWindow)` 之后添加：

```typescript
registerClipperHandlers()
```

在文件顶部 import 区域添加：

```typescript
import { readFile } from 'fs/promises'
import { registerClipperHandlers } from './clipper/handler'
```

注意：`protocol.registerSchemesAsPrivileged` 必须在 `app.whenReady()` 之前调用，所以在文件顶部（import 之后）添加：

```typescript
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'hepta-media',
    privileges: { bypassCSP: true, stream: true, supportFetchAPI: false },
  },
])
```

- [ ] **Step 2: 修改 preload.ts — 暴露 clipper API**

在 `contextBridge.exposeInMainWorld` 的对象中添加 `clipper` 属性：

```typescript
clipper: {
  clip: (url: string, workspacePath?: string) => ipcRenderer.invoke('clipper:clip', { url, workspacePath }),
},
```

- [ ] **Step 3: Commit**

```bash
cd d:/USE/save/code/abase && git add electron/main.ts electron/preload.ts
git commit -m "feat(clipper): register IPC handler and hepta-media protocol"
```

---

### Task 10: 前端 IPC 调用封装

**Files:**
- Create: `src/utils/clipper.ts`

- [ ] **Step 1: 创建前端调用封装**

```typescript
// src/utils/clipper.ts
import type { ClipResult } from '../../electron/clipper/types'

export async function clipUrl(url: string, workspacePath?: string): Promise<ClipResult> {
  const electronAPI = (window as any).electronAPI
  if (!electronAPI?.clipper?.clip) {
    throw Object.assign(new Error('剪藏功能仅在 Electron 桌面端可用'), { code: 'UNSUPPORTED_PLATFORM' })
  }

  try {
    return await electronAPI.clipper.clip(url, workspacePath)
  } catch (err: any) {
    const errorBody = { error: err.message || '未知错误', code: err.code || 'FETCH_ERROR' }
    throw Object.assign(new Error(errorBody.error), { code: errorBody.code })
  }
}

export function isValidHttpUrl(text: string): boolean {
  try {
    const url = new URL(text)
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd d:/USE/save/code/abase && git add src/utils/clipper.ts
git commit -m "feat(clipper): add frontend IPC call wrapper"
```

---

### Task 11: HTML → BlockNote 块转换

**Files:**
- Create: `src/utils/htmlToBlocks.ts`

- [ ] **Step 1: 创建 HTML → BlockNote 转换模块**

```typescript
// src/utils/htmlToBlocks.ts
import { log } from '../../electron/clipper/logger'

interface InlineStyle {
  bold?: boolean
  italic?: boolean
  code?: boolean
  link?: string
}

interface TextInline {
  type: 'text'
  text: string
  styles: InlineStyle
}

interface BlockNode {
  type: string
  props?: Record<string, any>
  content?: any[]
  children?: BlockNode[]
}

function parseInlineStyles(el: Element): TextInline[] {
  const result: TextInline[] = []

  function walk(node: Node, styles: InlineStyle) {
    if (node.nodeType === 3) {
      const text = node.textContent || ''
      if (text) {
        result.push({ type: 'text', text, styles: { ...styles } })
      }
      return
    }
    if (node.nodeType !== 1) return
    const e = node as Element
    const tag = e.tagName.toLowerCase()
    const next = { ...styles }
    if (tag === 'strong' || tag === 'b') next.bold = true
    else if (tag === 'em' || tag === 'i') next.italic = true
    else if (tag === 'code' && !e.closest('pre')) next.code = true
    else if (tag === 'a') next.link = e.getAttribute('href') || undefined
    else if (tag === 'br') { result.push({ type: 'text', text: '\n', styles: { ...styles } }); return }
    for (const child of e.childNodes) walk(child, next)
  }

  for (const child of el.childNodes) walk(child, {})
  return result
}

function headingLevel(tag: string): 1 | 2 | 3 {
  const n = parseInt(tag.replace('h', ''))
  return (n <= 3 ? n : 3) as 1 | 2 | 3
}

export function htmlToBlocks(html: string): BlockNode[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const blocks: BlockNode[] = []

  function processElement(el: Element) {
    const tag = el.tagName.toLowerCase()

    if (['section', 'div', 'article', 'main', 'header', 'footer'].includes(tag)) {
      for (const child of el.children) processElement(child)
      return
    }

    if (tag.match(/^h[1-6]$/)) {
      const content = parseInlineStyles(el)
      if (content.length > 0) {
        blocks.push({
          type: 'heading',
          props: { level: headingLevel(tag) },
          content,
        })
      }
      return
    }

    if (tag === 'p') {
      const imgs = el.querySelectorAll('img')
      if (imgs.length === 1 && el.textContent?.trim() === '') {
        const src = imgs[0].getAttribute('src')
        if (src) {
          blocks.push({ type: 'image', props: { url: src } })
          return
        }
      }
      const content = parseInlineStyles(el)
      if (content.length > 0) {
        blocks.push({ type: 'paragraph', content })
      }
      return
    }

    if (tag === 'img') {
      const src = el.getAttribute('src')
      if (src) blocks.push({ type: 'image', props: { url: src } })
      return
    }

    if (tag === 'figure') {
      const img = el.querySelector('img')
      if (img) {
        const src = img.getAttribute('src')
        if (src) blocks.push({ type: 'image', props: { url: src } })
      }
      const caption = el.querySelector('figcaption')
      if (caption?.textContent?.trim()) {
        blocks.push({
          type: 'paragraph',
          content: [{ type: 'text', text: caption.textContent.trim(), styles: { italic: true } }],
        })
      }
      return
    }

    if (tag === 'blockquote') {
      for (const child of el.children) processElement(child)
      return
    }

    if (tag === 'pre') {
      const code = el.querySelector('code')
      const text = code?.textContent || el.textContent || ''
      blocks.push({ type: 'codeBlock', props: { language: '' }, content: [{ type: 'text', text, styles: {} }] })
      return
    }

    if (tag === 'ul' || tag === 'ol') {
      for (const li of el.querySelectorAll(':scope > li')) {
        const content = parseInlineStyles(li)
        if (content.length > 0) {
          blocks.push({ type: 'bulletListItem', content })
        }
      }
      return
    }

    for (const child of el.children) processElement(child)
  }

  for (const child of doc.body.children) processElement(child)

  if (blocks.length === 0) {
    blocks.push({ type: 'paragraph', content: [{ type: 'text', text: '（无内容）', styles: {} }] })
  }

  return blocks
}
```

- [ ] **Step 2: Commit**

```bash
cd d:/USE/save/code/abase && git add src/utils/htmlToBlocks.ts
git commit -m "feat(clipper): add HTML to BlockNote blocks converter"
```

---

### Task 12: ClipUrlBar UI 组件

**Files:**
- Create: `src/components/ui/ClipUrlBar.tsx`

- [ ] **Step 1: 创建剪藏 URL 输入组件**

```tsx
// src/components/ui/ClipUrlBar.tsx
import { useState, useRef, useEffect } from 'react'
import { Scissors, X, Loader2 } from 'lucide-react'
import { clipUrl, isValidHttpUrl } from '../../utils/clipper'
import { htmlToBlocks } from '../../utils/htmlToBlocks'
import { useCardStore } from '../../utils/cardStore'
import { useLibraryStore } from '../../utils/libraryStore'
import { useWorkspaceStore } from '../../utils/workspace/workspaceStore'
import { usePanelSurface } from '../../hooks/usePanelSurface'

interface ClipUrlBarProps {
  open: boolean
  onClose: () => void
}

export function ClipUrlBar({ open, onClose }: ClipUrlBarProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const surface = usePanelSurface()
  const workspacePath = useWorkspaceStore((s) => s.currentWorkspace?.path)

  useEffect(() => {
    if (open) {
      setUrl('')
      setError('')
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  if (!open) return null

  const handleClip = async () => {
    const trimmed = url.trim()
    if (!isValidHttpUrl(trimmed)) {
      setError('请输入有效的 HTTP/HTTPS 链接')
      return
    }

    setLoading(true)
    setError('')

    const cardId = crypto.randomUUID()

    useCardStore.getState().addCard({
      id: cardId,
      content: JSON.stringify([
        { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: '剪藏中…', styles: {} }] },
        { type: 'paragraph', content: [{ type: 'text', text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', styles: {} }] },
        { type: 'paragraph', content: [{ type: 'text', text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', styles: {} }] },
        { type: 'paragraph', content: [{ type: 'text', text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', styles: {} }] },
        { type: 'paragraph', content: [{ type: 'text', text: trimmed, styles: { link: trimmed } }] },
      ]),
      color: 'blue',
      createdAt: Date.now(),
      title: '剪藏中…',
    })

    window.dispatchEvent(new CustomEvent('hepta-add-card-node', { detail: { cardId, color: 'blue' } }))

    try {
      const result = await clipUrl(trimmed, workspacePath)

      const blocks = htmlToBlocks(result.html)
      // 在最前面插入标题
      blocks.unshift({
        type: 'heading',
        props: { level: 2 },
        content: [{ type: 'text', text: result.title, styles: {} }],
      })
      // 在标题后插入来源链接
      blocks.splice(1, 0, {
        type: 'paragraph',
        content: [{ type: 'text', text: `来源: ${result.sourceName}`, styles: { link: result.sourceUrl } }],
      })

      useCardStore.getState().updateCard(cardId, {
        content: JSON.stringify(blocks),
        color: 'white',
        title: result.title,
      })

      useLibraryStore.getState().setEditingCardId(cardId)
      useLibraryStore.getState().setRightPanelActiveTab('editor')

      onClose()
    } catch (err: any) {
      const errorMessage =
        err.code === 'TIMEOUT' ? '请求超时，请检查网络后重试'
        : err.code === 'NO_CONTENT' ? '该页面无法提取有效内容'
        : err.code === 'WECHAT_CAPTCHA' ? '微信反爬验证拦截，请在浏览器中打开文章后重试'
        : err.code === 'FETCH_ERROR' ? `无法访问该页面 (${err.message})`
        : `剪藏失败: ${err.message || '未知错误'}`

      useCardStore.getState().updateCard(cardId, {
        content: JSON.stringify([
          { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: '剪藏失败', styles: {} }] },
          { type: 'paragraph', content: [{ type: 'text', text: errorMessage, styles: {} }] },
          { type: 'paragraph', content: [{ type: 'text', text: trimmed, styles: { link: trimmed } }] },
        ]),
        color: 'yellow',
        title: '剪藏失败',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-2 rounded-xl z-50 animate-fadeInUp"
      style={{
        backgroundColor: surface.panelBg,
        border: `1px solid ${surface.divider}`,
        boxShadow: surface.shadow,
        width: 420,
      }}
    >
      <Scissors size={16} style={{ color: surface.text, flexShrink: 0 }} />
      <input
        ref={inputRef}
        value={url}
        onChange={(e) => { setUrl(e.target.value); setError('') }}
        onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleClip() }}
        placeholder="粘贴网页链接..."
        disabled={loading}
        className="flex-1 bg-transparent outline-none text-sm"
        style={{ color: surface.text }}
      />
      {loading ? (
        <Loader2 size={16} className="animate-spin" style={{ color: surface.muted, flexShrink: 0 }} />
      ) : url ? (
        <button
          onClick={handleClip}
          className="text-xs px-2 py-1 rounded-md font-medium"
          style={{ backgroundColor: surface.accentBg, color: surface.accentText, flexShrink: 0 }}
        >
          剪藏
        </button>
      ) : null}
      <button
        onClick={onClose}
        className="p-1 rounded-md hover:opacity-70"
        style={{ color: surface.muted, flexShrink: 0 }}
      >
        <X size={14} />
      </button>
      {error && (
        <span className="text-xs" style={{ color: '#ef4444' }}>{error}</span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd d:/USE/save/code/abase && git add src/components/ui/ClipUrlBar.tsx
git commit -m "feat(clipper): add ClipUrlBar UI component"
```

---

### Task 13: 工具栏集成

**Files:**
- Modify: `src/components/ui/Toolbar.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 修改 Toolbar.tsx — 添加剪藏按钮**

在 import 中添加 `Scissors`：
```typescript
import { Plus, ZoomIn, ZoomOut, Maximize, Scissors } from 'lucide-react'
```

在 props 接口中添加：
```typescript
interface ToolbarProps {
  onAddCard?: () => void
  onClipUrl?: () => void
}
```

在组件参数中添加 `onClipUrl`：
```typescript
export function Toolbar({ onAddCard, onClipUrl }: ToolbarProps) {
```

在"卡片"按钮和缩放控制之间的分隔线之前，添加剪藏按钮：
```tsx
<button
  onClick={onClipUrl}
  className="btn-base flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
  style={{ color: surface.text }}
  title="剪藏网页"
>
  <Scissors size={14} />
  <span>剪藏</span>
</button>

<div
  className="w-px h-6 mx-1"
  style={{ backgroundColor: surface.divider }}
/>
```

- [ ] **Step 2: 修改 App.tsx — 集成 ClipUrlBar**

在 import 中添加：
```typescript
import { ClipUrlBar } from './components/ui/ClipUrlBar'
```

在 `showWorkspacePicker` state 附近添加：
```typescript
const [showClipUrlBar, setShowClipUrlBar] = useState(false)
```

在 `renderMainContent` 的 `board` case 中，修改 Toolbar 调用：
```tsx
<Toolbar onAddCard={handleAddCard} onClipUrl={() => setShowClipUrlBar(true)} />
```

在 `isBoardView && <RightPanel />` 之后添加：
```tsx
{isBoardView && <ClipUrlBar open={showClipUrlBar} onClose={() => setShowClipUrlBar(false)} />}
```

- [ ] **Step 3: Commit**

```bash
cd d:/USE/save/code/abase && git add src/components/ui/Toolbar.tsx src/App.tsx
git commit -m "feat(clipper): integrate clip button into toolbar"
```

---

### Task 14: 图片 URL 传递 workspacePath

**Files:**
- Modify: `electron/clipper/imageDownloader.ts`

- [ ] **Step 1: 修改 replaceImageUrls 使图片 URL 包含 workspace 参数**

将 `replaceImageUrls` 函数中的 `localUrl` 改为包含 workspace 查询参数：

```typescript
export function replaceImageUrls(html: string, markdown: string, imageInfos: ImageInfo[], workspacePath: string): { html: string; markdown: string } {
  let newHtml = html
  let newMarkdown = markdown
  for (const info of imageInfos) {
    const localUrl = `hepta-media://${info.localFilename}?workspace=${encodeURIComponent(workspacePath)}`
    newHtml = newHtml.replace(new RegExp(escapeRegExp(info.originalUrl), 'g'), localUrl)
    newMarkdown = newMarkdown.replace(new RegExp(escapeRegExp(info.originalUrl), 'g'), localUrl)
  }
  return { html: newHtml, markdown: newMarkdown }
}
```

- [ ] **Step 2: 同步修改 handler.ts 中的调用**

在 `handler.ts` 中，将 `replaceImageUrls` 调用改为传入 `workspacePath`：

```typescript
const replaced = replaceImageUrls(result.html, result.markdown, imageInfos, workspacePath || '')
```

- [ ] **Step 3: Commit**

```bash
cd d:/USE/save/code/abase && git add electron/clipper/imageDownloader.ts electron/clipper/handler.ts
git commit -m "fix(clipper): pass workspace path in hepta-media URLs"
```

---

### Task 15: 端到端验证

- [ ] **Step 1: 启动开发服务器**

Run:
```bash
cd d:/USE/save/code/abase && pnpm dev
```

- [ ] **Step 2: 在浏览器中验证**

1. 点击工具栏"剪藏"按钮，确认弹出 URL 输入框
2. 粘贴一个通用网页 URL（如 https://example.com），按 Enter
3. 确认画布中央出现蓝色骨架卡片
4. 等待剪藏完成，确认卡片变为白色并显示内容
5. 测试小红书 URL（如 https://www.xiaohongshu.com/explore/xxx）
6. 测试微信公众号文章 URL
7. 测试无效 URL，确认显示黄色错误卡片

- [ ] **Step 3: 验证图片加载**

1. 剪藏一个含图片的网页
2. 确认图片在卡片中正常显示（hepta-media:// 协议）
3. 确认 workspace/media/ 目录下有对应的图片文件

- [ ] **Step 4: Final commit**

```bash
cd d:/USE/save/code/abase && git add -A
git commit -m "feat(clipper): URL clipper feature complete"
```