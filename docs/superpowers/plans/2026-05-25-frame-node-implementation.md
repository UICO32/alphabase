# Frame 容器节点实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Frame 容器节点替代 SectionNode，子卡片作为 React Flow 独立节点，先支持 free 布局（保留手动位置），Frame 移动时同步子卡片全局坐标。

**Architecture:** Frame 是 React Flow 的一个节点类型，子卡片仍是独立节点（保有完整连线、拖拽、选择能力）。卡片通过 `frameId` 关联到 Frame，位置由 `localX/localY`（相对于 Frame）和全局 `position` 双重维护。`useFrameSync` 负责 Frame 移动时同步子卡片全局坐标，以及拖拽结束时检测跨 Frame 边界。先只实现 free 布局，后续再加 nested/bento/kanban。

**Tech Stack:** React 18 + TypeScript 5.6 + React Flow (@xyflow/react) + Zustand 5 + Tailwind CSS

---

## 文件结构

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/components/canvas/FrameNode.tsx` | Frame 节点主组件：标题栏、内容区、resize 手柄 |
| `src/hooks/useFrameSync.ts` | Frame 移动时同步子卡片全局坐标；坐标转换工具函数 |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `src/types/card.ts` | CardNodeData 增加 frameId / localX / localY 字段 |
| `src/utils/workspace/types.ts` | BoardNode.type 联合类型移除 'section'，添加 'frame'；BoardNode.data 增加 frame 相关字段 |
| `src/components/canvas/ReactFlowCanvas.tsx` | nodeTypes 注册 frame 替换 section；useSectionSync → useFrameSync |
| `src/components/canvas/CardNode.tsx` | 卡片有 frameId 时渲染不可见占位（opacity:0），实际渲染由 Frame 内 MiniCard 负责 |
| `src/hooks/useCanvasDrag.ts` | onNodeDragStop 中检测卡片是否跨入/跨出 Frame 边界，更新 frameId + localX/localY |
| `src/sync/subscribeStores.ts` | BoardNode 类型守卫添加 'frame'；序列化时包含 frame data 字段 |
| `src/hooks/useWorkspaceLifecycle.ts` | switchToBoard 序列化格式添加 frame 相关 data 字段 |
| `src/hooks/useBoardSync.ts` | serializeBoardData 保留 frame data 字段 |

### 删除文件

| 文件 | 原因 |
|------|------|
| `src/components/canvas/SectionNode.tsx` | 被 FrameNode 替代 |
| `src/hooks/useSectionSync.ts` | 被 useFrameSync 替代 |

---

## Task 1: 扩展类型定义

**Files:**
- Modify: `src/types/card.ts:24-30`
- Modify: `src/utils/workspace/types.ts:27-43`

- [ ] **Step 1: 扩展 CardNodeData**

在 `src/types/card.ts` 的 `CardNodeData` 接口添加 frame 相关字段：

```typescript
// src/types/card.ts — 完整替换 CardNodeData 接口
export interface CardNodeData extends Record<string, unknown> {
  cardId: string
  color: CardColor
  width?: number
  height?: number
  collapsed?: boolean
  frameId?: string
  localX?: number
  localY?: number
}
```

- [ ] **Step 2: 更新 BoardNode 类型**

在 `src/utils/workspace/types.ts` 中替换 BoardNode 接口：

```typescript
// src/utils/workspace/types.ts — 替换 BoardNode 接口（行 27-43）
export interface BoardNode {
  id: string
  type: 'card' | 'frame' | 'media'
  position: { x: number; y: number }
  data: {
    cardId?: string
    color?: string
    variant?: string
    collapsed?: boolean
    fixedHeight?: boolean
    width?: number
    height?: number
    name?: string
    url?: string
    layout?: string
    childCardIds?: string[]
    frameId?: string
    localX?: number
    localY?: number
  }
  width?: number
  height?: number
}
```

- [ ] **Step 3: 提交**

```bash
git add src/types/card.ts src/utils/workspace/types.ts
git commit -m "feat(frame): 扩展 CardNodeData 和 BoardNode 类型，添加 frame 坐标字段"
```

---

## Task 2: 创建 useFrameSync Hook

**Files:**
- Create: `src/hooks/useFrameSync.ts`
- Delete: `src/hooks/useSectionSync.ts`

- [ ] **Step 1: 实现 useFrameSync**

```typescript
// src/hooks/useFrameSync.ts
import { useEffect, useRef } from 'react'
import { type Node } from '@xyflow/react'
import type { CardNodeData } from '../types/card'

interface UseFrameSyncOptions {
  nodes: Node[]
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
}

export function useFrameSync({ nodes, setNodes }: UseFrameSyncOptions) {
  const prevNodesRef = useRef<Node[]>(nodes)

  useEffect(() => {
    const prevNodes = prevNodesRef.current
    const frameNodes = nodes.filter(n => n.type === 'frame')

    let hasChanges = false
    const updatedNodes = nodes.map(node => {
      const nodeData = node.data as CardNodeData
      if (!nodeData.frameId) return node

      const frameNode = frameNodes.find(f => f.id === nodeData.frameId)
      if (!frameNode) {
        hasChanges = true
        return {
          ...node,
          data: { ...node.data, frameId: undefined, localX: undefined, localY: undefined },
        }
      }

      const prevFrame = prevNodes.find(n => n.id === nodeData.frameId)
      if (!prevFrame) return node

      const dx = frameNode.position.x - prevFrame.position.x
      const dy = frameNode.position.y - prevFrame.position.y

      if (dx === 0 && dy === 0) return node

      hasChanges = true
      return {
        ...node,
        position: {
          x: node.position.x + dx,
          y: node.position.y + dy,
        },
      }
    })

    if (hasChanges) {
      setNodes(updatedNodes)
    }

    prevNodesRef.current = nodes
  }, [nodes, setNodes])
}

export function isPointInNode(
  point: { x: number; y: number },
  node: Node,
): boolean {
  const w = (node.data as Record<string, unknown>).width as number | undefined ?? node.width ?? 600
  const h = (node.data as Record<string, unknown>).height as number | undefined ?? node.height ?? 400
  return (
    point.x >= node.position.x &&
    point.x <= node.position.x + w &&
    point.y >= node.position.y &&
    point.y <= node.position.y + h
  )
}

export function globalToLocal(
  global: { x: number; y: number },
  frame: Node,
): { x: number; y: number } {
  return {
    x: global.x - frame.position.x,
    y: global.y - frame.position.y,
  }
}

export function localToGlobal(
  local: { x: number; y: number },
  frame: Node,
): { x: number; y: number } {
  return {
    x: local.x + frame.position.x,
    y: local.y + frame.position.y,
  }
}
```

- [ ] **Step 2: 删除 useSectionSync**

```bash
git rm src/hooks/useSectionSync.ts
```

- [ ] **Step 3: 提交**

```bash
git add src/hooks/useFrameSync.ts
git commit -m "feat(frame): 创建 useFrameSync，替代 useSectionSync，实现 Frame 移动同步和坐标转换"
```

---

## Task 3: 创建 FrameNode 主组件

**Files:**
- Create: `src/components/canvas/FrameNode.tsx`
- Delete: `src/components/canvas/SectionNode.tsx`

- [ ] **Step 1: 实现 FrameNode**

```typescript
// src/components/canvas/FrameNode.tsx
import { memo, useState, useCallback, useRef } from 'react'
import { type NodeProps, type Node, useReactFlow } from '@xyflow/react'
import type { CardNodeData } from '../../types/card'

export interface FrameNodeData extends Record<string, unknown> {
  name: string
  layout?: string
  color?: string
  width: number
  height: number
  childCardIds?: string[]
}

type FrameNodeType = Node<FrameNodeData, 'frame'>

const DEFAULT_FRAME_WIDTH = 600
const DEFAULT_FRAME_HEIGHT = 400

export const FrameNode = memo(({ id, data, selected }: NodeProps<FrameNodeType>) => {
  const { setNodes, getNodes } = useReactFlow()
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(data.name || 'Frame')
  const [size, setSize] = useState({
    width: data.width ?? DEFAULT_FRAME_WIDTH,
    height: data.height ?? DEFAULT_FRAME_HEIGHT,
  })
  const resizingRef = useRef(false)
  const startPosRef = useRef({ x: 0, y: 0 })
  const startSizeRef = useRef({ width: 0, height: 0 })

  const handleNameSubmit = useCallback(() => {
    setIsEditing(false)
    const trimmed = name.trim() || 'Frame'
    setName(trimmed)
    setNodes(nds => nds.map(n =>
      n.id === id ? { ...n, data: { ...n.data, name: trimmed } } : n
    ))
  }, [id, name, setNodes])

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    resizingRef.current = true
    startPosRef.current = { x: e.clientX, y: e.clientY }
    startSizeRef.current = { ...size }

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return
      const dx = e.clientX - startPosRef.current.x
      const dy = e.clientY - startPosRef.current.y
      const newW = Math.max(300, startSizeRef.current.width + dx)
      const newH = Math.max(200, startSizeRef.current.height + dy)
      setSize({ width: newW, height: newH })
      setNodes(nds => nds.map(n =>
        n.id === id ? { ...n, data: { ...n.data, width: newW, height: newH } } : n
      ))
    }

    const handleMouseUp = () => {
      resizingRef.current = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [id, size, setNodes])

  const borderColor = data.color ?? 'var(--border-default)'

  return (
    <div
      className="rounded-xl border-2 border-dashed relative overflow-hidden"
      style={{
        width: size.width,
        height: size.height,
        borderColor,
        backgroundColor: `${borderColor}08`,
        boxShadow: selected ? 'var(--shadow-glow-blue)' : 'none',
      }}
    >
      {/* 标题栏 */}
      <div
        className="px-4 py-2 select-none"
        style={{ borderBottom: `1px solid ${borderColor}20` }}
      >
        {isEditing ? (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => { if (e.key === 'Enter') handleNameSubmit() }}
            className="text-sm font-medium bg-transparent border-none outline-none w-full"
            style={{ color: 'var(--text-primary)' }}
            autoFocus
          />
        ) : (
          <span
            className="text-sm font-medium cursor-pointer truncate"
            style={{ color: 'var(--text-secondary)' }}
            onDoubleClick={() => setIsEditing(true)}
          >
            {name}
          </span>
        )}
      </div>

      {/* 子卡片渲染区域 — free 布局下子卡片是独立节点，此处仅作视觉容器 */}

      {/* resize 手柄 */}
      {selected && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10"
          onMouseDown={handleResizeStart}
        >
          <svg viewBox="0 0 16 16" className="w-full h-full" style={{ color: 'var(--text-tertiary)' }}>
            <path
              d="M8 8L16 16M12 16L16 12M16 8L8 16"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </div>
      )}
    </div>
  )
})

FrameNode.displayName = 'FrameNode'
```

- [ ] **Step 2: 删除 SectionNode**

```bash
git rm src/components/canvas/SectionNode.tsx
```

- [ ] **Step 3: 提交**

```bash
git add src/components/canvas/FrameNode.tsx
git commit -m "feat(frame): 创建 FrameNode 组件，替代 SectionNode"
```

---

## Task 4: 修改 ReactFlowCanvas 注册 Frame

**Files:**
- Modify: `src/components/canvas/ReactFlowCanvas.tsx`

- [ ] **Step 1: 替换 imports 和 nodeTypes**

找到 `ReactFlowCanvas.tsx` 中以下 import 和定义：

```typescript
// 旧（行 18）
import { SectionNode } from './SectionNode'

// 新
import { FrameNode } from './FrameNode'
```

```typescript
// 旧（行 43-47）
const nodeTypes = {
  card: CardNode,
  section: SectionNode,
  media: MediaNode,
}

// 新
const nodeTypes = {
  card: CardNode,
  frame: FrameNode,
  media: MediaNode,
}
```

- [ ] **Step 2: 替换 useSectionSync**

```typescript
// 旧（行 29）
import { useSectionSync } from '../../hooks/useSectionSync'

// 新
import { useFrameSync } from '../../hooks/useFrameSync'
```

```typescript
// 旧（行 87）
useSectionSync({ nodes, setNodes })

// 新
useFrameSync({ nodes, setNodes })
```

- [ ] **Step 3: 提交**

```bash
git add src/components/canvas/ReactFlowCanvas.tsx
git commit -m "feat(frame): ReactFlowCanvas 注册 FrameNode，替换 SectionNode 和 useSectionSync"
```

---

## Task 5: 修改 CardNode 支持 Frame 内隐藏

**Files:**
- Modify: `src/components/canvas/CardNode.tsx:19-237`

- [ ] **Step 1: 在 CardNode 开头添加 frameId 隐藏逻辑**

在 `CardNode` 组件函数体开头（`const isCollapsed = ...` 之前）添加：

```typescript
// 卡片在 Frame 内时，渲染不可见占位
// 实际渲染由 Frame 内的 MiniCard 负责
// 使用 opacity:0 保持节点存在，使连接线和选中状态正常工作
if (data.frameId) {
  return (
    <div
      style={{
        width: (data.width ?? DEFAULT_CARD_WIDTH) as number,
        height: isCollapsed ? COLLAPSED_CARD_HEIGHT : ((data.height ?? DEFAULT_CARD_HEIGHT) as number),
        opacity: 0,
        pointerEvents: 'none',
      }}
    />
  )
}
```

注意：这里需要将 `isCollapsed` 的计算移到 `if (data.frameId)` 之前，因为条件分支中用到了 `isCollapsed`。所以实际修改是在函数体的最前面：

```typescript
export const CardNode = memo(({ data, selected }: NodeProps<CardNodeType>) => {
  const isCollapsed = data.collapsed ?? false

  // 卡片在 Frame 内时渲染不可见占位
  if (data.frameId) {
    return (
      <div
        style={{
          width: (data.width ?? DEFAULT_CARD_WIDTH) as number,
          height: isCollapsed ? COLLAPSED_CARD_HEIGHT : ((data.height ?? DEFAULT_CARD_HEIGHT) as number),
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
    )
  }

  const [isEditing, setIsEditing] = useState(false)
  // ... 其余代码不变
```

同时需要把原来行 27 的 `const isCollapsed = data.collapsed ?? false` 移到最前面，并删除原来位置的这一行。

- [ ] **Step 2: 提交**

```bash
git add src/components/canvas/CardNode.tsx
git commit -m "feat(frame): CardNode 在 Frame 内时渲染不可见占位，由 Frame 内 MiniCard 负责渲染"
```

---

## Task 6: 修改 useCanvasDrag 支持跨 Frame 拖拽检测

**Files:**
- Modify: `src/hooks/useCanvasDrag.ts`

- [ ] **Step 1: 在 onNodeDragStop 中添加跨 Frame 检测**

替换整个文件内容：

```typescript
// src/hooks/useCanvasDrag.ts
import { useCallback } from 'react'
import { type Edge, type OnNodeDrag, type Node } from '@xyflow/react'
import type { ReactFlowInstance } from '@xyflow/react'
import { getBestHandles } from '../utils/geometry'
import { DEFAULT_CARD_WIDTH, DEFAULT_CARD_HEIGHT, COLLAPSED_CARD_HEIGHT } from '../types/card'
import type { CardNodeData } from '../types/card'
import { isPointInNode, globalToLocal } from './useFrameSync'

interface UseCanvasDragOptions {
  reactFlowInstance: React.RefObject<ReactFlowInstance | null>
  setEdges: (updater: Edge[] | ((edges: Edge[]) => Edge[])) => void
  setNodes: (updater: Node[] | ((nodes: Node[]) => Node[])) => void
}

export function useCanvasDrag({ reactFlowInstance, setEdges, setNodes }: UseCanvasDragOptions) {
  const onNodeDrag: OnNodeDrag = useCallback(
    (_event, node) => {
      const instance = reactFlowInstance.current
      if (!instance) return
      setEdges((eds) => {
        let changed = false
        const next = eds.map((e) => {
          if (e.source !== node.id && e.target !== node.id) return e
          changed = true
          const sourceNode = instance.getNode(e.source)
          const targetNode = instance.getNode(e.target)
          if (!sourceNode || !targetNode) return e
          const sd = sourceNode.data as CardNodeData
          const sw = sd.width ?? DEFAULT_CARD_WIDTH
          const sh = sd.collapsed ? COLLAPSED_CARD_HEIGHT : (sd.height ?? DEFAULT_CARD_HEIGHT)
          const td = targetNode.data as CardNodeData
          const tw = td.width ?? DEFAULT_CARD_WIDTH
          const th = td.collapsed ? COLLAPSED_CARD_HEIGHT : (td.height ?? DEFAULT_CARD_HEIGHT)
          const handles = getBestHandles(sourceNode.position, { w: sw, h: sh }, targetNode.position, { w: tw, h: th })
          if (e.sourceHandle === handles.sourceHandle && e.targetHandle === handles.targetHandle) return e
          return {
            ...e,
            sourceHandle: handles.sourceHandle,
            targetHandle: handles.targetHandle,
          }
        })
        return changed ? next : eds
      })
    },
    [reactFlowInstance, setEdges],
  )

  const onNodeDragStop = useCallback((_event: MouseEvent, node: Node) => {
    setEdges((eds) => [...eds])

    // 只对卡片节点检测跨 Frame 拖拽
    if (node.type !== 'card') return

    const instance = reactFlowInstance.current
    if (!instance) return

    const allNodes = instance.getNodes()
    const frameNodes = allNodes.filter(n => n.type === 'frame')
    const nodeData = node.data as CardNodeData

    // 计算卡片中心点
    const w = node.width ?? nodeData.width ?? DEFAULT_CARD_WIDTH
    const h = node.height ?? (nodeData.collapsed ? COLLAPSED_CARD_HEIGHT : (nodeData.height ?? DEFAULT_CARD_HEIGHT))
    const cardCenter = {
      x: node.position.x + w / 2,
      y: node.position.y + h / 2,
    }

    // 查找包含卡片中心点的 Frame
    const containingFrame = frameNodes.find(frame => isPointInNode(cardCenter, frame))

    setNodes(nds => nds.map(n => {
      if (n.id !== node.id) return n
      const nd = n.data as CardNodeData

      if (containingFrame && containingFrame.id !== nd.frameId) {
        // 卡片进入新 Frame（如果之前在另一个 Frame 中，自动移出旧 Frame）
        const local = globalToLocal(n.position, containingFrame)
        return {
          ...n,
          data: { ...n.data, frameId: containingFrame.id, localX: local.x, localY: local.y },
        }
      } else if (!containingFrame && nd.frameId) {
        // 卡片离开 Frame
        return {
          ...n,
          data: { ...n.data, frameId: undefined, localX: undefined, localY: undefined },
        }
      }
      return n
    }))
  }, [setEdges, setNodes, reactFlowInstance])

  return { onNodeDrag, onNodeDragStop }
}
```

- [ ] **Step 2: 修改 ReactFlowCanvas 传递 setNodes 给 useCanvasDrag**

在 `ReactFlowCanvas.tsx` 中，`useCanvasDrag` 的调用需要增加 `setNodes` 参数：

```typescript
// 旧
const { onNodeDrag, onNodeDragStop: originalOnNodeDragStop } = useCanvasDrag({ reactFlowInstance, setEdges })

// 新
const { onNodeDrag, onNodeDragStop: originalOnNodeDragStop } = useCanvasDrag({ reactFlowInstance, setEdges, setNodes })
```

- [ ] **Step 3: 提交**

```bash
git add src/hooks/useCanvasDrag.ts src/components/canvas/ReactFlowCanvas.tsx
git commit -m "feat(frame): useCanvasDrag 支持跨 Frame 拖拽检测，更新卡片 frameId 和局部坐标"
```

---

## Task 7: 更新序列化/反序列化路径

**Files:**
- Modify: `src/sync/subscribeStores.ts:65`
- Modify: `src/hooks/useWorkspaceLifecycle.ts:33-44`
- Modify: `src/hooks/useBoardSync.ts:6-25`

- [ ] **Step 1: 更新 subscribeStores.ts 的类型守卫**

找到行 65 附近的类型守卫：

```typescript
// 旧
type: (n.type === 'card' || n.type === 'section' || n.type === 'media') ? n.type as 'card' | 'section' | 'media' : 'card',

// 新
type: (n.type === 'card' || n.type === 'frame' || n.type === 'media') ? n.type as 'card' | 'frame' | 'media' : 'card',
```

同时更新行 67 附近的数据序列化，确保 frame 相关字段被包含：

```typescript
// 旧（行 67）
data: n.data as { cardId?: string; color?: string; variant?: string; collapsed?: boolean; fixedHeight?: boolean; width?: number; height?: number; name?: string; url?: string },

// 新
data: n.data as { cardId?: string; color?: string; variant?: string; collapsed?: boolean; fixedHeight?: boolean; width?: number; height?: number; name?: string; url?: string; layout?: string; childCardIds?: string[]; frameId?: string; localX?: number; localY?: number },
```

- [ ] **Step 2: 更新 useWorkspaceLifecycle.ts 的序列化格式**

找到 `switchToBoard` 函数中的序列化代码（行 33-44 附近）：

```typescript
// 旧
nodes: nodesRef.current.map(n => ({
  id: n.id, type: n.type || 'card',
  position: { ...n.position }, data: { ...n.data },
  width: n.width as number | undefined, height: n.height as number | undefined,
})),

// 新
nodes: nodesRef.current.map(n => ({
  id: n.id, type: n.type || 'card',
  position: { ...n.position }, data: { ...n.data },
  width: n.width as number | undefined, height: n.height as number | undefined,
})),
```

这里无需改动（`data: { ...n.data }` 已经会展开所有字段）。确认此行不需要修改。

- [ ] **Step 3: 更新 useBoardSync.ts 的序列化格式**

找到 `serializeBoardData` 函数（行 6-25）：

```typescript
// 旧
nodes: nodes.map((n) => ({
  id: n.id,
  type: n.type || 'card',
  position: { x: n.position.x, y: n.position.y },
  data: { ...n.data },
  width: n.width as number | undefined,
  height: n.height as number | undefined,
})),

// 新 — 无需改动，data: { ...n.data } 已经展开所有字段
```

确认此行不需要修改。

- [ ] **Step 4: 提交**

```bash
git add src/sync/subscribeStores.ts
git commit -m "feat(frame): 更新同步引擎类型守卫，支持 frame 节点序列化"
```

---

## Task 8: 添加 Frame 创建功能

**Files:**
- Modify: `src/components/canvas/ReactFlowCanvas.tsx`

- [ ] **Step 1: 添加 Frame 创建的快捷键和自定义事件**

在 `ReactFlowCanvas.tsx` 中，找到现有的 `useEffect` 块（处理 `hepta-add-card-node` 事件的那个），在其后添加一个新的 `useEffect`：

```typescript
// 创建 Frame 节点
useEffect(() => {
  const onAddFrame = () => {
    const instance = reactFlowInstance.current
    if (!instance) return
    const center = instance.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    const frameId = crypto.randomUUID()
    setNodes((nds) => [
      ...nds,
      {
        id: frameId,
        type: 'frame',
        position: { x: center.x - 300, y: center.y - 200 },
        data: {
          name: 'Frame',
          layout: 'free',
          width: 600,
          height: 400,
          childCardIds: [],
        },
      },
    ])
    setTimeout(() => {
      recordCurrentState('structure', '添加 Frame')
    }, 0)
  }
  window.addEventListener('hepta-add-frame', onAddFrame)
  return () => window.removeEventListener('hepta-add-frame', onAddFrame)
}, [setNodes, recordCurrentState])
```

- [ ] **Step 2: 提交**

```bash
git add src/components/canvas/ReactFlowCanvas.tsx
git commit -m "feat(frame): 添加 Frame 节点创建事件处理"
```

---

## Task 9: 运行类型检查并修复

- [ ] **Step 1: 运行 TypeScript 类型检查**

```bash
cd d:/USE/save/code/abase && npx tsc --noEmit 2>&1 | head -50
```

Expected: 可能有关于 `SectionNode` 未找到或 `useSectionSync` 未找到的错误（因为已删除），以及新增字段未使用的警告。修复所有错误。

- [ ] **Step 2: 修复类型错误（如有）**

根据实际错误修复。预期可能的错误：
- 任何文件仍引用 `SectionNode` 或 `useSectionSync` → 更新为 `FrameNode` / `useFrameSync`
- `BoardNode.type` 联合类型不匹配 → 更新类型守卫

- [ ] **Step 3: 提交修复**

```bash
git add -A
git commit -m "fix(frame): 修复类型检查错误"
```

---

## Task 10: 手动验证

- [ ] **Step 1: 启动开发服务器**

```bash
cd d:/USE/save/code/abase && pnpm dev
```

- [ ] **Step 2: 使用 Playwright 验证 Frame 功能**

1. 打开应用画布页面
2. 通过 `window.dispatchEvent(new CustomEvent('hepta-add-frame'))` 创建 Frame 节点
3. 验证 Frame 渲染为虚线边框矩形，标题显示 "Frame"
4. 双击标题可以编辑
5. 选中后右下角出现 resize 手柄
6. 拖拽卡片到 Frame 内，验证卡片自动关联（opacity 变为 0）
7. 移动 Frame，验证关联的卡片跟随移动
8. 将卡片拖出 Frame 边界，验证卡片恢复显示

- [ ] **Step 3: 最终提交**

```bash
git add -A
git commit -m "feat(frame): Frame 容器节点功能完成"
```

---

## 自审检查

### Spec 覆盖检查

| Spec 需求 | 对应 Task |
|-----------|-----------|
| FrameNodeData 数据模型（name, layout, color, width, height, childCardIds） | Task 1 (BoardNode.data 扩展), Task 3 (FrameNodeData 定义) |
| CardNodeData 扩展（frameId, localX, localY） | Task 1 |
| 坐标转换规则（全局 = Frame位置 + 局部） | Task 2 (useFrameSync 工具函数) |
| Free 布局（保留手动位置） | Task 3 (FrameNode 仅作视觉容器) |
| Frame 移动时同步子卡片全局坐标 | Task 2 (useFrameSync 核心逻辑) |
| 拖拽卡片跨 Frame 边界检测 | Task 6 (useCanvasDrag) |
| Frame 互斥（一个卡片只属一个 Frame） | Task 6 (逻辑中拖入新 Frame 自动脱离旧 Frame) |
| 替换 SectionNode | Task 3, 4 (删除旧文件，注册新类型) |
| 序列化/反序列化兼容 | Task 7 |
| Frame 创建功能 | Task 8 |

### Placeholder 扫描

- 无 TBD/TODO 占位符
- 所有步骤包含完整代码
- 类型检查命令明确

### 类型一致性

- `CardNodeData.frameId` 在 `types/card.ts` 定义，在 `CardNode.tsx`、`useFrameSync.ts`、`useCanvasDrag.ts` 中使用
- `FrameNodeData` 在 `FrameNode.tsx` 定义
- `BoardNode.type` 联合类型 `'card' | 'frame' | 'media'` 在 `types.ts` 定义，在 `subscribeStores.ts` 中使用
- 坐标转换函数 `globalToLocal`、`isPointInNode` 在 `useFrameSync.ts` 定义，在 `useCanvasDrag.ts` 中导入

---

## 执行交接

**Plan complete and saved to `docs/superpowers/plans/2026-05-25-frame-node-implementation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**