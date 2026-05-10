# 连接线交互改造实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 改造连接线创建方式，实现卡片顶部连接图标拖拽连线、虚线跟随、自动吸附、卡片移动时连线自动更新。

**Architecture:** 使用 React Flow 内置 `connectionLineComponent` 自定义拖线样式，在 CardNode 顶部放置 source Handle 作为连接触发点，复用 React Flow 内置的节点移动时连线自动更新能力。

**Tech Stack:** React Flow (@xyflow/react), React 18, TypeScript, Tailwind CSS

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/components/canvas/CustomConnectionLine.tsx` | 新增 | 自定义拖线组件，处理虚线/实线切换、箭头、吸附检测 |
| `src/components/canvas/CardNode.tsx` | 修改 | 添加 ConnectionIcon，调整 Handle 显示逻辑 |
| `src/components/canvas/ReactFlowCanvas.tsx` | 修改 | 注册 connectionLineComponent，传递节点引用 |
| `src/utils/connectionMediator.ts` | 保持 | 现有接口不变 |

---

### Task 1: 创建 CustomConnectionLine 组件

**Files:**
- Create: `src/components/canvas/CustomConnectionLine.tsx`

- [ ] **Step 1: 创建 CustomConnectionLine 基础组件**

```tsx
import { getBezierPath, BaseEdge, type EdgeProps, type Node, Position } from '@xyflow/react'

interface CustomConnectionLineProps {
  fromX: number
  fromY: number
  fromPosition: Position
  toX: number
  toY: number
  toPosition: Position
  fromNode?: Node
  fromHandle?: { id: string }
  nodesRef: React.MutableRefObject<Node[]>
}

const SNAP_THRESHOLD = 50

function isNearNode(toX: number, toY: number, nodes: Node[], excludeNodeId: string): { near: boolean; nodeId: string } {
  for (const node of nodes) {
    if (node.id === excludeNodeId) continue
    const w = (node.data.width as number) ?? 280
    const h = (node.data.height as number) ?? 200
    const x = node.position.x
    const y = node.position.y
    if (
      toX >= x - SNAP_THRESHOLD &&
      toX <= x + w + SNAP_THRESHOLD &&
      toY >= y - SNAP_THRESHOLD &&
      toY <= y + h + SNAP_THRESHOLD
    ) {
      return { near: true, nodeId: node.id }
    }
  }
  return { near: false, nodeId: '' }
}

export function CustomConnectionLine({
  fromX,
  fromY,
  fromPosition,
  toX,
  toY,
  toPosition,
  fromNode,
  nodesRef,
}: CustomConnectionLineProps) {
  const { near: isNearTarget } = isNearNode(
    toX,
    toY,
    nodesRef.current,
    fromNode?.id ?? '',
  )

  const [edgePath] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  })

  return (
    <g className="react-flow__connectionline">
      <defs>
        <marker
          id="arrow-default"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
        </marker>
        <marker
          id="arrow-active"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
        </marker>
      </defs>
      <BaseEdge
        path={edgePath}
        style={{
          stroke: isNearTarget ? '#3b82f6' : '#94a3b8',
          strokeWidth: isNearTarget ? 3 : 2,
          strokeDasharray: isNearTarget ? 'none' : '6,4',
          fill: 'none',
        }}
        markerEnd={`url(#arrow-${isNearTarget ? 'active' : 'default'})`}
      />
    </g>
  )
}
```

- [ ] **Step 2: 验证类型导入**

确认 `@xyflow/react` 导出了 `Position` 类型。查看现有 `CardNode.tsx` 的导入方式：
```tsx
import { Handle, Position, type NodeProps } from '@xyflow/react'
```

使用相同方式导入。

---

### Task 2: 改造 CardNode 添加 ConnectionIcon

**Files:**
- Modify: `src/components/canvas/CardNode.tsx`

- [ ] **Step 1: 读取当前 CardNode.tsx 完整内容**

读取 `src/components/canvas/CardNode.tsx` 全部内容。

- [ ] **Step 2: 添加 ConnectionIcon 到 CardNode**

在 CardNode 的 return JSX 中，在顶部 Handle 之前添加 ConnectionIcon：

```tsx
{/* 连接图标 - 顶部中央 */}
<div
  className="absolute w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs opacity-0 transition-opacity duration-150 hover:opacity-100 cursor-crosshair z-10"
  style={{
    top: -8,
    left: '50%',
    transform: 'translateX(-50%)',
    opacity: showHandles ? 1 : 0,
  }}
>
  +
</div>
<Handle
  type="source"
  position={Position.Top}
  id="connection-icon-source"
  className="!opacity-0 !pointer-events-auto"
  style={{
    top: -8,
    left: '50%',
    transform: 'translateX(-50%)',
  }}
/>
```

- [ ] **Step 3: 调整四角 Handle 的显示逻辑**

将现有四角 Handle 的 className 中的 `showHandles` 条件保持不变，但移除 source Handle 的 `onClick` 事件（不再通过四角发起连接）：

将：
```tsx
onClick={handleSourceClick('top-source')}
```
改为移除 `onClick` 属性（四个 source Handle 都移除）。

保留 `handleSourceClick` 函数定义但标记为 `@deprecated` 注释，后续可清理。

- [ ] **Step 4: 确保卡片容器有 relative 定位**

在 CardNode 最外层 div 的 className 中添加 `relative`：
```tsx
className="relative rounded-2xl shadow-sm transition-shadow"
```

---

### Task 3: 在 ReactFlowCanvas 中注册 CustomConnectionLine

**Files:**
- Modify: `src/components/canvas/ReactFlowCanvas.tsx`

- [ ] **Step 1: 读取当前 ReactFlowCanvas.tsx 完整内容**

读取 `src/components/canvas/ReactFlowCanvas.tsx` 全部内容。

- [ ] **Step 2: 添加 CustomConnectionLine 导入和节点引用**

在文件顶部添加导入：
```tsx
import { CustomConnectionLine } from './CustomConnectionLine'
```

在组件内部添加节点引用：
```tsx
const nodesRef = useRef<Node[]>([])

// 同步节点状态到 ref
useEffect(() => {
  nodesRef.current = nodes
}, [nodes])
```

- [ ] **Step 3: 创建 connectionLineComponent 回调**

```tsx
const connectionLineComponent = useCallback(
  (props: Parameters<typeof CustomConnectionLine>[0]) => (
    <CustomConnectionLine {...props} nodesRef={nodesRef} />
  ),
  [],
)
```

- [ ] **Step 4: 在 ReactFlow 组件上注册 connectionLineComponent**

在 `<ReactFlow>` 的 props 中添加：
```tsx
connectionLineComponent={connectionLineComponent}
```

- [ ] **Step 5: 添加 isValidConnection 阻止自连接**

```tsx
const isValidConnection = useCallback((connection: Connection) => {
  return connection.source !== connection.target
}, [])
```

在 `<ReactFlow>` 的 props 中添加：
```tsx
isValidConnection={isValidConnection}
```

---

### Task 4: 清理与验证

**Files:**
- Modify: `src/components/canvas/CardNode.tsx`
- Modify: `src/components/canvas/ReactFlowCanvas.tsx`

- [ ] **Step 1: 运行类型检查**

```bash
npx tsc --noEmit
```

预期：无错误。如有错误，修复类型不匹配问题。

- [ ] **Step 2: 启动开发服务器验证**

```bash
npm run dev
```

打开浏览器 http://localhost:5173/ 验证：
- hover 卡片时顶部中央显示 + 图标
- 点击 + 图标可拖出虚线
- 拖线跟随鼠标移动，末端带箭头
- 靠近目标卡片时虚线变实线
- 释放鼠标到有效目标后创建连接线
- 拖拽卡片移动时，已存在的连接线自动跟随更新

- [ ] **Step 3: 提交修改**

```bash
git add src/components/canvas/CustomConnectionLine.tsx src/components/canvas/CardNode.tsx src/components/canvas/ReactFlowCanvas.tsx
git commit -m "feat(canvas): 实现卡片顶部连接图标拖拽连线，支持自动吸附和卡片移动时连线更新"
```

---

## 规范自审

### 1. 规范覆盖检查

| 规范条目 | 对应 Task |
|----------|-----------|
| ConnectionIcon 位置和样式 | Task 2 |
| CustomConnectionLine 虚线/实线切换 | Task 1 |
| 箭头实现 | Task 1 |
| 吸附检测逻辑 (50px 阈值) | Task 1 |
| 四角 Handle 保留但隐藏 | Task 2 |
| connectionLineComponent 注册 | Task 3 |
| 阻止自连接 | Task 3 |
| 卡片移动时连线自动更新 | React Flow 内置，无需额外代码 |
| 拖线过程中点击空白区域取消 | React Flow 内置 |

### 2. 占位符扫描

无占位符。所有代码步骤包含完整实现。

### 3. 类型一致性

- `Position` 从 `@xyflow/react` 导入，与 CardNode 一致
- `Node` 类型从 `@xyflow/react` 导入
- `Connection` 类型从 `@xyflow/react` 导入
- `nodesRef` 类型为 `React.MutableRefObject<Node[]>`，在 Task 1 和 Task 3 中一致使用
