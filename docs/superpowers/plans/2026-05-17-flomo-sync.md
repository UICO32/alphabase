# Flomo 同步一期实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 flomo memo 单向导入到卡片库，手动触发，增量同步。

**Architecture:** Electron 主进程代理 flomo API 请求（解决 CORS + 密钥安全），渲染进程通过 IPC 调用。HTML 内容经 turndown 转 Markdown 再解析为 BlockNote blocks。同步状态持久化在工作区 flomo-sync.json。

**Tech Stack:** Electron IPC, turndown (HTML→MD), ts-md5 (签名), Zustand (同步状态)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/utils/flomoConverter.ts` | Create | HTML → BlockNote blocks 转换 |
| `src/utils/flomoSync.ts` | Create | 同步服务（状态管理、IPC 调用、增量过滤） |
| `electron/main.ts` | Modify | 新增 flomo:* IPC 通道 |
| `electron/preload.ts` | Modify | 暴露 electronAPI.flomo |
| `src/components/ui/SettingsDialog.tsx` | Modify | 分栏重构 + 同步设置区块 |
| `src/components/ui/CardLibraryView.tsx` | Modify | 添加同步图标 |
| `src/components/ui/LeftPanel.tsx` | Modify | 传递同步 props |

---

### Task 1: 安装依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 turndown 和 ts-md5**

```bash
cd d:/USE/save/code/abase && pnpm add turndown ts-md5 && pnpm add -D @types/turndown
```

- [ ] **Step 2: 验证安装**

```bash
cd d:/USE/save/code/abase && pnpm ls turndown ts-md5
```

Expected: 两个包都显示版本号

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add turndown and ts-md5 dependencies for flomo sync"
```

---

### Task 2: HTML → BlockNote 转换器

**Files:**
- Create: `src/utils/flomoConverter.ts`

- [ ] **Step 1: 创建 flomoConverter.ts**

```typescript
import TurndownService from 'turndown'

export interface FlomoTag {
  name: string
}

export interface FlomoMemo {
  slug: string
  content: string
  tags: FlomoTag[]
  created_at: string
  updated_at: string
  files: { url: string; type: string }[]
}

export interface ConvertedCard {
  title: string
  blocks: any[]
  tags: string[]
  flomoSlug: string
  flomoCreatedAt: string
  imageUrls: string[]
}

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
})

function parseMarkdownToBlocks(md: string): any[] {
  const lines = md.split('\n')
  const blocks: any[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // 空行跳过
    if (line.trim() === '') {
      i++
      continue
    }

    // 标题
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/)
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3
      blocks.push({
        type: 'heading',
        props: { level, backgroundColor: 'default', textColor: 'default' },
        content: [{ type: 'text', text: headingMatch[2], styles: {} }],
        children: [],
      })
      i++
      continue
    }

    // 引用
    if (line.startsWith('> ')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2))
        i++
      }
      blocks.push({
        type: 'quote',
        props: { backgroundColor: 'default', textColor: 'default' },
        content: [{ type: 'text', text: quoteLines.join('\n'), styles: {} }],
        children: [],
      })
      continue
    }

    // 代码块
    if (line.startsWith('```')) {
      const codeLines: string[] = []
      const lang = line.slice(3).trim()
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // 跳过结束的 ```
      blocks.push({
        type: 'codeBlock',
        props: { language: lang || 'plaintext', backgroundColor: 'default' },
        content: [{ type: 'text', text: codeLines.join('\n'), styles: {} }],
        children: [],
      })
      continue
    }

    // 无序列表
    if (line.match(/^[-*]\s+/)) {
      const items: any[] = []
      while (i < lines.length && lines[i].match(/^[-*]\s+/)) {
        items.push({
          type: 'bulletListItem',
          props: { backgroundColor: 'default', textColor: 'default' },
          content: [{ type: 'text', text: lines[i].replace(/^[-*]\s+/, ''), styles: {} }],
          children: [],
        })
        i++
      }
      blocks.push(...items)
      continue
    }

    // 有序列表
    if (line.match(/^\d+\.\s+/)) {
      const items: any[] = []
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        items.push({
          type: 'numberedListItem',
          props: { backgroundColor: 'default', textColor: 'default' },
          content: [{ type: 'text', text: lines[i].replace(/^\d+\.\s+/, ''), styles: {} }],
          children: [],
        })
        i++
      }
      blocks.push(...items)
      continue
    }

    // 图片
    const imgMatch = line.match(/!\[.*?\]\((.+?)\)/)
    if (imgMatch) {
      blocks.push({
        type: 'image',
        props: { backgroundColor: 'default', url: imgMatch[1], caption: '' },
        children: [],
      })
      i++
      continue
    }

    // 普通段落
    blocks.push({
      type: 'paragraph',
      props: { backgroundColor: 'default', textColor: 'default' },
      content: [{ type: 'text', text: line, styles: {} }],
      children: [],
    })
    i++
  }

  return blocks
}

export function convertFlomoMemo(memo: FlomoMemo): ConvertedCard {
  // 提取图片 URL
  const imageUrls = (memo.files || [])
    .filter(f => f.type?.startsWith('image/'))
    .map(f => f.url)

  // HTML → Markdown
  const markdown = turndown.turndown(memo.content || '')

  // Markdown → BlockNote blocks
  const blocks = parseMarkdownToBlocks(markdown)

  // 提取标签
  const tags = (memo.tags || []).map(t => t.name)

  // 标题：取第一行文本，截断到 50 字符
  const firstText = memo.content?.replace(/<[^>]+>/g, '').trim() || ''
  const title = firstText.slice(0, 50) || `flomo ${memo.slug}`

  return {
    title,
    blocks,
    tags,
    flomoSlug: memo.slug,
    flomoCreatedAt: memo.created_at,
    imageUrls,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/flomoConverter.ts
git commit -m "feat(sync): add flomo HTML to BlockNote blocks converter"
```

---

### Task 3: Electron 主进程 IPC 通道

**Files:**
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`

- [ ] **Step 1: 在 main.ts 添加 flomo IPC 处理器**

在 `electron/main.ts` 中，找到现有 IPC 处理器区域（如 `ipcMain.handle('fs:readFile'` 附近），在后面添加：

```typescript
import { Md5 } from 'ts-md5'

// flomo API 签名
const FLOMO_SIGN_KEY = 'dbbc3dd73364b4084c3a69346e0ce2b2'

function signFlomoParams(params: Record<string, string>): string {
  const keys = Object.keys(params).sort()
  const str = keys.map(k => `${k}=${params[k]}&`).join('')
  return Md5.hashStr(str + FLOMO_SIGN_KEY) as string
}

// flomo:login
ipcMain.handle('flomo:login', async (_event, { email, password }: { email: string; password: string }) => {
  const params: Record<string, string> = {
    email,
    password,
    timestamp: String(Math.floor(Date.now() / 1000)),
  }
  params.sign = signFlomoParams(params)

  const resp = await fetch('https://flomoapp.com/api/v1/user/login_by_email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const data = await resp.json()
  if (data.code !== 0) {
    throw new Error(data.message || '登录失败')
  }
  return { accessToken: data.data.access_token }
})

// flomo:fetchMemos
ipcMain.handle('flomo:fetchMemos', async (_event, { accessToken, lastSyncTime }: { accessToken: string; lastSyncTime?: string }) => {
  const allMemos: any[] = []
  let offset = 0
  const limit = 100

  while (true) {
    const params: Record<string, string> = {
      access_token: accessToken,
      limit: String(limit),
      offset: String(offset),
    }
    if (lastSyncTime) {
      params.updated_at = lastSyncTime
    }
    params.sign = signFlomoParams(params)

    const url = `https://flomoapp.com/api/v1/memo/updated?${new URLSearchParams(params).toString()}`
    const resp = await fetch(url)
    const data = await resp.json()

    if (data.code === -10) {
      throw new Error('TOKEN_EXPIRED')
    }
    if (data.code !== 0) {
      throw new Error(data.message || '获取 memo 失败')
    }

    const memos = data.data || []
    allMemos.push(...memos)
    if (memos.length < limit) break
    offset += limit
  }

  return { memos: allMemos }
})

// flomo:downloadImg
ipcMain.handle('flomo:downloadImg', async (_event, { url, destPath }: { url: string; destPath: string }) => {
  try {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const buffer = Buffer.from(await resp.arrayBuffer())
    fs.mkdirSync(path.dirname(destPath), { recursive: true })
    fs.writeFileSync(destPath, buffer)
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
})
```

注意：`fs` 和 `path` 已在 main.ts 中导入。`Md5` 需要从 `ts-md5` 导入。如果 main.ts 顶部没有 `import { Md5 } from 'ts-md5'`，需添加。

- [ ] **Step 2: 在 preload.ts 暴露 flomo API**

在 `electron/preload.ts` 中，找到 `contextBridge.exposeInMainWorld('electronAPI'` 的对象定义，在现有 API 后面添加：

```typescript
flomo: {
  login: (email: string, password: string) =>
    ipcRenderer.invoke('flomo:login', { email, password }),
  fetchMemos: (accessToken: string, lastSyncTime?: string) =>
    ipcRenderer.invoke('flomo:fetchMemos', { accessToken, lastSyncTime }),
  downloadImg: (url: string, destPath: string) =>
    ipcRenderer.invoke('flomo:downloadImg', { url, destPath }),
},
```

- [ ] **Step 3: 更新 electronAPI 类型声明**

在 `src/` 中找到 `electronAPI` 的类型声明文件（通常在 `src/global.d.ts` 或 `src/types/` 下），添加 flomo 类型：

```typescript
flomo: {
  login: (email: string, password: string) => Promise<{ accessToken: string }>
  fetchMemos: (accessToken: string, lastSyncTime?: string) => Promise<{ memos: any[] }>
  downloadImg: (url: string, destPath: string) => Promise<{ success: boolean; error?: string }>
}
```

- [ ] **Step 4: Commit**

```bash
git add electron/main.ts electron/preload.ts src/global.d.ts
git commit -m "feat(sync): add flomo IPC channels in Electron main process"
```

---

### Task 4: 同步服务

**Files:**
- Create: `src/utils/flomoSync.ts`

- [ ] **Step 1: 创建 flomoSync.ts**

```typescript
import { create } from 'zustand'
import { convertFlomoMemo, type FlomoMemo, type ConvertedCard } from './flomoConverter'
import { useCardStore, type GlobalCard } from './cardStore'
import { useWorkspaceStore } from './workspace/workspaceStore'

export interface FlomoSyncState {
  syncing: boolean
  lastSyncTime: string | null
  importedCount: number
  error: string | null
  accessToken: string | null
  email: string | null
  importedSlugs: Set<string>
}

export interface FlomoSyncActions {
  login: (email: string, password: string) => Promise<void>
  sync: () => Promise<void>
  logout: () => void
  loadState: () => Promise<void>
  _saveState: () => Promise<void>
}

const STATE_KEY = 'flomo-sync-state'

export const useFlomoSyncStore = create<FlomoSyncState & FlomoSyncActions>((set, get) => ({
  syncing: false,
  lastSyncTime: null,
  importedCount: 0,
  error: null,
  accessToken: null,
  email: null,
  importedSlugs: new Set(),

  login: async (email: string, password: string) => {
    set({ error: null })
    try {
      const result = await window.electronAPI.flomo.login(email, password)
      set({ accessToken: result.accessToken, email })
      await get()._saveState()
    } catch (e: any) {
      set({ error: e.message || '登录失败' })
      throw e
    }
  },

  sync: async () => {
    const { syncing, accessToken, importedSlugs } = get()
    if (syncing || !accessToken) return

    set({ syncing: true, error: null })
    try {
      // 拉取 memo
      const { memos } = await window.electronAPI.flomo.fetchMemos(
        accessToken,
        get().lastSyncTime || undefined
      )

      // 过滤已导入
      const newMemos = (memos as FlomoMemo[]).filter(m => !importedSlugs.has(m.slug))

      if (newMemos.length === 0) {
        set({ syncing: false, lastSyncTime: new Date().toISOString() })
        await get()._saveState()
        return
      }

      // 转换并导入
      const workspaceDir = useWorkspaceStore.getState().currentWorkspace
      const cards: GlobalCard[] = []

      for (const memo of newMemos) {
        const converted = convertFlomoMemo(memo)

        // 下载图片
        if (converted.imageUrls.length > 0 && workspaceDir) {
          for (let i = 0; i < converted.imageUrls.length; i++) {
            const imgUrl = converted.imageUrls[i]
            const ext = imgUrl.match(/\.(png|jpg|jpeg|gif|webp)/i)?.[1] || 'png'
            const fileName = `flomo_${memo.slug}_${i}.${ext}`
            const destPath = `${workspaceDir}/assets/flomo/${fileName}`
            const result = await window.electronAPI.flomo.downloadImg(imgUrl, destPath)
            if (result.success) {
              // 替换 blocks 中的图片 URL
              converted.blocks = converted.blocks.map(b => {
                if (b.type === 'image' && b.props?.url === imgUrl) {
                  return { ...b, props: { ...b.props, url: `assets/flomo/${fileName}` } }
                }
                return b
              })
            }
          }
        }

        const card: GlobalCard = {
          id: crypto.randomUUID(),
          title: converted.title,
          content: JSON.stringify(converted.blocks),
          previewHTML: converted.title,
          tags: converted.tags,
          color: 'default',
          createdAt: memo.created_at,
          updatedAt: memo.updated_at,
          flomoSlug: memo.slug,
        }
        cards.push(card)
      }

      // 批量导入
      useCardStore.getState().importCards(cards)

      // 更新状态
      const newSlugs = new Set(importedSlugs)
      newMemos.forEach(m => newSlugs.add(m.slug))

      set({
        syncing: false,
        lastSyncTime: new Date().toISOString(),
        importedCount: get().importedCount + newMemos.length,
        importedSlugs: newSlugs,
      })
      await get()._saveState()
    } catch (e: any) {
      if (e.message === 'TOKEN_EXPIRED' && get().email) {
        // Token 过期，尝试重新登录（需要密码，暂时只标记错误）
        set({ syncing: false, error: '登录已过期，请重新登录', accessToken: null })
      } else {
        set({ syncing: false, error: e.message || '同步失败' })
      }
    }
  },

  logout: () => {
    set({ accessToken: null, email: null })
    get()._saveState()
  },

  loadState: async () => {
    try {
      const workspaceDir = useWorkspaceStore.getState().currentWorkspace
      if (!workspaceDir) return
      const content = await window.electronAPI.fs.readFile(`${workspaceDir}/flomo-sync.json`)
      const data = JSON.parse(content)
      set({
        lastSyncTime: data.lastSyncTime || null,
        importedCount: data.importedCount || 0,
        accessToken: data.accessToken || null,
        email: data.email || null,
        importedSlugs: new Set(data.importedSlugs || []),
      })
    } catch {
      // 文件不存在，使用默认值
    }
  },

  _saveState: async () => {
    const { lastSyncTime, importedCount, accessToken, email, importedSlugs } = get()
    const workspaceDir = useWorkspaceStore.getState().currentWorkspace
    if (!workspaceDir) return
    const data = {
      lastSyncTime,
      importedCount,
      accessToken,
      email,
      importedSlugs: Array.from(importedSlugs),
    }
    await window.electronAPI.fs.writeFile(
      `${workspaceDir}/flomo-sync.json`,
      JSON.stringify(data, null, 2)
    )
  },
}))
```

- [ ] **Step 2: 在 cardStore 确认 importCards 和 GlobalCard 类型**

检查 `src/utils/cardStore.ts`，确认 `GlobalCard` 接口是否有 `flomoSlug` 字段。如果没有，需要在 `GlobalCard` 接口中添加可选字段 `flomoSlug?: string`。

- [ ] **Step 3: Commit**

```bash
git add src/utils/flomoSync.ts src/utils/cardStore.ts
git commit -m "feat(sync): add flomo sync service with Zustand store"
```

---

### Task 5: 设置页分栏重构 + 同步设置区块

**Files:**
- Modify: `src/components/ui/SettingsDialog.tsx`

- [ ] **Step 1: 重构 SettingsDialog 为分栏布局**

将现有单列设置页重构为左右分栏：
- 左侧导航：系统设置 / 同步设置 / 导入导出
- 右侧内容区：显示选中分类的内容

左侧导航样式参考项目现有的深色主题，选中项用 `var(--accent)` 高亮。

系统设置区块保留原有的画布设置项。导入导出区块保留原有的导入导出功能。

- [ ] **Step 2: 添加同步设置区块**

同步设置区块包含：
- Flomo 邮箱输入框（type="email"）
- Flomo 密码输入框（type="password"）
- 登录/断开按钮
- 同步状态信息（上次同步时间、已导入数量）
- 同步按钮

使用 `useFlomoSyncStore` 读取状态和调用方法。组件挂载时调用 `loadState()`。

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/SettingsDialog.tsx
git commit -m "feat(ui): refactor settings dialog with sidebar navigation and flomo sync section"
```

---

### Task 6: 卡片库同步图标

**Files:**
- Modify: `src/components/ui/CardLibraryView.tsx`
- Modify: `src/components/ui/LeftPanel.tsx`

- [ ] **Step 1: 在 CardLibraryView 添加同步图标**

在 `CardLibraryView` 组件的标题栏右侧添加一个 RefreshCw 图标按钮（来自 lucide-react，项目已有）。

点击触发 `useFlomoSyncStore.getState().sync()`。同步中时图标添加 CSS 旋转动画（`animation: spin 1s linear infinite`）。

如果未登录（accessToken 为 null），点击时打开设置页到同步设置分类。

- [ ] **Step 2: 在 LeftPanel 传递必要的 props**

如果 `CardLibraryView` 需要额外的 props（如 `onOpenSettings`），在 `LeftPanel` 中传递。

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/CardLibraryView.tsx src/components/ui/LeftPanel.tsx
git commit -m "feat(ui): add flomo sync icon to card library views"
```

---

### Task 7: 旋转动画 CSS

**Files:**
- Modify: `src/theme/animations.css`

- [ ] **Step 1: 添加 spin 动画**

在 `src/theme/animations.css` 中添加：

```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/theme/animations.css
git commit -m "feat(ui): add spin animation for sync icon"
```

---

### Task 8: 集成验证

- [ ] **Step 1: 启动开发服务器**

```bash
cd d:/USE/save/code/abase && pnpm dev
```

- [ ] **Step 2: 用 Playwright 验证设置页分栏**

打开设置页，确认左侧导航有三个分类，切换正常。

- [ ] **Step 3: 用 Playwright 验证同步图标**

确认左面板和右侧面板的卡片库标题栏有同步图标。

- [ ] **Step 4: 验证 flomo 登录流程**

在同步设置中输入 flomo 账号，确认登录成功，状态正确显示。

- [ ] **Step 5: 验证同步流程**

点击同步图标，确认 memo 被导入为卡片，标签正确，图片下载到本地。

- [ ] **Step 6: 验证增量同步**

再次点击同步，确认已导入的 memo 被跳过。

- [ ] **Step 7: 最终 Commit**

```bash
git add -A
git commit -m "feat(sync): flomo one-way import with incremental sync"
```
