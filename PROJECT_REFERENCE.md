# Heptabase Canvas 项目技术参考文档

> 本文档供新项目开发参考，记录老项目的功能、架构、数据格式和可复用实现。
> 老项目技术栈：React 18 + tldraw 3 + BlockNote + Zustand 5 + Electron + Vite + Tailwind CSS 4

---

## 目录

1. [项目概述](#1-项目概述)
2. [核心功能](#2-核心功能)
3. [技术架构](#3-技术架构)
4. [数据格式规范](#4-数据格式规范)
5. [状态管理](#5-状态管理)
6. [文件系统层](#6-文件系统层)
7. [画布实现（tldraw 相关）](#7-画布实现tldraw-相关)
8. [卡片编辑器](#8-卡片编辑器)
9. [连接线与布局](#9-连接线与布局)
10. [主题系统](#10-主题系统)
11. [可复用模块清单](#11-可复用模块清单)
12. [已知问题与教训](#12-已知问题与教训)
13. [迁移建议](#13-迁移建议)

---

## 1. 项目概述

Heptabase Canvas 是一个基于画布的知识管理应用，核心概念：

- **工作区（Workspace）**：一个本地文件夹，包含所有数据
- **画板（Board）**：一个画布，包含卡片的位置和连接关系
- **卡片（Card）**：富文本笔记单元，使用 BlockNote 编辑器
- **连接线（Connection）**：卡片之间的有向连线
- **分区（Section）**：画板上的分组区域

支持双模式运行：
- **Electron 模式**：完整文件系统访问，通过 IPC 通信
- **Web 模式**：使用 File System Access API，降级到 IndexedDB

---

## 2. 核心功能

### 2.1 工作区管理
- 打开/创建工作区文件夹
- 自动恢复上次打开的工作区
- 工作区切换（原地切换，不刷新页面）
- 最近工作区列表

### 2.2 画板管理
- 多画板支持，左侧栏切换
- 画板 CRUD（创建、重命名、删除）
- 画板快照保存/恢复
- 画板库视图（所有画板缩略图）

### 2.3 卡片系统
- 画布双击创建卡片
- 富文本编辑（BlockNote）
- 卡片颜色（6 种）和变体（solid/glass/outline）
- 卡片折叠/展开
- 固定高度/自动高度
- 从卡片库拖拽到画布
- 卡片回收站（30 天过期）

### 2.4 连接线
- 卡片间创建连接（点击连接按钮 → 点击目标卡片）
- 自动计算贝塞尔曲线路径
- 箭头头部
- 连接随卡片移动自动更新
- 虚线样式

### 2.5 编辑器功能
- BlockNote 富文本编辑
- 图片粘贴/拖拽上传
- 标签提取（`#标签名` 格式）
- AI 辅助功能（续写、润色、翻译）
- 卡片内搜索

### 2.6 视图模式
- 画布模式（board）
- 卡片库模式（cards）
- 画板库模式（boardLibrary）
- 缩放适配（远距缩小显示简化视图）

### 2.7 数据同步
- Zustand store 变更 → 文件系统自动保存
- 卡片 debounce 500ms
- 画板 debounce 600ms
- 设置 debounce 300ms
- 页面关闭前 flush 所有待写入

### 2.8 导入导出
- Markdown 导入（兼容旧格式）
- 卡片 JSON 导出
- 工作区备份（IndexedDB，保留 10 份）

---

## 3. 技术架构

### 3.1 目录结构

```
src/
  main.tsx                    # React 入口
  App.tsx                     # 根组件（全局事件监听、缩放阻止）
  components/
    canvas/                   # 画布核心（tldraw 相关，需重写）
      TldrawCanvas.tsx        # 画布主组件
      CardShapeUtil.tsx       # 卡片形状定义
      ConnectionShapeUtil.tsx # 连接线形状定义
      SectionFrameShapeUtil.tsx # 分区形状定义
      CardShapeComponent.tsx  # 卡片渲染组件
      CardPortalLayer.tsx     # Portal 渲染层
      CardPlaceholder.tsx     # 卡片占位符
      ConnectionPreviewOverlay.tsx # 连接预览
      card/                   # 卡片子逻辑
        useClickToEdit.ts     # 点击编辑逻辑
        useCardConnection.ts  # 连接创建逻辑
        useCardLayout.ts      # 布局/高度自适应
        useCardMenu.ts        # 右键菜单
        useCardDelete.ts      # 删除逻辑
        cardHelpers.ts        # 辅助函数
    editor/                   # BlockNote 编辑器
      BlockNoteEditor.tsx     # 主编辑器组件
      CustomBasicTextStyleButton.tsx
      ImageToolbar.tsx
      DragOnlySideMenu.tsx
      useImageColumnDrop.ts
    ui/                       # UI 面板
      LeftPanel.tsx           # 左侧栏（画板列表、视图切换）
      Toolbar.tsx             # 顶部工具栏
      SettingsDialog.tsx      # 设置弹窗
      SettingsPopover.tsx     # 设置浮层
      WorkspacePicker.tsx     # 工作区选择器
      FullScreenPanel.tsx     # 全屏面板
      TrashBinPanel.tsx       # 回收站面板
      CardEditModal.tsx       # 卡片编辑弹窗
      CardLibraryView.tsx     # 卡片库视图
      BoardLibraryView.tsx    # 画板库视图
      FPSMonitor.tsx          # 性能监控（DEV）
  hooks/                      # 画布相关 hooks
    useWorkspaceLifecycle.ts  # 工作区生命周期
    useBoardSync.ts           # 画板同步引擎绑定
    useCanvasPaste.ts         # 粘贴处理
    useCanvasDoubleClick.ts   # 双击创建卡片
    useConnectionSync.ts      # 连接线同步
    useDropHandler.ts         # 拖拽处理
    useCardActions.ts         # 卡片操作
  services/
    WorkspaceService.ts       # 工作区服务（文件操作）
    WorkspaceContext.tsx      # 工作区 React Context
  utils/
    workspace/                # 工作区文件系统
      fs.ts                   # 文件系统抽象
      fs-adapter.ts           # Electron/Web 适配器
      syncEngine.ts           # 同步引擎
      cardConverter.ts        # 卡片序列化/反序列化
      types.ts                # 工作区类型定义
      workspaceStore.ts       # 工作区 UI 状态
      workspaceManager.ts     # 兼容层（已废弃）
      migration.ts            # IndexedDB 迁移
      index.ts                # 导出汇总
    cardStore.ts              # 卡片状态（Zustand）
    boardStore.ts             # 画板状态（Zustand）
    libraryStore.ts           # 视图模式状态（Zustand）
    trashStore.ts             # 回收站状态（Zustand）
    portalStore.ts            # Portal 位置状态（Zustand）
    newCardStore.ts           # 新卡片/连接/拖拽临时状态
    backupStore.ts            # 备份管理（IndexedDB）
    renderBlocks.ts           # BlockNote JSON → HTML 预览
    api.ts                    # 全局 API（window.heptabaseAPI）
    zoomContext.ts            # 缩放状态共享
    tldrawHelpers.ts          # tldraw 辅助函数
    tagExtractor.ts           # 标签提取
    db.ts                     # IndexedDB（已废弃）
  types/
    card.ts                   # 卡片类型定义
    connection.ts             # 连接线类型定义
  theme/
    panelSurface.ts           # 面板主题色
    cardVariantStyles.ts      # 卡片变体样式
electron/
  main.ts                   # Electron 主进程
  preload.ts                # contextBridge API 暴露
  menu.ts                   # 菜单栏
```

### 3.2 核心数据流

```
启动流程：
CanvasInner → workspaceManager.tryRestoreLastWorkspace()
  → 恢复成功 → loadWorkspaceToStore() → 加载卡片到 cardStore
  → 加载画板列表 → 加载首个画板 snapshot → editor.loadSnapshot()
  → 启动 WorkspaceSyncEngine → 监听 store 变更

画板切换：
hepta-switch-board 事件 → 保存当前画板 → 加载目标画板 snapshot
  → editor.loadSnapshot()

工作区切换：
hepta-switch-workspace 事件 → performFullWorkspaceSwitch()
  → 停止旧 syncEngine → 清空 canvas → 加载新数据 → 启动新引擎

同步流程：
cardStore / editor.store 变更 → WorkspaceSyncEngine 监听
  → debounce → 写入文件系统（cards/*.json, boards/*.json）
```

### 3.3 技术栈依赖

```json
{
  "核心框架": "React 18.3 + TypeScript 5.6",
  "构建工具": "Vite 5.4 + vite-plugin-electron",
  "画布引擎": "tldraw 3.0（待替换）",
  "富文本编辑": "BlockNote 0.31 (@blocknote/core + mantine + react)",
  "状态管理": "Zustand 5.0",
  "样式": "Tailwind CSS 4.2",
  "桌面端": "Electron 35 + electron-builder 25",
  "图标": "lucide-react + @phosphor-icons/react",
  "IndexedDB": "idb 8.0",
  "测试": "Playwright 1.59"
}
```

---

## 4. 数据格式规范

### 4.1 工作区目录结构

```
workspace/
  boards/
    _manifest.json          # 画板列表元数据
    <uuid>.json             # 画板快照（tldraw snapshot，需迁移）
  cards/
    <uuid>.json             # 卡片数据
  settings.json             # 工作区设置
  trash/
    <uuid>.trash.json       # 已删除卡片
  .heptabase/media/         # 媒体文件
```

### 4.2 卡片文件格式（cards/<uuid>.json）

```typescript
interface CardFile {
  id: string                    // 卡片唯一 ID
  title: string                 // 从内容提取的标题（前 120 字符）
  color: CardColor              // 'white' | 'yellow' | 'blue' | 'green' | 'pink' | 'purple'
  variant: CardVariant          // 'solid' | 'glass' | 'outline'
  createdAt: number             // 创建时间戳
  content: string               // BlockNote JSON 字符串
  enforceInitialHeading?: boolean // 强制首行为标题
  fixedHeight?: boolean         // 固定高度
  collapsed?: boolean           // 折叠状态
  tags?: string[]               // 标签列表
  updatedAt?: number            // 更新时间戳
}
```

示例：
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "我的笔记标题",
  "color": "blue",
  "variant": "solid",
  "createdAt": 1704067200000,
  "content": "[{\"type\":\"heading\",\"props\":{\"level\":2},\"content\":[{\"type\":\"text\",\"text\":\"标题\"}]}]",
  "enforceInitialHeading": true,
  "tags": ["重要", "待办"]
}
```

### 4.3 画板清单（boards/_manifest.json）

```typescript
interface BoardManifest {
  boards: BoardMeta[]
}

interface BoardMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}
```

### 4.4 画板快照（boards/<uuid>.json）— 需迁移格式

当前为 tldraw snapshot 格式，包含：
- `store`：所有形状数据（卡片、连接线、分区）
- `schema`：tldraw schema 版本

**迁移目标**：React Flow 的 nodes + edges 格式

```typescript
// 建议的新格式
interface BoardSnapshot {
  version: 2
  nodes: Node[]
  edges: Edge[]
  viewport: { x: number; y: number; zoom: number }
}

interface Node {
  id: string
  type: 'card' | 'section'
  position: { x: number; y: number }
  data: {
    cardId?: string        // 关联的卡片 ID
    color?: CardColor
    variant?: CardVariant
    collapsed?: boolean
    fixedHeight?: boolean
    width?: number
    height?: number
  }
}

interface Edge {
  id: string
  source: string          // 源节点 ID
  target: string          // 目标节点 ID
  type: 'connection'
}
```

### 4.5 回收站文件（trash/<uuid>.trash.json）

```typescript
interface TrashCardData {
  id: string
  content: string
  color: CardColor
  variant: CardVariant
  createdAt: number
  deletedAt: number
  expiresAt: number        // deletedAt + 30天
  shapeX: number           // 删除时的位置
  shapeY: number
  shapeW: number
  shapeH: number
}
```

### 4.6 设置文件（settings.json）

```typescript
interface WorkspaceSettings {
  isGridMode?: boolean
  gridSize?: number
  snapToGrid?: boolean
  theme?: 'light' | 'dark' | 'system'
  ui?: {
    rightPanelWidth?: number
    leftPanelCollapsed?: boolean
  }
}
```

---

## 5. 状态管理

### 5.1 Zustand Store 列表

| Store | 文件 | 职责 | 是否可复用 |
|-------|------|------|-----------|
| `useCardStore` | `cardStore.ts` | 卡片 CRUD、previewHTML 缓存 | ✅ 完全复用 |
| `useBoardStore` | `boardStore.ts` | 画板列表 + 活动画板 | ✅ 完全复用 |
| `useLibraryStore` | `libraryStore.ts` | 视图模式、侧栏状态 | ✅ 完全复用 |
| `useTrashStore` | `trashStore.ts` | 回收站卡片管理 | ✅ 完全复用 |
| `useWorkspaceStore` | `workspace/workspaceStore.ts` | 工作区 UI 状态 | ✅ 完全复用 |
| `usePortalStore` | `portalStore.ts` | Portal 位置同步 | ❌ 废弃 |

### 5.2 cardStore 关键实现

```typescript
// 核心特性：
// 1. 自动渲染 previewHTML（用于卡片预览态）
// 2. 支持 workspace 模式（抑制 IndexedDB 写入）
// 3. 批量导入/替换

interface CardStore {
  cards: Record<string, GlobalCard>
  isLoaded: boolean
  addCard: (card: GlobalCard) => void
  updateCard: (id: string, props: Partial<GlobalCard>) => void
  deleteCard: (id: string) => void
  importCards: (cards: Record<string, GlobalCard>) => void
  replaceAllCards: (cards: Record<string, GlobalCard>) => void
  loadCardsFromDB: () => Promise<void>
}

// previewHTML 在 add/update 时自动通过 renderBlocks() 生成
// 用于卡片非编辑态的快速渲染，避免挂载完整 BlockNote 编辑器
```

### 5.3 工作区模式切换

```typescript
// 进入 workspace 模式时抑制 IndexedDB 写入
enableWorkspaceMode()  // suppressPersistence = true

// 退出 workspace 模式时恢复
disableWorkspaceMode() // suppressPersistence = false
```

---

## 6. 文件系统层

### 6.1 架构设计

```
WorkspaceFileSystem (fs.ts)
  ├── Electron 模式 → fs-adapter.ts → Electron IPC → main.ts
  └── Web 模式 → File System Access API
```

### 6.2 关键类：WorkspaceFileSystem

```typescript
class WorkspaceFileSystem {
  // 生命周期
  async pickAndOpen(): Promise<{ name: string; handle?: FileSystemDirectoryHandle } | null>
  async setRootPath(dirPath: string): Promise<void>  // Electron 专用
  async tryRestoreLastWorkspace(): Promise<boolean>

  // 文件操作
  async readTextFile(path: string): Promise<string | null>
  async writeTextFile(path: string, content: string): Promise<void>
  async listFiles(dir: string, ext?: string): Promise<string[]>
  async deleteFile(path: string): Promise<void>
  async ensureDirExists(dir: string): Promise<void>

  // 媒体
  async saveMedia(filename: string, blob: Blob): Promise<void>
  async loadMedia(filename: string): Promise<string | null>  // dataUrl
}
```

### 6.3 Electron IPC 接口

```typescript
// preload.ts 暴露的 API
interface ElectronFS {
  showDirectoryPicker: () => Promise<{ path: string; name: string } | null>
  pathExists: (filePath: string) => Promise<boolean>
  readTextFile: (filePath: string) => Promise<string | null>
  writeTextFile: (filePath: string, content: string) => Promise<void>
  listFiles: (dirPath: string, ext?: string) => Promise<string[]>
  deleteFile: (filePath: string) => Promise<void>
  ensureDir: (dirPath: string) => Promise<void>
  readBlob: (filePath: string) => Promise<{ data: string; mime: string } | null>
  writeBlob: (filePath: string, base64: string) => Promise<void>
  readClipboardImages: () => Promise<string[]>
  writeClipboardImage: (dataUrl: string) => Promise<void>
  openPath: (dirPath: string) => Promise<string>
}
```

### 6.4 同步引擎：WorkspaceSyncEngine

```typescript
class WorkspaceSyncEngine {
  // 配置
  setBoardSnapshotProvider(fn: () => unknown): void
  setBoardSnapshotDataProvider(fn: () => { snapshot: unknown; boardId: string | null }): void
  setCardStoreProvider(fn: () => Record<string, GlobalCard>): void

  // 订阅
  subscribeToCardStore(store: CardStore): () => void    // 监听卡片变更
  subscribeToBoard(store: { listen: (fn: () => void) => () => void }): () => void  // 监听画板变更
  subscribeToSettings(getSettings: () => Record<string, unknown>): () => void  // 监听设置变更

  // 控制
  start(): void
  stop(): void
  async flushAll(): Promise<void>  // 立即写入所有待保存数据
}
```

**同步策略**：
- 卡片：debounce 500ms，检测删除（store 中消失 → 删除文件）
- 画板：debounce 600ms
- 设置：轮询 1s + debounce 300ms
- 页面关闭前：flushAll()

---

## 7. 画布实现（tldraw 相关）

> ⚠️ 本章节的 tldraw 实现需在新项目中完全重写为 React Flow

### 7.1 当前架构问题

```
TldrawCanvas
  ├── Tldraw 组件（shapeUtils + components）
  ├── CanvasInner（hooks 组合）
  │   ├── useWorkspaceLifecycle  # 工作区生命周期
  │   ├── useBoardSync           # 同步引擎绑定
  │   ├── useCanvasPaste         # 粘贴处理
  │   ├── useCanvasDoubleClick   # 双击创建
  │   ├── useConnectionSync      # 连接线同步
  │   └── useDropHandler         # 拖拽处理
  └── CardPortalLayer（rAF 循环同步位置）
```

**核心问题**：
1. BlockNote 编辑器通过 React Portal 渲染到 document.body，与 tldraw Canvas 分离
2. 需要 rAF 循环同步 Portal 位置与 tldraw 相机
3. tldraw 状态机和 BlockNote 编辑器频繁冲突
4. 自定义 ShapeUtil 扩展复杂，新增组件类型成本高

### 7.2 Portal 渲染机制（新项目无需此 workaround）

```typescript
// 当前实现：编辑器通过 Portal 渲染到 body
// 原因：tldraw 的 HTMLContainer 会拦截事件，导致编辑器无法正常工作

// rAF 循环同步位置
useEffect(() => {
  let rafId = 0
  const tick = () => {
    const camera = editor.getCamera()
    for (const shapeId of shapeIds) {
      const pageBounds = editor.getShapePageBounds(asShapeId(shapeId))
      const screenPoint = editor.pageToScreen({ x: pageBounds.minX, y: pageBounds.minY })
      updatePortalRect(shapeId, {
        x: screenPoint.x, y: screenPoint.y,
        width: shape.props.w, height: shape.props.h,
        scale: camera.z,
      })
    }
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(rafId)
}, [editor])
```

### 7.3 卡片 ShapeUtil

```typescript
class CardShapeUtil extends ShapeUtil<CardShape> {
  static type = 'card'
  static props = {
    w: T.number,
    h: T.number,
    cardId: T.string,
    collapsed: T.boolean.optional(),
    fixedHeight: T.boolean.optional(),
  }

  // 关键行为
  canEdit() { return false }     // 自定义编辑逻辑
  canResize() { return !collapsed }
  onResize(shape, info) {
    // 限制尺寸范围：宽度 160-800，高度 100-1800
  }
}
```

### 7.4 连接线 ShapeUtil

```typescript
class ConnectionShapeUtil extends ShapeUtil<ConnectionShape> {
  static type = 'connection'
  static props = {
    fromShapeId: T.string,
    toShapeId: T.string,
    startX/Y, cp1X/Y, cp2X/Y, endX/Y,  // 贝塞尔曲线控制点
    w, h,
  }

  // 几何：CubicBezier2d
  // 渲染：SVG path + 箭头头部
}
```

### 7.5 分区 ShapeUtil

```typescript
// 继承自 FrameShapeUtil，自定义颜色主题
// 支持双击编辑名称
// 12 种颜色主题
```

---

## 8. 卡片编辑器

### 8.1 BlockNoteEditor 组件

```typescript
interface BlockNoteEditorProps {
  content: string                    // BlockNote JSON 字符串
  onChange: (content: string) => void
  onFocus?: () => void
  onBlur?: () => void
  theme?: 'light' | 'dark'
  editable?: boolean
  showSideMenu?: boolean
  enforceInitialHeading?: boolean
  maxBlocks?: number                 // 预览态限制渲染块数
}

interface BlockNoteEditorHandle {
  focus: () => void
  blur: () => void
  setEditable: (editable: boolean) => void
  setContent: (json: string) => void
  focusAtCoords: (point: { x: number; y: number }) => void
  getProsemirrorView: () => { state: { selection: {...}, doc: {...} } } | null
}
```

### 8.2 关键实现模式

**预览态 vs 编辑态**：
- 预览态：使用 `renderBlocks()` 生成静态 HTML，不挂载 BlockNote
- 编辑态：挂载完整 BlockNote 编辑器
- 切换条件：卡片被选中 + 点击 → 进入编辑态

**高度自适应**：
```typescript
// 使用 ResizeObserver 监听编辑器内容高度
// 自动更新 shape 的 h 属性
// 限制范围：MIN_AUTO_CARD_HEIGHT (120) ~ MAX_AUTO_CARD_HEIGHT (800)
// 用户手动 resize 后 500ms 内不触发自适应
```

**保存防抖**：
```typescript
const SAVE_DEBOUNCE_MS = 400
// 编辑器 onChange → debounce → 更新 cardStore → 触发 syncEngine → 写入文件
```

### 8.3 图片处理

```typescript
// 1. 粘贴/拖拽图片 → FileReader 读取为 dataUrl
// 2. 如果在 workspace 模式：保存到 .heptabase/media/
// 3. 在 BlockNote 中插入 image block（url 为 dataUrl 或相对路径）
// 4. 图片缩放：sharp（Electron）或浏览器 Canvas（Web）
```

---

## 9. 连接线与布局

### 9.1 连接线路由算法

```typescript
// 文件：utils/connectionLayout.ts

interface ConnectionLayout {
  x: number        // 连接形状左上角 x
  y: number        // 连接形状左上角 y
  props: {
    startX, startY,    // 起点（相对于形状）
    cp1X, cp1Y,        // 控制点 1
    cp2X, cp2Y,        // 控制点 2
    endX, endY,        // 终点
    w, h               // 形状包围盒
  }
}

function computeConnectionLayout(sourceBounds, targetBounds, fromShapeId, toShapeId): ConnectionLayout {
  // 1. 确定主导方向（水平/垂直）
  const horizontalDominant = Math.abs(dx) >= Math.abs(dy)

  // 2. 计算起点（源形状边缘）
  const start = horizontalDominant
    ? { x: dx >= 0 ? sourceBounds.maxX : sourceBounds.minX, y: sourceCenter.y }
    : { x: sourceCenter.x, y: dy >= 0 ? sourceBounds.maxY : sourceBounds.minY }

  // 3. 计算终点（目标形状边缘）
  const end = horizontalDominant
    ? { x: dx >= 0 ? targetBounds.minX : targetBounds.maxX, y: targetCenter.y }
    : { x: targetCenter.x, y: dy >= 0 ? targetBounds.minY : targetBounds.maxY }

  // 4. 控制点偏移量（根据距离动态计算）
  const offset = clampCurveOffset(dx, dy)  // 40 ~ 120px

  // 5. 构建贝塞尔曲线
  // M startX startY C cp1X cp1Y, cp2X cp2Y, endX endY
}
```

### 9.2 连接线同步

```typescript
// useConnectionSync：监听形状移动，自动更新连接线

function syncConnections(editor) {
  // 1. 获取所有 connection 形状
  // 2. 检查源/目标形状是否存在
  // 3. 重新计算布局
  // 4. 更新 connection 形状位置
  // 5. 删除失效连接（源/目标已删除）
}

// 触发时机：
// - editor.store 变更（user/remote 来源）
// - pointerup 事件（拖拽结束后）
// - requestAnimationFrame 节流
```

### 9.3 箭头头部计算

```typescript
function getArrowHeadPoints(props) {
  // 根据终点切线方向计算箭头三角形
  // 箭头大小：10px
  // 角度：30 度
}
```

---

## 10. 主题系统

### 10.1 面板主题

```typescript
// theme/panelSurface.ts
interface PanelSurface {
  appBg: string
  panelBg: string
  panelAlt: string
  surface: string
  card: string
  cardBorder: string
  text: string
  muted: string
  divider: string
  shadow: string
  leftShadow: string
  accent: string
  accentLight: string
  accentDark: string
}

// 亮色/暗色两套配色
```

### 10.2 卡片变体样式

```typescript
// theme/cardVariantStyles.ts

type CardVariant = 'solid' | 'glass' | 'outline'
type CardColor = 'white' | 'yellow' | 'blue' | 'green' | 'pink' | 'purple'

interface CardVariantStyles {
  cardBg: string
  border: string
  boxShadow: string
  backdropFilter?: string
  textColor: string
  mutedTextColor: string
  menuBg: string
  buttonBg: string
}

// 6 色 × 3 变体 × 2 主题（亮/暗）= 36 种组合
// 聚焦状态额外添加绿色 glow 边框
```

### 10.3 卡片颜色定义

```typescript
const CARD_COLORS: Record<CardColor, { bg: string; border: string; header: string; accent: string }> = {
  white:  { bg: '#ffffff', border: '#e2e8f0', header: '#f8fafc', accent: '#cbd5e1' },
  yellow: { bg: '#fefce8', border: '#fde047', header: '#fef9c3', accent: '#eab308' },
  blue:   { bg: '#eff6ff', border: '#93c5fd', header: '#dbeafe', accent: '#3b82f6' },
  green:  { bg: '#f0fdf4', border: '#86efac', header: '#dcfce7', accent: '#22c55e' },
  pink:   { bg: '#fdf2f8', border: '#f0abfc', header: '#fae8ff', accent: '#ec4899' },
  purple: { bg: '#f5f3ff', border: '#c4b5fd', header: '#ede9fe', accent: '#8b5cf6' },
}
```

---

## 11. 可复用模块清单

> **图例**：✅ 完全复用（复制即可） / ⚠️ 部分复用（需适配） / ❌ 完全重写 / 📋 参考实现（逻辑可借鉴）

### 11.1 完全复用（✅ 复制即可，无需修改）

| 模块 | 文件路径 | 说明 |
|------|---------|------|
| 文件系统抽象 | `src/utils/workspace/fs.ts` | WorkspaceFileSystem 类，Electron/Web 双模式文件操作 |
| Electron 适配器 | `src/utils/workspace/fs-adapter.ts` | IPC 调用封装 + Web 降级 |
| 同步引擎 | `src/utils/workspace/syncEngine.ts` | WorkspaceSyncEngine，监听 store 变更写入文件 |
| 卡片序列化 | `src/utils/workspace/cardConverter.ts` | CardMarkdownConverter，JSON ↔ 卡片对象 |
| 工作区类型 | `src/utils/workspace/types.ts` | 所有类型定义（CardFrontmatter、BoardMeta 等） |
| 工作区状态 | `src/utils/workspace/workspaceStore.ts` | useWorkspaceStore（名称、就绪、picker 显示） |
| 卡片状态 | `src/utils/cardStore.ts` | useCardStore（CRUD、previewHTML 缓存） |
| 画板状态 | `src/utils/boardStore.ts` | useBoardStore（列表 + activeBoardId） |
| 视图状态 | `src/utils/libraryStore.ts` | useLibraryStore（viewMode、侧栏折叠） |
| 回收站状态 | `src/utils/trashStore.ts` | useTrashStore（回收站 CRUD） |
| 备份管理 | `src/utils/backupStore.ts` | IndexedDB 备份（保留 10 份） |
| 标签提取 | `src/utils/tagExtractor.ts` | `#标签名` 提取 + 全标签统计 |
| BlockNote 渲染 | `src/utils/renderBlocks.ts` | BlockNote JSON → 静态 HTML |
| 全局 API | `src/utils/api.ts` | window.heptabaseAPI |
| 面板主题 | `src/theme/panelSurface.ts` | 亮色/暗色面板色值 |
| 卡片样式 | `src/theme/cardVariantStyles.ts` | 6 色 × 3 变体 × 2 主题样式 |
| 卡片类型 | `src/types/card.ts` | CardColor、CardVariant、CARD_COLORS 常量 |
| 连接类型 | `src/types/connection.ts` | ConnectionShapeProps |
| 临时状态 | `src/utils/newCardStore.ts` | pendingAutoFocus、draggedLibraryCardId 等单例状态 |
| 卡片辅助 | `src/components/canvas/card/cardHelpers.ts` | hasCardText() |

### 11.2 部分复用（⚠️ 复制后需适配）

| 模块 | 文件路径 | 修改点 |
|------|---------|--------|
| 工作区服务 | `src/services/WorkspaceService.ts` | 画板 saveBoard/loadBoard 接口需适配新 snapshot 格式 |
| 工作区 Context | `src/services/WorkspaceContext.tsx` | 无修改，直接使用 |
| 生命周期 hook | `src/hooks/useWorkspaceLifecycle.ts` | 画板加载：editor.loadSnapshot() → setNodes/setEdges |
| 画板同步 hook | `src/hooks/useBoardSync.ts` | snapshot 获取：editor.getSnapshot() → reactFlowInstance.toObject() |
| 粘贴处理 | `src/hooks/useCanvasPaste.ts` | shape 创建：editor.createShape() → setNodes() |
| 双击创建 | `src/hooks/useCanvasDoubleClick.ts` | shape 创建：editor.createShape() → setNodes() |
| 拖拽处理 | `src/hooks/useDropHandler.ts` | shape 创建：editor.createShape() → setNodes() |
| 卡片编辑器 | `src/components/editor/BlockNoteEditor.tsx` | **完全复用**，但需确认 BlockNote 版本兼容 |
| 左侧面板 | `src/components/ui/LeftPanel.tsx` | 去掉 `useEditor`、`useValue` 等 tldraw hook |
| 工具栏 | `src/components/ui/Toolbar.tsx` | 去掉 tldraw 相关引用 |
| 设置弹窗 | `src/components/ui/SettingsDialog.tsx` | 去掉 tldraw 主题相关代码 |
| 回收站面板 | `src/components/ui/TrashBinPanel.tsx` | 去掉 tldraw createShape 引用 |
| App 根组件 | `src/App.tsx` | 去掉 `useToolbarVisibleObserver`（tldraw z-index workaround） |

### 11.3 完全重写（❌ 不要复制，重新实现）

| 模块 | 老文件路径 | 新实现 | 原因 |
|------|-----------|--------|------|
| 画布主组件 | `src/components/canvas/TldrawCanvas.tsx` | `ReactFlowCanvas.tsx` | tldraw → React Flow |
| 卡片节点 | `src/components/canvas/CardShapeUtil.tsx` | `CardNode.tsx` | ShapeUtil → React Flow Node |
| 卡片渲染 | `src/components/canvas/CardShapeComponent.tsx` | 合并到 `CardNode.tsx` | Portal 渲染 → 直接内嵌 |
| 连接线边 | `src/components/canvas/ConnectionShapeUtil.tsx` | `ConnectionEdge.tsx` | ShapeUtil → React Flow Edge |
| 分区节点 | `src/components/canvas/SectionFrameShapeUtil.tsx` | `SectionNode.tsx` | ShapeUtil → React Flow Node |
| Portal 层 | `src/components/canvas/CardPortalLayer.tsx` | **删除** | React Flow 无需 Portal |
| 点击编辑 | `src/components/canvas/card/useClickToEdit.ts` | `onNodeClick` + `data.selected` | tldraw 状态机 → React Flow 事件 |
| 连接逻辑 | `src/components/canvas/card/useCardConnection.ts` | `onConnect` + Handle 组件 | 自定义状态机 → React Flow 内置 |
| 布局逻辑 | `src/components/canvas/card/useCardLayout.ts` | `nodeExtent` + ResizeObserver | tldraw updateShape → setNodes |
| 连接线同步 | `src/hooks/useConnectionSync.ts` | **删除** | React Flow 自动处理位置更新 |
| Portal 状态 | `src/utils/portalStore.ts` | **删除** | 无需 Portal 位置同步 |
| 缩放上下文 | `src/utils/zoomContext.ts` | `useViewport()` | tldraw → React Flow |
| tldraw 辅助 | `src/utils/tldrawHelpers.ts` | **删除** | 无 tldraw 依赖 |
| 卡片占位符 | `src/components/canvas/CardPlaceholder.tsx` | 重新实现 | 简化设计 |
| 连接预览 | `src/components/canvas/ConnectionPreviewOverlay.tsx` | 重新实现 | React Flow 方式 |

### 11.4 参考实现（📋 逻辑可借鉴，但不要直接复制）

| 模块 | 文件路径 | 可借鉴内容 |
|------|---------|-----------|
| 卡片菜单 | `src/components/canvas/card/useCardMenu.ts` | 右键菜单逻辑、菜单项配置 |
| 卡片删除 | `src/components/canvas/card/useCardDelete.ts` | 删除确认流程、回收站交互 |
| 连接预览 | `src/components/canvas/ConnectionPreviewOverlay.tsx` | 预览线绘制逻辑 |
| 卡片操作 | `src/hooks/useCardActions.ts` | 卡片批量操作逻辑 |
| 图片拖拽 | `src/components/editor/useImageColumnDrop.ts` | 图片列拖拽处理 |
| 编辑器工具栏 | `src/components/editor/ImageToolbar.tsx` | 图片工具栏实现 |
| 工作区选择器 | `src/components/ui/WorkspacePicker.tsx` | 目录选择 UI 流程 |
| 全屏面板 | `src/components/ui/FullScreenPanel.tsx` | 面板展开/收起动画 |
| 卡片库视图 | `src/components/ui/CardLibraryView.tsx` | 卡片列表展示逻辑 |
| 画板库视图 | `src/components/ui/BoardLibraryView.tsx` | 画板缩略图展示 |
| 设置浮层 | `src/components/ui/SettingsPopover.tsx` | 设置项 UI 布局 |
| 卡片编辑弹窗 | `src/components/ui/CardEditModal.tsx` | 弹窗编辑器封装 |

### 11.5 Electron 主进程（✅ 完全复用）

| 文件 | 说明 |
|------|------|
| `electron/main.ts` | 主进程窗口管理、IPC 处理、日志 |
| `electron/preload.ts` | contextBridge API 暴露 |
| `electron/menu.ts` | 菜单栏配置 |

### 11.6 配置文件（⚠️ 部分修改）

| 文件 | 修改点 |
|------|--------|
| `package.json` | 去掉 `tldraw`，添加 `@xyflow/react` |
| `vite.config.ts` | 无需修改 |
| `tailwind.config.ts` | 无需修改 |
| `tsconfig.json` | 无需修改 |
| `electron-builder.yml` | 无需修改 |

---

## 12. 已知问题与教训

### 12.1 tldraw + BlockNote 冲突

**问题**：BlockNote 编辑器需要捕获键盘事件（如 `/` 触发菜单、Tab 缩进），但 tldraw 的键盘快捷键系统会拦截这些事件。

** workaround**：
1. 编辑器通过 Portal 渲染到 document.body（脱离 tldraw 事件系统）
2. rAF 循环同步 Portal 位置与 tldraw 相机
3. MutationObserver 检测 BlockNote 工具栏显示，动态调整 z-index

**代价**：
- 代码复杂度高（portalStore、rAF 循环、位置同步）
- 性能开销（每帧计算所有 Portal 位置）
- 边界情况多（缩放、平移、快速切换）

### 12.2 tldraw ShapeUtil 扩展限制

**问题**：tldraw 的 ShapeUtil 继承体系要求严格遵循其内部协议：
- props 必须使用 tldraw 的验证器（T.number, T.string 等）
- 几何计算必须使用 tldraw 的数学类（Rectangle2d, CubicBezier2d）
- 渲染必须使用 HTMLContainer 或 SVGContainer
- 事件处理受 tldraw 状态机约束

**代价**：新增组件类型需要理解 tldraw 内部架构，学习曲线陡峭。

### 12.3 画板快照格式锁定

**问题**：画板数据以 tldraw snapshot 格式存储，包含大量 tldraw 内部状态：
- schema 版本号
- instance 状态（相机、选中、工具）
- page 状态
- 所有 shape 的完整记录

**代价**：迁移到新画布引擎需要写格式转换脚本。

### 12.4 性能优化经验

**有效优化**：
1. previewHTML 缓存：非编辑态不挂载 BlockNote，用预渲染 HTML
2. maxBlocks 限制：预览态只渲染前 N 个 block
3. ResizeObserver 节流：高度变化 < 5px 不触发更新
4. useTransition：缩放状态切换用 transition 避免阻塞

**无效/负面优化**：
1. Portal 层 rAF 循环：无法避免，是架构缺陷的补丁
2. tldraw 的 memo：ShapeUtil.component 返回的组件内部状态管理困难

---

## 13. 迁移建议

### 13.1 数据迁移脚本

```typescript
// migrate-tldraw-to-reactflow.ts

interface TldrawSnapshot {
  store: Record<string, {
    typeName: 'shape'
    id: string
    type: 'card' | 'connection' | 'section'
    x: number
    y: number
    props: Record<string, unknown>
  }>
}

function migrateTldrawToReactFlow(snapshot: TldrawSnapshot): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  for (const record of Object.values(snapshot.store)) {
    if (record.typeName !== 'shape') continue

    if (record.type === 'card') {
      nodes.push({
        id: record.id,
        type: 'card',
        position: { x: record.x, y: record.y },
        data: {
          cardId: record.props.cardId,
          color: record.props.color,
          variant: record.props.variant,
          collapsed: record.props.collapsed,
          fixedHeight: record.props.fixedHeight,
          width: record.props.w,
          height: record.props.h,
        },
      })
    } else if (record.type === 'connection') {
      edges.push({
        id: record.id,
        source: record.props.fromShapeId,
        target: record.props.toShapeId,
        type: 'connection',
      })
    } else if (record.type === 'section') {
      nodes.push({
        id: record.id,
        type: 'section',
        position: { x: record.x, y: record.y },
        data: {
          name: record.props.name,
          color: record.props.color,
          width: record.props.w,
          height: record.props.h,
        },
      })
    }
  }

  return { nodes, edges }
}
```

### 13.2 React Flow 节点类型设计

```tsx
// CardNode.tsx
import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { BlockNoteEditor } from '../editor/BlockNoteEditor'

interface CardNodeData {
  cardId: string
  color: CardColor
  variant: CardVariant
  collapsed?: boolean
  fixedHeight?: boolean
}

export const CardNode = memo(({ id, data, selected }: NodeProps<CardNodeData>) => {
  const [isEditing, setIsEditing] = useState(selected)
  const card = useCardStore(s => s.cards[data.cardId])

  return (
    <div className="card-root" style={{ width: data.width, height: data.height }}>
      {/* 顶部连接点 */}
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Top} />

      {/* 卡片头部 */}
      <div className="card-header">{extractTitle(card.content)}</div>

      {/* 卡片内容 */}
      {isEditing ? (
        <BlockNoteEditor content={card.content} onChange={...} />
      ) : (
        <div dangerouslySetInnerHTML={{ __html: card.previewHTML }} />
      )}

      {/* 底部连接点 */}
      <Handle type="target" position={Position.Bottom} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
})
```

### 13.3 React Flow 配置

```tsx
// ReactFlowCanvas.tsx
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

const nodeTypes = {
  card: CardNode,
  section: SectionNode,
}

const edgeTypes = {
  connection: ConnectionEdge,
}

function ReactFlowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const onConnect = useCallback((params: Connection) => {
    // 创建连接线
    const edge = createConnectionEdge(params.source, params.target)
    setEdges((eds) => addEdge(edge, eds))
  }, [setEdges])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  )
}
```

### 13.4 关键变更点

| 功能 | tldraw 实现 | React Flow 实现 |
|------|------------|----------------|
| 节点创建 | `editor.createShape()` | `setNodes((nds) => [...nds, newNode])` |
| 节点位置 | shape.x, shape.y | node.position |
| 节点选中 | `editor.getSelectedShapeIds()` | `useStore(s => s.selectedNodeIds)` |
| 连接线 | `editor.createShape({type: 'connection'})` | `addEdge({source, target}, edges)` |
| 连接创建 | 自定义按钮 + 状态机 | `onConnect` + Handle 组件 |
| 连接线更新 | rAF 监听 shape 移动 | React Flow 自动处理 |
| 缩放检测 | `editor.getZoomLevel()` | `useViewport()` |
| 相机位置 | `editor.getCamera()` | `useReactFlow().getViewport()` |
| 页面坐标转换 | `editor.pageToScreen()` | 无需转换，直接 DOM 坐标 |

---

## 附录 A：关键常量

```typescript
// types/card.ts
const DEFAULT_CARD_WIDTH = 280
const DEFAULT_CARD_HEIGHT = 200
const CARD_HEADER_HEIGHT = 36
const CARD_BORDER_RADIUS = 16
const DEFAULT_CARD_CONTENT = '[{"type":"heading","props":{"level":2},"content":[{"type":"text","text":""}]}]'
const COLLAPSED_CARD_HEIGHT = 80
const FIXED_CARD_HEIGHT = 280
const MIN_AUTO_CARD_HEIGHT = 120
const MAX_AUTO_CARD_HEIGHT = 800

// utils/workspace/syncEngine.ts
const CARD_DEBOUNCE_MS = 500
const BOARD_DEBOUNCE_MS = 600
const SETTINGS_DEBOUNCE_MS = 300

// components/editor/BlockNoteEditor.tsx
const SAVE_DEBOUNCE_MS = 400

// utils/zoomContext.ts
const ZOOM_OUT_THRESHOLD = 0.40
const ZOOM_IN_THRESHOLD = 0.50

// utils/connectionLayout.ts
const CONNECTION_PADDING = 16
const CONNECTION_CURVE_MIN = 40
const CONNECTION_CURVE_MAX = 120
```

## 附录 B：自定义事件

```typescript
// 画板切换
window.dispatchEvent(new CustomEvent('hepta-switch-board', { detail: { boardId } }))

// 工作区切换
window.dispatchEvent(new CustomEvent('hepta-switch-workspace', { detail: { dirPath } }))
```

## 附录 C：全局 API

```typescript
window.heptabaseAPI = {
  cards: { list, get, create, update, delete },
  workspace: { getName, getPath },
}
```

---

> 本文档基于项目版本 0.1.1 编写，最后更新：2026-05-10
