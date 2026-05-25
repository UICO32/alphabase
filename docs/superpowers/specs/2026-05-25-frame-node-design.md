# Frame 节点设计文档

## 概述

Frame 是一种容器节点，用于在画布上组织和管理卡片。它替代原有的 SectionNode（从未启用），提供多种布局模式，使卡片能够以结构化方式呈现。

## 核心概念

- **Frame**：带标题的容器，内部使用独立坐标系管理卡片
- **迷你卡片 (MiniCard)**：Frame 内卡片的紧凑渲染模式，显示标题 + 首图 + 首个内容块
- **局部坐标**：卡片在 Frame 内的相对位置，与全局坐标隔离
- **布局引擎**：根据所选布局模式计算卡片在 Frame 内的排列

## 数据模型

### FrameNodeData

```typescript
type FrameLayout = 'nested' | 'bento' | 'kanban' | 'free'

interface FrameNodeData extends Record<string, unknown> {
  name: string
  layout: FrameLayout
  color?: string
  width: number
  height: number
  childCardIds: string[]
}
```

### CardNodeData 扩展

```typescript
interface CardNodeData extends Record<string, unknown> {
  cardId: string
  color: CardColor
  // ... 现有字段
  frameId?: string
  localX?: number
  localY?: number
}
```

### 坐标系统

- **全局坐标**：React Flow 画布上的绝对位置（`node.position`）
- **局部坐标**：卡片相对于所属 Frame 左上角的位置（`localX`, `localY`）
- **转换公式**：
  - 全局 → 局部：`local = global - frameGlobal`
  - 局部 → 全局：`global = frameGlobal + local`

## 布局模式

### nested（嵌套）

- 按卡片连接关系计算层级树
- 垂直排列，子级向右缩进
- 适合：知识图谱、思维导图

### bento（网格）

- 计算最优列数（基于 Frame 宽度）
- 卡片按网格排列，高度自适应
- 适合：仪表盘、概览面板

### kanban（看板）

- 按标签或手动分组为列
- 每列垂直堆叠卡片
- 适合：任务管理、流程跟踪

### free（自由画布）

- 保留用户手动拖拽位置
- 不自动排列，仅提供边界约束
- 适合：自由探索、临时归类

## 迷你卡片 (MiniCard)

### 尺寸

- 固定宽度：200px
- 高度自适应：最小 80px，最大 200px
- 统一内边距：12px

### 渲染内容

1. **标题**：从 previewHTML 提取首个 heading，或显示"无标题"
2. **首图**：卡片内容中的第一张图片（如有）
3. **首个内容块**：首个 paragraph 或 quote 的文本摘要（最多 2 行）

### 交互

- **单击**：选中卡片
- **双击**：触发进入编辑态（该卡片在画布上展开为完整 CardNode）
- **拖拽**：在 Frame 内移动（free 布局）或触发重新布局（其他布局）

## 组件架构

```
FrameNode.tsx
├── FrameHeader
│   ├── Title（可编辑）
│   └── LayoutSelector（布局切换下拉菜单）
├── FrameContent
│   └── 根据 layout 渲染：
│       ├── NestedLayout
│       ├── BentoLayout
│       ├── KanbanLayout
│       └── FreeLayout
└── FrameResizeHandle（右下角拖拽调整大小）

MiniCard.tsx
├── MiniCardHeader（标题）
├── MiniCardImage（首图，如有）
└── MiniCardExcerpt（内容摘要）
```

## 交互流程

### 创建 Frame

1. 用户框选若干卡片 → 右键"归入 Frame"
2. 计算选中卡片的外接矩形 + 边距，作为 Frame 初始尺寸
3. 创建 Frame 节点，设置 `childCardIds`
4. 为每个子卡片计算 `localX`/`localY`
5. 触发所选布局的初始排列动画

### 拖拽卡片进入 Frame

1. 监听画布上的节点拖拽
2. 检测卡片中心点是否进入 Frame 边界
3. 设置卡片 `frameId`
4. 计算新的 `localX`/`localY`
5. 触发 Frame 重新布局
6. 卡片从自由位置动画过渡到 Frame 内位置

### 拖拽卡片离开 Frame

1. 检测卡片是否跨出 Frame 边界（中心点判断）
2. 清除卡片 `frameId`
3. 将 `localX`/`localY` 转换为全局坐标
4. 触发原 Frame 重新布局

### Frame 整体移动

1. Frame 节点位置变化（React Flow 拖拽）
2. `useFrameSync` 检测到 Frame 位移
3. 所有子卡片全局坐标自动更新（`frameGlobal + local`）
4. 不修改子卡片的 `localX`/`localY`

### 切换布局

1. 用户点击 Frame 标题栏的布局选择器
2. 选择新布局模式
3. Frame 重新计算所有子卡片的 `localX`/`localY`
4. 卡片动画过渡到新位置

## 与现有系统集成

### 替换 SectionNode

- 从 `nodeTypes` 中移除 `section`
- 添加 `frame: FrameNode`
- 删除 `useSectionSync`，创建 `useFrameSync`

### Board Snapshot 兼容性

- 新格式：`type: 'frame'` 替代 `'section'`
- 保留 `childCardIds`、`layout`、`name` 等字段
- 向后兼容：加载旧 snapshot 时忽略 section 节点

### 右键菜单

- 画布多选时：添加"归入 Frame"选项
- Frame 标题栏：添加布局切换、重命名、删除
- Frame 内卡片：添加"移出 Frame"选项

## 性能考虑

1. **布局计算缓存**：Frame 尺寸和子卡片不变时，跳过重新计算
2. **迷你卡片虚拟化**：Frame 内卡片超过 50 个时，仅渲染可视区域
3. **坐标转换批量处理**：Frame 移动时，批量更新子卡片位置（一帧内完成）
4. **动画优化**：使用 CSS transform 而非 top/left，启用 GPU 加速

## 文件变更清单

### 新增文件

- `src/components/canvas/FrameNode.tsx`
- `src/components/canvas/MiniCard.tsx`
- `src/components/canvas/frame/layouts/NestedLayout.tsx`
- `src/components/canvas/frame/layouts/BentoLayout.tsx`
- `src/components/canvas/frame/layouts/KanbanLayout.tsx`
- `src/components/canvas/frame/layouts/FreeLayout.tsx`
- `src/components/canvas/frame/FrameHeader.tsx`
- `src/components/canvas/frame/FrameResizeHandle.tsx`
- `src/hooks/useFrameSync.ts`
- `src/utils/frameLayoutEngine.ts`

### 修改文件

- `src/components/canvas/ReactFlowCanvas.tsx` — 注册 frame nodeType，移除 section
- `src/components/canvas/CardNode.tsx` — 支持 frameId/localX/localY
- `src/types/card.ts` — 扩展 CardNodeData 类型
- `src/utils/workspace/types.ts` — 更新 BoardNode 类型
- `src/hooks/useCanvasDrag.ts` — 检测跨 Frame 拖拽
- `src/components/canvas/card/MoreActionsMenu.tsx` — 添加"归入 Frame"选项

### 删除文件

- `src/components/canvas/SectionNode.tsx`
- `src/hooks/useSectionSync.ts`
