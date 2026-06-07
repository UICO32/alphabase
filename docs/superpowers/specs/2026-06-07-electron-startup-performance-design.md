# Electron 启动性能优化设计

日期: 2026-06-07

## 问题

用户点击应用图标后，窗口出现慢（生产构建 11.5s），且从白屏到加载态也有明显延迟。最小化/切换窗口后恢复时出现长时间白屏。

## 当前启动时间线

### 生产构建（实测 2026-06-07，demo 模式）

| 阶段 | 耗时 | 占比 |
|------|------|------|
| main process → app.whenReady | 4815ms | 26% |
| app.whenReady → ready-to-show | 6644ms | 36% |
| ready-to-show → dataReady | 6745ms | 37% |
| **总计** | **18204ms** | |

### Dev 模式

| 阶段 | 耗时 |
|------|------|
| app.whenReady | 74ms |
| ready-to-show | 316ms |
| did-finish-load | 63641ms |
| 数据就绪 | 63790ms |

Dev 模式异常慢，且出现大量 `disk_cache` 权限错误。

## 瓶颈分析

1. **app.whenReady 4.8s**：onnxruntime-node 静态 import 被 Rollup 打包进 main.cjs，主进程启动时同步加载
2. **窗口可见 11.5s**：当前 `did-start-loading` 时立即 `show()`，但此时渲染进程还在加载 JS，导致白屏
3. **JS 加载慢**：blocknote (946KB) + xyflow (324KB) 等大 chunk 需要解析
4. **最小化恢复白屏**：Windows 上 Electron GPU 进程被回收，恢复时需重新光栅化

## 设计

### 1. 独立 Splash Window

用独立 BrowserWindow 替代 `index.html` 中的 `#splash` div。

**主进程（main.ts）**：
- `createWindow()` 时主窗口 `show: false`
- 创建 splash window（固定大小 400x300，居中，frame: false）
- splash 加载内联 HTML（~2KB，品牌 logo + spinner + 进度条）
- 监听 `startup-progress` IPC，更新 splash 进度条
- 收到 `data-ready` IPC 后：splash 淡出 → 主窗口 show → splash 关闭

**渲染进程（useWorkspaceDataLoader.ts）**：
- `emitStartupProgress()` 改为通过 IPC 发送给主进程
- 数据就绪时发送 `startup:data-ready` IPC

**splash HTML**：从 `index.html` 的 `#splash` 样式提取，内联到 main.ts 中作为 data URL

### 2. onnxruntime-node 动态 import

**electron/embedding/index.ts**：
```typescript
export function registerEmbeddingIPC() {
  import('./EmbeddingService').then(m => m.registerHandlers())
}
```

**vite.config.ts**：
- 确认 `onnxruntime-node` 在 `rollupOptions.external` 中（已存在）
- EmbeddingService 作为独立 chunk 输出，main.cjs 不再包含它

### 3. BrowserWindow 配置优化

**main.ts createWindow()**：
```typescript
mainWindow = new BrowserWindow({
  // ...existing...
  show: false,
  backgroundColor: '#f5f5f4', // 浅色主题默认背景色；深色模式下 splash window 覆盖此阶段
  webPreferences: {
    // ...existing...
    backgroundThrottling: false, // 防止最小化后被 throttled
  },
})
```

**app.commandLine 追加**：
```typescript
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows', '1')
```

**删除 did-start-loading early-show**：
- 移除 `mainWindow.webContents.on('did-start-loading', ...)` 中的 `mainWindow?.show()`
- 窗口显示由 splash→主窗口切换逻辑控制

### 4. 最小化恢复白屏修复

- `backgroundThrottling: false`（已在第 3 步）
- `disable-backgrounding-occluded-windows`（已在第 3 步）
- 监听 `mainWindow.on('restore', ...)` 事件，强制重绘

### 5. Dev 模式 disk_cache 修复

`Unable to move the cache: 拒绝访问` 错误说明 GPU 缓存目录权限问题。

- 在 `app.whenReady` 前设置 `app.setPath('userData', ...)` 确保路径正确
- 或在 `app.commandLine` 中添加 `--disk-cache-dir` 指定可写路径

## 目标效果

| 指标 | 当前 | 目标 |
|------|------|------|
| app.whenReady | 4.8s | ~1.5s |
| Splash 出现 | - | <0.5s |
| 主窗口可见 | 11.5s | 3-5s |
| 完全就绪 | 18.2s | 8-10s |
| 最小化恢复白屏 | 明显 | 无 |

## 不在范围内

- BlockNote/xyflow chunk 拆分（第二阶段优化）
- 工作区数据加载优化（当前 1.4s 已足够快）
- 打包体积优化
