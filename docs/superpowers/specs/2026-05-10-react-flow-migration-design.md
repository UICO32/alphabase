# Heptabase Canvas v2 React Flow 迁移设计文档

> **范围**: Phase 1~6（项目骨架 → React Flow 画布核心功能）
> **目标**: 将画布引擎从 tldraw 3 迁移到 React Flow，解决编辑器冲突问题

---

## 1. 项目背景与目标

### 1.1 迁移动机

老项目使用 tldraw 3 作为画布引擎，遇到以下问题：
- **事件冲突**: tldraw 与 BlockNote 编辑器存在事件冲突，需要 Portal 渲染、rAF 位置同步、z-index 动态调整等 workaround
- **扩展成本高**: tldraw 的 ShapeUtil 扩展体系复杂，新增组件类型成本高
- **功能冗余**: 老项目只用了 tldraw 的画布平移/缩放功能，卡片、连接线、分区全部自己实现
- **数据锁定**: 画板快照格式被 tldraw 锁定，难以迁移

### 1.2 迁移目标

使用 **React Flow** 替代 tldraw，同时保留老项目的文件系统层、状态管理、编辑器组件和 UI 面板。

### 1.3 核心假设验证

迁移的核心假设是：**React Flow 节点直接渲染在 DOM 树中，BlockNote 编辑器可以直接内嵌，无需 Portal**。这是 Phase 4 的关键验证点。

---

## 2. 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | React 18 + TypeScript 5.6 |
| 构建工具 | Vite 5 + vite-plugin-electron |
| 画布引擎 | @xyflow/react (React Flow) |
| 富文本编辑 | BlockNote 0.31 |
| 状态管理 | Zustand 5 |
| 样式 | Tailwind CSS 4 |
| 桌面端 | Electron 35 + electron-builder 25 |

---

## 3. 架构总览

### 3.1 目录结构

```
src/
├── main.tsx                          # React 入口（复用）
├── App.tsx                           # 根组件（去掉 tldraw workaround）
├── components/
│   ├── canvas/
│   │   ├── ReactFlowCanvas.tsx       # 画布主组件（重写）
│   │   ├── CardNode.tsx              # 卡片节点（重写）
│   │   ├── SectionNode.tsx           # 分区节点（重写）
│   │   ├── ConnectionEdge.tsx        # 连接线边（重写）
│   │   └── CardPlaceholder.tsx       # 卡片占位符（重写）
│   ├── editor/
│   │   └── BlockNoteEditor.tsx       # BlockNote 编辑器（完全复用）
│   └── ui/
│       ├── LeftPanel.tsx             # 左侧面板（去掉 tldraw hook）
│       ├── Toolbar.tsx               # 工具栏（去掉 tldraw 引用）
│       └── ...                       # 其他 UI 组件
├── hooks/
│   ├── useWorkspaceLifecycle.ts      # 工作区生命周期（适配 setNodes/setEdges）
│   ├── useBoardSync.ts               # 画板同步（适配 reactFlowInstance.toObject()）
│   ├── useCanvasPaste.ts             # 粘贴处理（适配 setNodes()）
│   ├── useCanvasDoubleClick.ts       # 双击创建（适配 setNodes()）
│   └── useDropHandler.ts             # 拖拽处理（适配 setNodes()）
├── services/
│   ├── WorkspaceService.ts           # 工作区服务（适配新 snapshot 格式）
│   └── WorkspaceContext.tsx          # 工作区 Context（完全复用）
├── utils/
│   ├── workspace/                    # 文件系统层（完全复用）
│   ├── cardStore.ts                  # 卡片状态（完全复用）
│   ├── boardStore.ts                 # 画板状态（完全复用）
│   ├── libraryStore.ts               # 视图状态（完全复用）
│   └── ...
├── types/                            # 类型定义（完全复用）
└── theme/                            # 主题（完全复用）
```

### 3.2 核心变更映射

| 功能 | tldraw 实现 | React Flow 实现 |
|------|------------|----------------|
| 节点创建 | `editor.createShape()` | `setNodes((nds) => [...nds, newNode])` |
| 节点位置 | `shape.x, shape.y` | `node.position` |
| 节点选中 | `editor.getSelectedShapeIds()` | `useStore(s => s.selectedNodeIds)` |
| 连接线 | `editor.createShape({type: 'connection'})` | `addEdge({source, target}, edges)` |
| 连接创建 | 自定义按钮 + 状态机 | `onConnect` + Handle 组件 |
| 连接线更新 | rAF 监听 shape 移动 | React Flow 自动处理 |
| 缩放检测 | `editor.getZoomLevel()` | `useViewport()` |
| 相机位置 | `editor.getCamera()` | `useReactFlow().getViewport()` |
| 页面坐标转换 | `editor.pageToScreen()` | 无需转换，直接 DOM 坐标 |

---

## 4. 数据格式

### 4.1 画板快照（新格式 version: 2）

```typescript
interface BoardSnapshot {
  version: 2
  nodes: Array<{
    id: string
    type: 'card' | 'section'
    position: { x: number; y: number }
    data: {
      cardId?: string
      color?: CardColor
      variant?: CardVariant
      collapsed?: boolean
      fixedHeight?: boolean
      width?: number
      height?: number
      name?: string
    }
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

### 4.2 兼容性要求

- 卡片文件 `cards/<uuid>.json`：格式不变，完全兼容
- 画板清单 `boards/_manifest.json`：格式不变，完全兼容
- 画板快照 `boards/<uuid>.json`：新格式 `version: 2`，需要迁移脚本（Phase 10）
- 回收站 `trash/<uuid>.trash.json`：格式不变，完全兼容

---

## 5. 组件设计

### 5.1 ReactFlowCanvas.tsx

**职责**：
1. 渲染 ReactFlow 画布
2. 管理 nodes/edges 状态
3. 绑定同步引擎
4. 处理画布交互（双击创建、粘贴、拖拽）

**Props / State**：
- `nodes`, `edges`：React Flow 状态
- `nodeTypes`：{ card: CardNode, section: SectionNode }
- `edgeTypes`：{ connection: ConnectionEdge }

**事件处理**：
- `onNodesChange` / `onEdgesChange`：React Flow 内置状态变更
- `onConnect`：创建连接线
- `onPaneClick`：退出编辑模式
- `onNodeClick`：选中节点，进入编辑模式
- `onDoubleClick`：创建新卡片

**集成 Hooks**：
- `useWorkspaceLifecycle`：工作区生命周期（加载/切换）
- `useBoardSync`：画板同步引擎绑定
- `useCanvasPaste`：粘贴处理
- `useCanvasDoubleClick`：双击创建
- `useDropHandler`：拖拽处理

### 5.2 CardNode.tsx

**职责**：
1. 渲染卡片外观（颜色、变体、折叠状态）
2. 内嵌 BlockNote 编辑器（无需 Portal）
3. 处理选中/聚焦状态切换
4. 自动高度（ResizeObserver）
5. 连接按钮（Handle 组件）
6. 右键菜单

**状态**：
- `isEditing: boolean`：是否处于编辑模式

**编辑模式切换**：
- 进入：卡片被选中（`selected === true`）
- 退出：点击画布空白处（`onPaneClick`）

**性能优化**：
- 使用 `React.memo` 包裹
- 预览态使用 `previewHTML`，不挂载 BlockNote
- 编辑态才挂载 BlockNote，退出编辑态立即卸载
- ResizeObserver 节流：高度变化 < 5px 不触发更新

**连接点**：
- 顶部：Handle（target + source）
- 底部：Handle（target + source）
- 左侧/右侧：可选

### 5.3 ConnectionEdge.tsx

**职责**：
1. 渲染贝塞尔曲线（虚线）
2. 箭头头部
3. 点击选中/删除

**实现**：
- 使用 React Flow 的 `type: 'smoothstep'` 或自定义 path
- 箭头头部根据终点切线方向计算
- 复用老项目的 `connectionLayout.ts` 算法

### 5.4 SectionNode.tsx

**职责**：
1. 渲染分组区域（带颜色边框）
2. 可拖拽调整大小
3. 双击编辑名称
4. 内部卡片跟随移动

**节点嵌套限制**：
React Flow 不支持节点嵌套。分区内的卡片跟随移动需要自定义实现：
- 监听分区节点的位置变化
- 计算偏移量，同步更新关联卡片的位置

---

## 6. 性能要求

| 指标 | 要求 |
|------|------|
| 100 个卡片以内 | 60fps，无感知卡顿 |
| 预览态 | 使用 previewHTML，不挂载 BlockNote |
| 编辑态 | 挂载 BlockNote，退出立即卸载 |
| ResizeObserver | 高度变化 < 5px 不触发更新 |
| CardNode | 使用 React.memo 包裹 |

---

## 7. 样式要求

- 使用 Tailwind CSS 4
- 卡片颜色：white、yellow、blue、green、pink、purple
- 卡片变体：solid、glass、outline
- 暗色/亮色模式自适应
- 面板主题使用 `theme/panelSurface.ts`
- 卡片样式使用 `theme/cardVariantStyles.ts`

---

## 8. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| React Flow + BlockNote 事件冲突 | 高 | Phase 4 尽早验证，如果冲突严重则回退方案 |
| 性能不达标（< 60fps） | 高 | Phase 3 验证 previewHTML 模式，优化渲染 |
| 分区卡片跟随移动实现复杂 | 中 | Phase 6 单独处理，可简化为先不实现跟随 |
| 老数据格式迁移 | 中 | Phase 10 专门处理，Phase 1~6 先用新格式 |

---

## 9. 验证标准

### Phase 1
- [ ] `npm run dev` 能启动 Electron 窗口
- [ ] 显示空白 React 页面

### Phase 2
- [ ] 所有 ✅ 完全复用模块已复制到正确位置
- [ ] TypeScript 编译无错误

### Phase 3
- [ ] 能加载画板 snapshot → 显示卡片
- [ ] 卡片显示 previewHTML 内容
- [ ] 可以平移/缩放画布
- [ ] 100 个卡片时 60fps

### Phase 4
- [ ] 选中卡片进入编辑模式，显示 BlockNote 编辑器
- [ ] `/` 菜单、Tab 缩进等键盘事件正常工作
- [ ] 点击画布空白处退出编辑，显示 previewHTML
- [ ] 无事件冲突

### Phase 5
- [ ] 拖拽 Handle 创建连接
- [ ] 连接显示为虚线贝塞尔曲线
- [ ] 移动卡片时连接自动跟随
- [ ] 点击连接可删除

### Phase 6
- [ ] 显示带颜色边框的分区
- [ ] 可调整大小
- [ ] 双击编辑名称
- [ ] 拖拽分区时内部卡片跟随移动
