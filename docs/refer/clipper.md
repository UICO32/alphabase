# URL 剪藏工具 — 核心代码与逻辑

## 整体架构

```
前端 (ClipUrlBar)  →  POST /api/clip  →  后端 (route.ts/server.ts)
                                              │
                                              ├─ 1. fetch 网页 HTML
                                              ├─ 2. 平台检测 → 专用解析器 or 通用提取器
                                              ├─ 3. HTML → Markdown (Turndown)
                                              ├─ 4. 图片下载 + Sharp 压缩
                                              └─ 5. 返回 ClipResult
                                                      │
前端 ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ←┘
  │
  ├─ htmlToBlocks() → BlockNote 块结构
  ├─ 更新卡片内容
  └─ 同步图片到 workspace
```

## 文件清单

| 文件 | 职责 |
|------|------|
| `server/clipper/types.ts` | 类型定义 (ClipRequest, ClipResult, ImageInfo, Platform) |
| `server/clipper/route.ts` | Express 路由，Vite 插件内挂载 |
| `server/clipper/server.ts` | 独立 Express 服务器 (port 3001) |
| `server/clipper/extractor.ts` | 通用网页提取器 (Readability + Turndown) |
| `server/clipper/platforms/xhs.ts` | 小红书专用解析 |
| `server/clipper/platforms/wechat.ts` | 微信公众号专用解析 |
| `server/clipper/imageDownloader.ts` | 图片下载 + Sharp 压缩 |
| `server/clipper/logger.ts` | 统一日志 (HEPTA_DEBUG=1 开启详细) |
| `src/utils/clipper.ts` | 前端 API 调用封装 |
| `src/utils/htmlToBlocks.ts` | HTML → BlockNote 块转换 |
| `src/components/ui/ClipUrlBar.tsx` | 前端 UI 交互组件 |

---

## 1. 类型定义 — `server/clipper/types.ts`

```typescript
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
  imageUrls?: string[]  // 内部用：下载前收集，下载后删除
}

export interface ClipErrorBody {
  error: string
  code: 'TIMEOUT' | 'FETCH_ERROR' | 'PARSE_ERROR' | 'UNSUPPORTED_PLATFORM' | 'NO_CONTENT'
}

export type Platform = 'xiaohongshu' | 'wechat' | 'generic'
```

---

## 2. 核心路由 — `server/clipper/route.ts`

### 主流程 `handleClip()`

```
① fetch 目标 URL → 拿到 rawHtml + hostname
② 平台检测（hostname 匹配）→ 走专用解析器 or 通用提取器
③ 若 markdown 为空 → Turndown 转 markdown
④ 若有图片 → downloadImages() 下载+压缩 → 替换 HTML/Markdown 中的原始 URL 为本地路径
⑤ 返回 ClipResult
```

### 关键代码

```typescript
// 平台检测 + 分发
if (hostname.includes('xiaohongshu.com') || hostname.includes('xhslink.com')) {
  result = await extractXHS(body.url, rawHtml)
} else if (hostname.includes('mp.weixin.qq.com')) {
  result = await extractWeChat(body.url, rawHtml)
}
// 通用回退
if (!result) {
  result = await extractContent(body.url, globalThis.fetch, rawHtml)
}

// 图片 URL 替换为本地路径
for (const info of imageInfos) {
  const localUrl = `/api/media/${info.localFilename}?workspace=${encodeURIComponent(mediaDir)}`
  result.html = result.html.replace(new RegExp(escapeRegExp(info.originalUrl), 'g'), localUrl)
  result.markdown = result.markdown.replace(new RegExp(escapeRegExp(info.originalUrl), 'g'), localUrl)
}
```

### API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/clip` | POST | 提交 URL 剪藏请求，body: `{ url, workspacePath }` |
| `/api/media/:filename` | GET | 获取已下载的本地图片，query: `workspace` |

### 错误码映射

| code | HTTP 状态码 | 含义 |
|------|------------|------|
| `PARSE_ERROR` | 400 | URL 格式无效 |
| `WECHAT_CAPTCHA` | 403 | 微信反爬验证拦截 |
| `TIMEOUT` | 504 | 请求超时 |
| `FETCH_ERROR` | 502 | 网页抓取失败 |
| `NO_CONTENT` | 502 | 无法提取有效内容 |

---

## 3. 通用网页提取器 — `server/clipper/extractor.ts`

### 核心逻辑

```
JSDOM 解析 HTML → 移除 script/style/nav/footer 等噪音 → Readability 提取正文
→ 处理懒加载图片 (data-src/data-original/data-lazy-src → src)
→ Turndown 转 Markdown → 收集图片 URL 列表
```

### 关键代码

```typescript
const doc = new JSDOM(rawHtml, { url })

// 清理噪音元素
for (const el of doc.window.document.querySelectorAll(
  'script, style, nav, footer, iframe, .ad, .advertisement'
)) {
  el.remove()
}

// Readability 提取正文
const reader = new Readability(doc.window.document)
const article = reader.parse()

// 懒加载图片修复：data-src/data-original/data-lazy-src → src
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

// Turndown 转 Markdown
const markdown = turndown.turndown(html)

// 收集图片 URL
const imageUrls = Array.from(contentDoc.querySelectorAll('img'))
  .map(img => img.getAttribute('src')?.trim())
  .filter((src): src is string => Boolean(src))
```

### 平台检测函数

```typescript
function detectPlatform(url: string): Platform {
  const hostname = new URL(url).hostname
  if (hostname.includes('xiaohongshu.com') || hostname.includes('xhslink.com')) return 'xiaohongshu'
  if (hostname.includes('mp.weixin.qq.com')) return 'wechat'
  return 'generic'
}
```

---

## 4. 平台专用解析器

### 4.1 小红书 — `server/clipper/platforms/xhs.ts`

**提取策略：** 从 HTML 中提取 `window.__INITIAL_STATE__` SSR JSON 数据

```
从 script 标签提取 window.__INITIAL_STATE__ JSON → 解析 noteDetailMap
→ 取 title/desc/imageList → 拼装 HTML
```

```typescript
// 从 script 标签提取 SSR 数据
const match = text.match(/window\.__INITIAL_STATE__\s*=\s*({.+?})\s*<\/script>/s)
noteData = JSON.parse(match[1].replace(/undefined/g, 'null'))

const note = Object.values(noteData.note.noteDetailMap)[0]
const { title, desc, imageList } = note.note

// 图片 URL 优先级
const imgUrl = img?.urlDefault || img?.url || img?.infoList?.[0]?.url
```

**失败回退：** 若 `__INITIAL_STATE__` 不存在或解析失败，返回 `null`，由通用提取器兜底。

### 4.2 微信公众号 — `server/clipper/platforms/wechat.ts`

**提取策略：** DOM 选择器定位关键元素

```typescript
const titleEl = doc.querySelector('#activity-name')    // 标题
const contentEl = doc.querySelector('#js_content')      // 正文
const authorEl = doc.querySelector('#js_name')          // 作者
```

**图片处理（防盗链）：**

```typescript
// 图片真实 URL 优先级：data-src > data-original > data-url > src
const src =
  img.getAttribute('data-src') ||
  img.getAttribute('data-original') ||
  img.getAttribute('data-url') ||
  img.getAttribute('src') ||
  ''
```

**样式清理：**

```typescript
// 移除微信内联样式和 wx_ 前缀 class
clone.querySelectorAll('*').forEach(el => {
  el.removeAttribute('style')
  if (el.hasAttribute('class')) {
    const cls = el.getAttribute('class') || ''
    el.setAttribute('class', cls.replace(/wx_[\w-]*/g, '').trim())
  }
})
```

**反爬检测：**

```typescript
if (/captcha|TCaptcha|secitptpage|__DEBUGINFO/.test(rawHtml)) {
  throw Object.assign(
    new Error('微信公众号反爬验证拦截，请尝试在浏览器中打开文章后再剪藏'),
    { code: 'WECHAT_CAPTCHA' }
  )
}
```

---

## 5. 图片下载与压缩 — `server/clipper/imageDownloader.ts`

### 流程

```
去重 + 补全协议(// → https:) → 逐张下载 → Sharp 压缩
→ JPEG quality 80%, WebP quality 80%, 最大宽度 1200px
→ SVG/GIF 不压缩直接保存
→ 返回 originalUrl → localFilename 映射
```

### 压缩参数

| 格式 | 质量 | 最大宽度 | 特殊处理 |
|------|------|---------|---------|
| JPEG | 80% | 1200px | — |
| PNG | 80% | 1200px | — |
| WebP | 80% | 1200px | — |
| SVG | — | — | 不压缩，原样保存 |
| GIF | — | — | 不压缩，原样保存 |

### 关键代码

```typescript
let pipeline = sharp(buffer).resize({ width: MAX_WIDTH, withoutEnlargement: true })
if (ext === 'png') compressed = await pipeline.png({ quality: JPEG_QUALITY }).toBuffer()
else if (ext === 'webp') compressed = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer()
else compressed = await pipeline.jpeg({ quality: JPEG_QUALITY }).toBuffer()
```

### URL 预处理

```typescript
const uniqueUrls = [...new Set(imageUrls)]           // 去重
  .map(u => u.startsWith('//') ? `https:${u}` : u)  // 补全协议
  .filter(u => u.startsWith('http'))                  // 仅保留 http(s)
```

### 文件命名

```typescript
const filename = `${Date.now()}_${String(index).padStart(2, '0')}.${ext}`
// 例: 1716123456789_00.jpg
```

### 单图下载容错

```typescript
for (let i = 0; i < uniqueUrls.length; i++) {
  try {
    const info = await downloadOne(uniqueUrls[i], results.length, mediaDir)
    results.push(info)
  } catch (err) {
    log.warn(`image download failed: ${err.message}, keeping original URL`)
    // 单张失败不影响整体，保留原始 URL
  }
}
```

---

## 6. 日志系统 — `server/clipper/logger.ts`

```typescript
export const log = {
  info(msg: string)    // [clipper] 关键步骤、耗时、结果摘要
  debug(msg: string)   // [clipper:debug] 中间数据（需 HEPTA_DEBUG=1）
  warn(msg: string)    // [clipper:warn] 非致命问题
  error(msg: string)   // [clipper:error] 错误
}
```

| 环境变量 | 说明 |
|---------|------|
| `HEPTA_DEBUG=1` | 开启 debug 级别日志 |
| `CLIPPER_PORT` | 独立服务器端口（默认 3001） |

---

## 7. 前端 API 调用 — `src/utils/clipper.ts`

```typescript
export async function clipUrl(url: string, workspacePath?: string): Promise<ClipResult> {
  const response = await fetch('/api/clip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, workspacePath }),
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw Object.assign(
      new Error(errorBody.error || `HTTP ${response.status}`),
      { code: errorBody.code || 'FETCH_ERROR' }
    )
  }

  return await response.json()
}

export function isValidHttpUrl(text: string): boolean {
  try {
    const url = new URL(text)
    return ['http:', 'https:'].includes(url.protocol)
  } catch { return false }
}
```

---

## 8. HTML → BlockNote 块转换 — `src/utils/htmlToBlocks.ts`

递归遍历 DOM 树，将 HTML 元素映射为 BlockNote 块结构。

### 映射关系

| HTML 元素 | BlockNote 块类型 | 备注 |
|---|---|---|
| `h1-h6` | `heading` | h4-h6 降级为 level 3 |
| `p` | `paragraph` | 若仅含一张 img 则转为 image 块 |
| `ul/ol > li` | `bulletListItem` | — |
| `blockquote` | `paragraph` | — |
| `pre > code` | `codeBlock` | — |
| `img` | `image` | props: `{ url: src }` |
| `figure > img` | `image` | figcaption → 斜体段落 |
| `section/div/article` | 递归处理 | 容器元素不生成块 |

### 行内样式映射

| HTML 元素 | styles |
|---|---|
| `strong/b` | `{ bold: true }` |
| `em/i` | `{ italic: true }` |
| `a` | `{ link: href }` |
| `code` | `{ code: true }` |
| `br` | `text: '\n'` |

---

## 9. 前端 UI 交互 — `src/components/ui/ClipUrlBar.tsx`

### 交互流程

```
用户点击 "Clip URL" → 展开输入框 → 粘贴 URL → 按 Enter/点击按钮
  │
  ├─ ① URL 合法性校验 (new URL + http/https 协议)
  ├─ ② 在画布中央创建"骨架卡片"（蓝色，显示"剪藏中…"占位）
  ├─ ③ 调用 clipUrl() → POST /api/clip
  ├─ ④ 成功：将图片同步到 workspace → htmlToBlocks → 更新卡片内容 → 选中卡片
  └─ ⑤ 失败：更新卡片为黄色，显示错误信息
```

### 骨架卡片

```typescript
useCardStore.getState().addCard({
  id: cardId,
  content: JSON.stringify([
    { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: '剪藏中…' }] },
    { type: 'paragraph', content: [{ type: 'text', text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' }] },
    { type: 'paragraph', content: [{ type: 'text', text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' }] },
    { type: 'paragraph', content: [{ type: 'text', text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━' }] },
    { type: 'paragraph', content: [{ type: 'text', text }] },
  ]),
  color: 'blue',  // 蓝色 = 加载中
})
```

### 成功更新

```typescript
useCardStore.getState().updateCard(cardId, {
  content: JSON.stringify(blocks),  // htmlToBlocks 转换后的 BlockNote 块
  color: 'white',                   // 白色 = 可编辑
})
editor.select(shapeId)               // 选中卡片展示结果
```

### 失败处理

```typescript
const errorMessage = err.code === 'TIMEOUT'
  ? '请求超时，请检查网络后重试'
  : err.code === 'NO_CONTENT' ? '该页面无法提取有效内容'
  : err.code === 'FETCH_ERROR' ? `无法访问该页面 (${err.message})`
  : `剪藏失败: ${err.message || '未知错误'}`

useCardStore.getState().updateCard(cardId, {
  content: JSON.stringify([
    { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: '剪藏失败' }] },
    { type: 'paragraph', content: [{ type: 'text', text: errorMessage }] },
    { type: 'paragraph', content: [{ type: 'text', text }] },
  ]),
  color: 'yellow',  // 黄色 = 错误
})
```

### 图片同步到 workspace

```typescript
if (ws?.isOpen && result.images && result.images.length > 0) {
  for (const img of result.images) {
    const imgResponse = await fetch(`/api/media/${img.localFilename}`)
    if (imgResponse.ok) {
      const blob = await imgResponse.blob()
      await ws.saveMedia(img.localFilename, blob)
    }
  }
}
```

---

## 完整数据流

```
用户粘贴 URL
    ↓
ClipUrlBar.handleClip()
    ↓ 创建骨架卡片 (蓝色, "剪藏中…")
    ↓
clipUrl() → POST /api/clip { url, workspacePath }
    ↓
后端 handleClip()
    ├─ fetch HTML (UA 伪装, 25s 超时, follow redirect)
    ├─ 平台检测 (hostname 匹配)
    │   ├─ xiaohongshu.com / xhslink.com → extractXHS() (SSR JSON 解析)
    │   ├─ mp.weixin.qq.com → extractWeChat() (DOM 选择器 + 防盗链)
    │   └─ 其他 → extractContent() (Readability + Turndown)
    ├─ 图片下载 + Sharp 压缩 → 本地文件 (.heptabase/media/)
    └─ 替换 HTML/Markdown 中的图片 URL → 本地 /api/media/ 路径
    ↓
前端收到 ClipResult
    ├─ 图片同步到 workspace (fetch → saveMedia)
    ├─ htmlToBlocks() → BlockNote 块数组
    └─ updateCard() 更新卡片内容 (白色, 可编辑)
```

## 依赖包

| 包名 | 用途 |
|------|------|
| `express` | HTTP 服务 |
| `@mozilla/readability` | 正文提取 |
| `jsdom` | Node.js 端 DOM 解析 |
| `turndown` | HTML → Markdown |
| `sharp` | 图片压缩 |
