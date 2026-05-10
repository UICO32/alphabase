# Heptabase Canvas v2 项目开发提示词

## 项目背景

Heptabase Canvas 是一个基于画布的知识管理桌面应用（类似 Heptabase / Obsidian Canvas），用户可以在无限画布上创建富文本卡片、拖拽排列、建立连接，形成知识网络。

**老项目**使用 tldraw 3 作为画布引擎，但遇到以下问题：
- tldraw 与 BlockNote 编辑器存在事件冲突，导致大量 workaround（Portal 渲染、rAF 位置同步、z-index 动态调整）
- tldraw 的 ShapeUtil 扩展体系复杂，新增组件类型成本高
- 老项目只用了 tldraw 的画布平移/缩放功能，卡片、连接线、分区全部自己实现
- 画板快照格式被 tldraw 锁定，难以迁移

**新项目**决定使用 **React Flow** 替代 tldraw，同时保留老项目的文件系统层、状态管理、编辑器组件和 UI 面板。

---

## 技术栈

- **框架**: React 18 + TypeScript 5.6
- **构建工具**: Vite 5 + vite-plugin-electron
- **画布引擎**: @xyflow/react (React Flow)
- **富文本编辑**: BlockNote 0.31 (@blocknote/core + @blocknote/mantine + @blocknote/react)
- **状态管理**: Zustand 5
- **样式**: Tailwind CSS 4
- **桌面端**: Electron 35 + electron-builder 25
- **图标**: lucide-react

---

## 核心概念

- **工作区（Workspace）**: 一个本地文件夹，包含所有数据（cards/、boards/、settings.json、trash/、.heptabase/media/）
- **画板（Board）**: 一个画布，保存节点位置、连接关系、视口状态
- **卡片（Card）**: 富文本笔记单元，使用 BlockNote 编辑器，有颜色/变体/折叠状态
- **连接线（Connection）**: 卡片之间的有向虚线，带箭头
- **分区（Section）**: 画板上的分组区域，可命名、可变色

---

## 数据格式（必须兼容）

### 卡片文件（cards/<uuid>.json）
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "从内容提取的标题",
  "color": "blue",
  "variant": "solid",
  "createdAt": 1704067200000,
  "content": "[{\"type\":\"heading\",...}]",
  "enforceInitialHeading": true,
  "tags": ["重要"]
}
```

### 画板清单（boards/_manifest.json）
```json
{ "boards": [{ "id": "uuid", "name": "画板 1", "createdAt": 0, "updatedAt": 0 }] }
```

### 画板快照（boards/<uuid>.json）— 新格式
```typescript
interface BoardSnapshot {
  version: 2
  nodes: Array<{
    id: string
    type: 'card' | 'section'
    position: { x: number; y: number }
    data: { cardId?: string; color?: string; variant?: string; collapsed?: boolean; fixedHeight?: boolean; width?: number; height?: number; name?: string }
    width?: number
    height?: number
  }>
  edges: Array<{
    id: string
    source: string
    target: string
    type: 'connection'
  }>
  viewport: { x: number; y: number; zoom: number }
}
```

---

## 可复用模块（从老项目复制）

### ✅ 完全复用（直接复制，无需修改）

| 文件 | 说明 |
|------|------|
| `src/utils/workspace/fs.ts` | 文件系统抽象（Electron/Web 双模式） |
| `src/utils/workspace/fs-adapter.ts` | Electron IPC 适配器 |
| `src/utils/workspace/syncEngine.ts` | 同步引擎（监听 store → 写入文件） |
| `src/utils/workspace/cardConverter.ts` | 卡片序列化/反序列化 |
| `src/utils/workspace/types.ts` | 类型定义 |
| `src/utils/workspace/workspaceStore.ts` | 工作区 UI 状态 |
| `src/utils/cardStore.ts` | 卡片 CRUD + previewHTML 缓存 |
| `src/utils/boardStore.ts` | 画板列表 + activeBoardId |
| `src/utils/libraryStore.ts` | 视图模式 + 侧栏状态 |
| `src/utils/trashStore.ts` | 回收站管理 |
| `src/utils/backupStore.ts` | IndexedDB 备份 |
| `src/utils/tagExtractor.ts` | 标签提取 |
| `src/utils/renderBlocks.ts` | BlockNote JSON → HTML |
| `src/utils/api.ts` | 全局 API |
| `src/utils/newCardStore.ts` | 临时状态（pendingAutoFocus 等） |
| `src/theme/panelSurface.ts` | 面板主题色 |
| `src/theme/cardVariantStyles.ts` | 卡片变体样式 |
| `src/types/card.ts` | 卡片类型 + 颜色常量 |
| `src/types/connection.ts` | 连接类型 |
| `src/components/canvas/card/cardHelpers.ts` | hasCardText() |
| `src/components/editor/BlockNoteEditor.tsx` | BlockNote 编辑器组件 |
| `electron/main.ts` | Electron 主进程 |
| `electron/preload.ts` | contextBridge |
| `electron/menu.ts` | 菜单栏 |

### ⚠️ 部分复用（复制后需适配 React Flow API）

| 文件 | 修改点 |
|------|--------|
| `src/services/WorkspaceService.ts` | saveBoard/loadBoard 接口适配新 snapshot 格式 |
| `src/services/WorkspaceContext.tsx` | 直接使用 |
| `src/hooks/useWorkspaceLifecycle.ts` | 画板加载：从 editor.loadSnapshot() 改为 setNodes/setEdges |
| `src/hooks/useBoardSync.ts` | snapshot 获取：从 editor.getSnapshot() 改为 reactFlowInstance.toObject() |
| `src/hooks/useCanvasPaste.ts` | 节点创建：从 editor.createShape() 改为 setNodes() |
| `src/hooks/useCanvasDoubleClick.ts` | 节点创建：从 editor.createShape() 改为 setNodes() |
| `src/hooks/useDropHandler.ts` | 节点创建：从 editor.createShape() 改为 setNodes() |
| `src/components/ui/LeftPanel.tsx` | 去掉 tldraw hook |
| `src/components/ui/Toolbar.tsx` | 去掉 tldraw 引用 |
| `src/App.tsx` | 去掉 tldraw z-index workaround |

---

## 需要新实现的模块

### 核心画布（使用 React Flow）

```tsx
// src/components/canvas/ReactFlowCanvas.tsx
// 职责：
// 1. 渲染 ReactFlow 画布
// 2. 管理 nodes/edges 状态
// 3. 绑定同步引擎
// 4. 处理画布交互（双击创建、粘贴、拖拽）

// 需要：
// - nodeTypes: { card: CardNode, section: SectionNode }
// - edgeTypes: { connection: ConnectionEdge }
// - onNodesChange / onEdgesChange / onConnect
// - onNodeClick → 进入编辑模式
// - onPaneClick → 退出编辑模式
// - onDoubleClick → 创建新卡片
```

```tsx
// src/components/canvas/CardNode.tsx
// 职责：
// 1. 渲染卡片外观（颜色、变体、折叠状态）
// 2. 内嵌 BlockNote 编辑器（无需 Portal！）
// 3. 处理选中/聚焦状态切换
// 4. 自动高度（ResizeObserver）
// 5. 连接按钮（点击后进入连接模式）
// 6. 右键菜单

// 注意：
// - React Flow 节点直接渲染在 DOM 中，BlockNote 可以直接内嵌
// - 使用 Handle 组件定义连接点（上下左右）
// - 选中时 isSelected=true，进入编辑模式
// - 非选中时显示 previewHTML 静态内容
```

```tsx
// src/components/canvas/SectionNode.tsx
// 职责：
// 1. 渲染分组区域（带颜色边框）
// 2. 可拖拽调整大小
// 3. 双击编辑名称
// 4. 内部卡片跟随移动（React Flow 不自动处理，需自定义）
```

```tsx
// src/components/canvas/ConnectionEdge.tsx
// 职责：
// 1. 渲染贝塞尔曲线（虚线）
// 2. 箭头头部
// 3. 点击选中/删除

// 注意：
// - React Flow 的默认边是直线，需要自定义 bezier path
// - 或使用 React Flow 的 `type: 'smoothstep'` 或 `type: 'bezier'`
```

---

## 关键实现要求

### 1. BlockNote 直接内嵌（无需 Portal）

React Flow 节点直接渲染在 DOM 树中，不像 tldraw 那样用 Canvas/SVG 隔离。因此 BlockNote 编辑器可以直接放在 CardNode 组件内部：

```tsx
function CardNode({ data, selected }: NodeProps<CardNodeData>) {
  const [isEditing, setIsEditing] = useState(false)
  const card = useCardStore(s => s.cards[data.cardId])

  // 选中时进入编辑模式
  useEffect(() => { if (selected) setIsEditing(true) }, [selected])

  return (
    <div className="card-root">
      {isEditing ? (
        <BlockNoteEditor content={card.content} onChange={handleChange} />
      ) : (
        <div dangerouslySetInnerHTML={{ __html: card.previewHTML }} />
      )}
    </div>
  )
}
```

### 2. 卡片自动高度

```tsx
// 使用 ResizeObserver 监听编辑器内容高度
// 调用 React Flow 的 updateNode() 更新节点高度
// 限制范围：MIN_AUTO_CARD_HEIGHT (120) ~ MAX_AUTO_CARD_HEIGHT (800)
```

### 3. 连接线布局

```typescript
// 复用老项目的 connectionLayout.ts 算法
// 计算贝塞尔曲线控制点
// 箭头头部根据终点切线方向计算
```

### 4. 连接创建交互

```
1. 用户点击卡片上的「连接」按钮
2. 设置 pendingConnectionSourceId = 当前卡片 ID
3. 鼠标移动显示预览线（从源卡片到鼠标位置）
4. 用户点击目标卡片 → 创建 edge
5. 按 Escape 取消
```

### 5. 分区（Section）

```
- 分区是特殊的 node，z-index 低于卡片
- 分区可以调整大小
- 分区内的卡片跟随分区移动（需要自定义实现）
- 分区名称可编辑
```

### 6. 缩放适配

```
- 缩放 < 0.4 时，卡片进入简化模式（只显示标题）
- 使用 React Flow 的 useViewport() 获取 zoom 级别
- 使用 useTransition() 避免状态更新阻塞
```

### 7. 画板切换

```
1. 保存当前画板：reactFlowInstance.toObject() → 写入 boards/<id>.json
2. 加载目标画板：读取 boards/<id>.json → setNodes/setEdges/setViewport
3. 触发事件：window.dispatchEvent(new CustomEvent('hepta-switch-board'))
```

### 8. 工作区切换

```
1. 停止 syncEngine
2. 保存当前画板
3. 清空 nodes/edges
4. 加载新工作区的 cards 到 cardStore
5. 加载新工作区的 boards 到 boardStore
6. 加载首个画板
7. 启动新的 syncEngine
```

---

## 性能要求

- 100 个卡片以内：60fps，无感知卡顿
- 卡片预览态使用预渲染 HTML（previewHTML），不挂载 BlockNote
- 编辑态才挂载 BlockNote，退出编辑态立即卸载
- ResizeObserver 节流：高度变化 < 5px 不触发更新
- 使用 React.memo 包裹 CardNode，避免不必要的重渲染

---

## 样式要求

- 使用 Tailwind CSS 4
- 卡片颜色：white、yellow、blue、green、pink、purple
- 卡片变体：solid、glass、outline
- 暗色/亮色模式自适应
- 面板主题使用 theme/panelSurface.ts
- 卡片样式使用 theme/cardVariantStyles.ts

---

## 文件系统要求

- 工作区是一个本地文件夹
- Electron 模式：通过 IPC 调用 Node.js fs API
- Web 模式：使用 File System Access API，降级到 IndexedDB
- 卡片文件：cards/<uuid>.json
- 画板文件：boards/<uuid>.json（新格式 version: 2）
- 画板清单：boards/_manifest.json
- 设置文件：settings.json
- 回收站：trash/<uuid>.trash.json
- 媒体文件：.heptabase/media/

---

## 开发规范

- 使用 TypeScript，严格类型检查
- 组件使用函数式组件 + hooks
- 状态管理使用 Zustand
- 画布交互逻辑封装在 hooks 中
- 文件操作通过 WorkspaceService 集中管理
- 同步通过 WorkspaceSyncEngine 自动处理
- 不要引入新的依赖，除非必要

---

## 参考文档

老项目完整技术参考文档：`PROJECT_REFERENCE.md`

包含：
- 完整数据格式规范
- 所有类型定义
- 连接线布局算法
- 主题系统详细说明
- 已知问题与教训
- 迁移建议与代码示例

---

## 开发顺序建议

1. **Phase 1**: 搭建项目骨架（package.json、vite.config、目录结构）
2. **Phase 2**: 复制 ✅ 完全复用模块
3. **Phase 3**: 实现 ReactFlowCanvas + CardNode（基础渲染）
4. **Phase 4**: 集成 BlockNote 编辑器（直接内嵌验证）
5. **Phase 5**: 实现连接线（ConnectionEdge + 连接创建交互）
6. **Phase 6**: 实现分区（SectionNode）
7. **Phase 7**: 复制 ⚠️ 部分复用模块并适配
8. **Phase 8**: 实现画板切换、工作区切换
9. **Phase 9**: 集成同步引擎
10. **Phase 10**: 数据迁移脚本（老格式 → 新格式）
11. **Phase 11**: 测试、优化、打包
