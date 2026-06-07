# Electron 启动性能优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将生产构建启动时间从 18s 降至 8-10s，splash <0.5s 出现，消除最小化恢复白屏。

**Architecture:** 独立 Splash BrowserWindow + onnxruntime 动态 import + BrowserWindow 配置优化。Splash window 用 data URL 加载轻量 HTML，主窗口 show:false 直到数据就绪后通过 IPC 触发切换。

**Tech Stack:** Electron 42, Vite 5, TypeScript, React 18

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `electron/splash.ts` | Create | Splash window 创建/管理/进度更新/销毁 |
| `electron/main.ts` | Modify | 引入 splash、删除 early-show、添加 backgroundColor/backgroundThrottling |
| `electron/preload.ts` | Modify | 添加 `onStartupProgress` 和 `onDataReady` IPC listener |
| `src/types/electron-api.d.ts` | Modify | 添加 startup API 类型 |
| `src/hooks/useWorkspaceDataLoader.ts` | Modify | emitStartupProgress 改为 IPC、数据就绪发 IPC |
| `src/App.tsx` | Modify | 删除 #splash DOM 操作，改由主进程 splash window 控制 |
| `index.html` | Modify | 删除 #splash div 和相关样式 |

---

### Task 1: 创建 Splash Window 模块

**Files:**
- Create: `electron/splash.ts`

- [ ] **Step 1: 创建 splash.ts**

```typescript
import { BrowserWindow, screen } from 'electron'

let splashWindow: BrowserWindow | null = null

const SPLASH_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  body {
    margin: 0; padding: 0; overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100vh;
    background: linear-gradient(160deg, hsl(220, 20%, 97%) 0%, hsl(0, 0%, 96%) 100%);
    color: hsl(0, 0%, 12%);
  }
  .spinner-row { display: flex; align-items: center; margin-bottom: 20px; }
  .spinner {
    width: 28px; height: 28px; border-radius: 50%;
    border: 3px solid hsla(220, 15%, 85%, 0.6); border-top-color: #3b82f6;
    animation: spin 0.8s linear infinite; margin-right: 12px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .progress-track {
    width: 180px; height: 3px; border-radius: 2px;
    background: hsla(220, 15%, 85%, 0.5); overflow: hidden;
  }
  .progress-bar {
    width: 0%; height: 100%; border-radius: 2px;
    background: linear-gradient(90deg, #3b82f6, #60a5fa);
    transition: width 0.3s ease;
  }
  .step-label { margin-top: 8px; font-size: 12px; color: hsl(0, 0%, 42%); }
  .credit { margin-top: 24px; font-size: 10px; color: hsl(0, 0%, 58%); }
</style>
</head>
<body>
  <div class="spinner-row">
    <div class="spinner"></div>
    <span style="font-weight:600;font-size:15px;letter-spacing:0.5px;">AlphaBase</span>
  </div>
  <div class="progress-track"><div class="progress-bar" id="bar"></div></div>
  <div class="step-label" id="label">正在启动...</div>
  <div class="credit">Created by UICO</div>
</body>
</html>`

export function createSplashWindow(): BrowserWindow {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
  const splashWidth = 400
  const splashHeight = 280

  splashWindow = new BrowserWindow({
    width: splashWidth,
    height: splashHeight,
    x: Math.round((screenWidth - splashWidth) / 2),
    y: Math.round((screenHeight - splashHeight) / 2),
    frame: false,
    transparent: false,
    resizable: false,
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(SPLASH_HTML)}`)
  splashWindow.on('closed', () => { splashWindow = null })
  return splashWindow
}

export function updateSplashProgress(step: string, progress: number, total: number): void {
  if (!splashWindow) return
  splashWindow.webContents.executeJavaScript(
    `document.getElementById('bar').style.width='${total > 0 ? (progress / total) * 100 : 0}%';document.getElementById('label').textContent='${step}'`
  )
}

export function closeSplashWindow(): void {
  if (!splashWindow) return
  splashWindow.close()
  splashWindow = null
}
```

- [ ] **Step 2: Commit**

```bash
git add electron/splash.ts
git commit -m "feat(electron): add Splash Window module with progress updates"
```

---

### Task 2: 修改 main.ts — 集成 Splash、优化 BrowserWindow 配置

**Files:**
- Modify: `electron/main.ts`

- [ ] **Step 1: 导入 splash 模块并添加 commandLine switch**

在 main.ts 顶部 `import` 区域添加：
```typescript
import { createSplashWindow, updateSplashProgress, closeSplashWindow } from './splash'
```

在已有的 `app.commandLine.appendSwitch` 行之后添加：
```typescript
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows', '1')
```

- [ ] **Step 2: 修改 createWindow — 添加 backgroundColor 和 backgroundThrottling**

在 `createWindow()` 的 BrowserWindow options 中：
- 添加 `backgroundColor: '#f5f5f4'`（与浅色主题背景一致）
- 在 `webPreferences` 中添加 `backgroundThrottling: false`

修改后的 BrowserWindow 创建：
```typescript
mainWindow = new BrowserWindow({
  width: 1200,
  height: 800,
  minWidth: 800,
  minHeight: 600,
  show: false,
  backgroundColor: '#f5f5f4',
  icon: join(__dirname, '..', 'build', 'icon.ico'),
  webPreferences: {
    preload: join(__dirname, 'preload.cjs'),
    contextIsolation: true,
    nodeIntegration: false,
    webviewTag: true,
    backgroundThrottling: false,
  },
  titleBarStyle: 'hidden',
})
```

- [ ] **Step 3: 删除 did-start-loading early-show**

删除以下整段代码：
```typescript
  // Show window early with splash screen if ready-to-show takes too long
  mainWindow.webContents.on('did-start-loading', () => {
    // Only show if not already visible (ready-to-show hasn't fired yet)
    if (!mainWindow?.isVisible()) {
      mainWindow?.show()
      __t2 = Date.now()
      console.log(`[startup] early-show (did-start-loading): ${__t2 - __t0}ms`)
    }
  })
```

- [ ] **Step 4: 修改 ready-to-show handler — 添加 splash 关闭逻辑**

将 `mainWindow.once('ready-to-show', ...)` 修改为：
```typescript
  mainWindow.once('ready-to-show', () => {
    __t2 = Date.now()
    console.log(`[startup] ready-to-show: ${__t2 - __t0}ms`)
    // Don't show main window yet — splash controls the transition
  })
```

- [ ] **Step 5: 在 app.whenReady 中创建 splash window**

在 `app.whenReady().then(() => { ... })` 的开头，`createWindow()` 之前添加：
```typescript
  const splash = createSplashWindow()
```

- [ ] **Step 6: 添加 startup-progress IPC handler**

在 `app.whenReady().then()` 的 IPC handlers 区域中添加：
```typescript
  ipcMain.on('startup:progress', (_event, data: { step: string; progress: number; total: number }) => {
    updateSplashProgress(data.step, data.progress, data.total)
  })

  ipcMain.on('startup:data-ready', () => {
    closeSplashWindow()
    mainWindow?.show()
    console.log(`[startup] splash→main transition: ${Date.now() - __t0}ms`)
  })
```

- [ ] **Step 7: Commit**

```bash
git add electron/main.ts
git commit -m "feat(electron): integrate Splash Window, add backgroundColor and backgroundThrottling"
```

---

### Task 3: onnxruntime-node 动态 import

**Files:**
- Modify: `electron/embedding/index.ts`
- Modify: `vite.config.ts`

- [ ] **Step 1: 检查当前 EmbeddingService 是否已是动态 import**

查看 `electron/embedding/index.ts` — 当前 `getService()` 已经使用 `await import('./EmbeddingService')`，但 `registerEmbeddingIPC` 中的 `import { EMBEDDING_ERRORS } from './EmbeddingService'` 是静态的。

将 `registerEmbeddingIPC` 中对 `EmbeddingService` 的引用全部改为通过 `getService()` 获取：

在 `embedding:indexAll` handler 中，将：
```typescript
const { EMBEDDING_ERRORS } = await import('./EmbeddingService')
return { error: EMBEDDING_ERRORS.NOT_INITIALIZED }
```
改为：
```typescript
return { error: 'NOT_INITIALIZED' }
```

这样 `index.ts` 不再有任何静态 import 引用 EmbeddingService。

- [ ] **Step 2: 在 vite.config.ts 的 Electron main entry 中确认 onnxruntime-node 是 external**

确认 `rollupOptions.external` 包含 `'onnxruntime-node'`（已存在，无需修改）。

- [ ] **Step 3: Commit**

```bash
git add electron/embedding/index.ts
git commit -m "refactor(embedding): remove static import of EmbeddingService from index.ts"
```

---

### Task 4: 修改 preload.ts — 添加 startup IPC listeners

**Files:**
- Modify: `electron/preload.ts`
- Modify: `src/types/electron-api.d.ts`

- [ ] **Step 1: 在 preload.ts 的 electronAPI 中添加 startup listeners**

在 `startup` 区域之后添加两个新 listener：
```typescript
  startup: {
    log: (data: any) => ipcRenderer.invoke('startup:log', data),
    onProgress: (callback: (data: { step: string; progress: number; total: number }) => void) => {
      const handler = (_e: any, data: any) => callback(data)
      ipcRenderer.on('startup:progress', handler)
      return () => ipcRenderer.removeListener('startup:progress', handler as any)
    },
    onDataReady: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('startup:data-ready', handler)
      return () => ipcRenderer.removeListener('startup:data-ready', handler as any)
    },
  },
```

同时删除旧的 `startup: { log: ... }` 部分（只保留 log，不删除它）。

实际上完整的 `startup` 区域变为：
```typescript
  startup: {
    log: (data: any) => ipcRenderer.invoke('startup:log', data),
    onProgress: (callback: (data: { step: string; progress: number; total: number }) => void) => {
      const handler = (_e: any, data: any) => callback(data)
      ipcRenderer.on('startup:progress', handler)
      return () => ipcRenderer.removeListener('startup:progress', handler as any)
    },
    notifyProgress: (data: { step: string; progress: number; total: number }) => {
      ipcRenderer.send('startup:progress', data)
    },
    notifyDataReady: () => {
      ipcRenderer.send('startup:data-ready')
    },
  },
```

- [ ] **Step 2: 更新 electron-api.d.ts 类型**

在 `startup` 区域添加新方法类型：
```typescript
  startup: {
    log: (data: { totalMs: number; steps: { name: string; ms: number }[] }) => Promise<boolean>
    onProgress: (callback: (data: { step: string; progress: number; total: number }) => void) => () => void
    notifyProgress: (data: { step: string; progress: number; total: number }) => void
    notifyDataReady: () => void
  }
```

- [ ] **Step 3: Commit**

```bash
git add electron/preload.ts src/types/electron-api.d.ts
git commit -m "feat(electron): add startup progress/data-ready IPC in preload"
```

---

### Task 5: 修改渲染进程 — emitStartupProgress 改为 IPC

**Files:**
- Modify: `src/hooks/useWorkspaceDataLoader.ts`
- Modify: `src/App.tsx`
- Modify: `index.html`

- [ ] **Step 1: 修改 useWorkspaceDataLoader.ts 的 emitStartupProgress**

将现有函数：
```typescript
function emitStartupProgress(step: string, progress: number, total: number) {
  const emit = useEventBus.getState().emit
  emit('startup-progress', { step, progress, total })
  const bar = document.getElementById('splash-bar')
  const label = document.getElementById('splash-label')
  if (bar) bar.style.width = `${total > 0 ? (progress / total) * 100 : 0}%`
  if (label) label.textContent = step
}
```
改为：
```typescript
function emitStartupProgress(step: string, progress: number, total: number) {
  const electronAPI = (window as any).electronAPI
  if (electronAPI?.startup?.notifyProgress) {
    electronAPI.startup.notifyProgress({ step, progress, total })
  }
}
```

- [ ] **Step 2: 数据就绪时发送 data-ready IPC**

在 `loadWorkspaceData` 末尾，`setDataReady(true)` 之后添加：
```typescript
    const electronAPI = (window as any).electronAPI
    if (electronAPI?.startup?.notifyDataReady) {
      electronAPI.startup.notifyDataReady()
    }
```

同时，在 demo mode 分支的 `setDataReady(true)` 之后也添加：
```typescript
    const electronAPI = (window as any).electronAPI
    if (electronAPI?.startup?.notifyDataReady) {
      electronAPI.startup.notifyDataReady()
    }
```

- [ ] **Step 3: 修改 App.tsx — 删除 #splash DOM 操作**

在 App.tsx 中删除以下 useEffect：
```typescript
  // Hide splash when data is ready (must be before early return)
  useEffect(() => {
    if (!dataReady) return
    const splash = document.getElementById('splash')
    if (splash) {
      splash.classList.add('fade-out')
      setTimeout(() => splash.remove(), 350)
    }
    preloadCardEditor()
  }, [dataReady])
```

替换为只保留 preloadCardEditor 的逻辑：
```typescript
  useEffect(() => {
    if (!dataReady) return
    preloadCardEditor()
  }, [dataReady])
```

- [ ] **Step 4: 修改 index.html — 删除 #splash div 及相关样式**

删除 `<body>` 中的整个 `#splash` div 及其子元素：
```html
    <div id="splash">
      ...全部内容...
    </div>
```

删除 `<style>` 中所有 `#splash` 相关的 CSS 规则（从 `/* Splash screen */` 开始到 `.credit` 的所有规则）。

删除 `<script>` 中应用主题的内联脚本（splash 需要它，但现在 splash 已移到主进程，renderer 的主题由 React 控制）。实际上保留这段脚本——React 组件也需要主题，但如果 App.tsx 已经有 `useIsDarkMode` hook 控制主题，可以保留此脚本确保初始渲染不闪烁。

**保留**：主题切换的内联 `<script>`（防止 React hydration 前闪烁）。
**删除**：所有 `#splash` CSS 和 HTML。

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useWorkspaceDataLoader.ts src/App.tsx index.html
git commit -m "refactor(renderer): replace #splash DOM with IPC-based Splash Window"
```

---

### Task 6: Dev 模式 disk_cache 修复

**Files:**
- Modify: `electron/main.ts`

- [ ] **Step 1: 在 app.whenReady 前设置 disk-cache-dir**

在 `app.commandLine.appendSwitch` 区域添加：
```typescript
// Fix GPU disk cache permission errors on Windows
app.commandLine.appendSwitch('disk-cache-dir', join(app.getPath('userData'), 'cache'))
```

注意：`app.getPath('userData')` 在 `app.whenReady` 前不可用。改为使用硬编码路径或延迟到 `app.whenReady` 后设置。

实际上 `app.commandLine.appendSwitch` 必须在 `app.whenReady` 前调用。解决方案：使用 `app.setPath('userData')` 确保默认值正确，或在 `commandLine` 中使用相对路径。

更安全的做法——直接在 `app.whenReady().then()` 中清理 cache：
```typescript
  // Clean stale GPU cache to prevent permission errors
  const cacheDir = join(app.getPath('userData'), 'GPUCache')
  try { await rm(cacheDir, { recursive: true, force: true }) } catch { /* ignore */ }
```

这会在每次启动时清理 GPU 缓存，防止权限错误。但这可能导致首次渲染稍慢（GPU shader 需重新编译）。

更好的方案是只在检测到错误时清理。简单方案：只添加 `commandLine` switch，让 Electron 使用正确的缓存路径。

```typescript
app.commandLine.appendSwitch('disk-cache-size', '104857600')
```

这个不解决权限问题，但限制缓存大小。暂时跳过此步骤，disk_cache 错误只在 dev 模式出现，打包 exe 不受影响。

- [ ] **Step 2: Commit（如有改动）**

如果跳过了 disk_cache 修复，不需要单独 commit。

---

### Task 7: 构建验证和性能测试

**Files:**
- None

- [ ] **Step 1: 确认 TypeScript 编译通过**

```bash
npx tsc --noEmit
```
Expected: 只剩 EmbeddingService 的无问题警告（已修复），0 errors

- [ ] **Step 2: 确认生产构建成功**

```bash
pnpm build
```
Expected: 成功构建，输出到 dist/

- [ ] **Step 3: 启动生产 Electron 测量启动时间**

```bash
# 清理旧报告
rm -f "$APPDATA/heptabase-canvas-v2/startup-report.json"

# 启动 Electron（30s 后自动关闭）
node -e "
const { spawn } = require('child_process');
const { resolve } = require('path');
const { createRequire } = require('module');
delete process.env.ELECTRON_RUN_AS_NODE;
delete process.env.VITE_DEV_SERVER_URL;
const electronPath = createRequire(require.resolve('./package.json'))('electron');
const child = spawn(electronPath, [resolve(__dirname)], { stdio: 'inherit', env: { ...process.env } });
setTimeout(() => { child.kill(); process.exit(0); }, 30000);
"

# 读取报告
cat "$APPDATA/heptabase-canvas-v2/startup-report.json"
```

Expected: app.whenReady <2s, splash 出现 <0.5s, 主窗口可见 <5s

- [ ] **Step 4: 测试最小化恢复**

手动测试：最小化 → 等待 30 秒 → 恢复 → 确认无白屏

- [ ] **Step 5: Push**

```bash
git push
```

---

## Self-Review

**1. Spec coverage:**
- ✅ Splash Window → Task 1 + Task 2 + Task 4 + Task 5
- ✅ onnxruntime 动态 import → Task 3
- ✅ backgroundColor + backgroundThrottling → Task 2
- ✅ disable-backgrounding-occluded-windows → Task 2
- ✅ 删除 early-show → Task 2
- ✅ 最小化恢复白屏 → Task 2 (backgroundThrottling + commandLine switch)
- ⚠️ Dev 模式 disk_cache → Task 6 (暂跳过，只影响 dev)

**2. Placeholder scan:** 无 TBD/TODO/待定

**3. Type consistency:** `notifyProgress` 和 `notifyDataReady` 在 preload.ts 和 electron-api.d.ts 中签名一致