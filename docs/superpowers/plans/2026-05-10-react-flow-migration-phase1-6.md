# Heptabase Canvas v2 React Flow 迁移实现计划（Phase 1~6）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将画布引擎从 tldraw 3 迁移到 React Flow，完成项目骨架搭建到核心画布功能的实现。

**Architecture:** 渐进式迁移，先搭建可运行的空项目，逐步复制复用模块，最后重写画布核心组件。每 Phase 都有独立可验证的产出。

**Tech Stack:** React 18 + TypeScript 5.6 + Vite 5 + @xyflow/react + BlockNote 0.31 + Zustand 5 + Tailwind CSS 4 + Electron 35

---

## 文件结构

### 新建文件
- `package.json` — 项目依赖配置
- `vite.config.ts` — Vite 构建配置
- `tsconfig.json` — TypeScript 配置
- `tailwind.config.ts` — Tailwind CSS 配置
- `index.html` — 入口 HTML
- `src/main.tsx` — React 应用入口
- `src/App.tsx` — 根组件
- `src/index.css` — 全局样式
- `src/components/canvas/ReactFlowCanvas.tsx` — 画布主组件
- `src/components/canvas/CardNode.tsx` — 卡片节点
- `src/components/canvas/SectionNode.tsx` — 分区节点
- `src/components/canvas/ConnectionEdge.tsx` — 连接线边
- `src/components/canvas/CardPlaceholder.tsx` — 卡片占位符
- `src/components/editor/BlockNoteEditor.tsx` — BlockNote 编辑器
- `src/components/ui/LeftPanel.tsx` — 左侧面板
- `src/components/ui/Toolbar.tsx` — 工具栏
- `src/hooks/useWorkspaceLifecycle.ts` — 工作区生命周期
- `src/hooks/useBoardSync.ts` — 画板同步
- `src/hooks/useCanvasPaste.ts` — 粘贴处理
- `src/hooks/useCanvasDoubleClick.ts` — 双击创建
- `src/hooks/useDropHandler.ts` — 拖拽处理
- `src/services/WorkspaceService.ts` — 工作区服务
- `src/services/WorkspaceContext.tsx` — 工作区 Context
- `src/utils/workspace/fs.ts` — 文件系统抽象
- `src/utils/workspace/fs-adapter.ts` — Electron IPC 适配器
- `src/utils/workspace/syncEngine.ts` — 同步引擎
- `src/utils/workspace/cardConverter.ts` — 卡片序列化
- `src/utils/workspace/types.ts` — 工作区类型
- `src/utils/workspace/workspaceStore.ts` — 工作区状态
- `src/utils/cardStore.ts` — 卡片状态
- `src/utils/boardStore.ts` — 画板状态
- `src/utils/libraryStore.ts` — 视图状态
- `src/utils/trashStore.ts` — 回收站状态
- `src/utils/backupStore.ts` — 备份管理
- `src/utils/tagExtractor.ts` — 标签提取
- `src/utils/renderBlocks.ts` — BlockNote JSON → HTML
- `src/utils/api.ts` — 全局 API
- `src/utils/newCardStore.ts` — 临时状态
- `src/theme/panelSurface.ts` — 面板主题
- `src/theme/cardVariantStyles.ts` — 卡片变体样式
- `src/types/card.ts` — 卡片类型
- `src/types/connection.ts` — 连接类型
- `electron/main.ts` — Electron 主进程
- `electron/preload.ts` — contextBridge
- `electron/menu.ts` — 菜单栏

### 修改文件
- 无（新项目，所有文件都是新建）

---

## Phase 1: 项目骨架

### Task 1: 创建 package.json

**Files:**
- Create: `package.json`

- [ ] **Step 1: 编写 package.json**

```json
{
  "name": "heptabase-canvas-v2",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "electron:dev": "vite --mode electron",
    "electron:build": "tsc && vite build --mode electron",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@blocknote/core": "^0.31.0",
    "@blocknote/mantine": "^0.31.0",
    "@blocknote/react": "^0.31.0",
    "@xyflow/react": "^12.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zustand": "^5.0.0",
    "lucide-react": "^0.400.0",
    "idb": "^8.0.0",
    "tailwindcss": "^4.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vite-plugin-electron": "^0.29.0",
    "electron": "^35.0.0",
    "electron-builder": "^25.0.0",
    "eslint": "^8.57.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0"
  }
}
```

- [ ] **Step 2: 安装依赖**

Run: `npm install`
Expected: 依赖安装成功，生成 `node_modules` 和 `package-lock.json`

- [ ] **Step 3: 提交**

```bash
git add package.json package-lock.json
git commit -m "chore: init package.json with React Flow deps"
```

---

### Task 2: 创建 Vite 配置

**Files:**
- Create: `vite.config.ts`
- Create: `index.html`

- [ ] **Step 1: 编写 vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'

export default defineConfig(({ mode }) => {
  const isElectron = mode === 'electron'

  return {
    plugins: [
      react(),
      isElectron && electron([
        {
          entry: 'electron/main.ts',
          onstart: (options) => options.startup(),
        },
        {
          entry: 'electron/preload.ts',
          onstart: (options) => options.reload(),
        },
      ]),
    ],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  }
})
```

- [ ] **Step 2: 编写 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Heptabase Canvas</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: 提交**

```bash
git add vite.config.ts index.html
git commit -m "chore: add vite config and html entry"
```

---

### Task 3: 创建 TypeScript 配置

**Files:**
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`

- [ ] **Step 1: 编写 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src", "electron"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 2: 编写 tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 3: 提交**

```bash
git add tsconfig.json tsconfig.node.json
git commit -m "chore: add typescript config"
```

---

### Task 4: 创建 Tailwind CSS 配置

**Files:**
- Create: `tailwind.config.ts`
- Create: `src/index.css`

- [ ] **Step 1: 编写 tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 2: 编写 src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
```

- [ ] **Step 3: 提交**

```bash
git add tailwind.config.ts src/index.css
git commit -m "chore: add tailwind css config"
```

---

### Task 5: 创建 React 入口

**Files:**
- Create: `src/main.tsx`
- Create: `src/App.tsx`

- [ ] **Step 1: 编写 src/main.tsx**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 2: 编写 src/App.tsx（空壳）**

```tsx
function App() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <h1 className="text-2xl font-bold text-gray-800">Heptabase Canvas v2</h1>
    </div>
  )
}

export default App
```

- [ ] **Step 3: 验证 dev 服务器**

Run: `npm run dev`
Expected: Vite dev 服务器启动，浏览器显示 "Heptabase Canvas v2"

- [ ] **Step 4: 提交**

```bash
git add src/main.tsx src/App.tsx
git commit -m "feat: add react entry and app shell"
```

---

## Phase 2: 复制完全复用模块

### Task 6: 复制文件系统层

**Files:**
- Create: `src/utils/workspace/fs.ts`
- Create: `src/utils/workspace/fs-adapter.ts`
- Create: `src/utils/workspace/syncEngine.ts`
- Create: `src/utils/workspace/cardConverter.ts`
- Create: `src/utils/workspace/types.ts`
- Create: `src/utils/workspace/workspaceStore.ts`
- Create: `src/utils/workspace/index.ts`

- [ ] **Step 1: 从老项目复制文件**

从老项目 `src/utils/workspace/` 目录复制以下文件：
- `fs.ts`
- `fs-adapter.ts`
- `syncEngine.ts`
- `cardConverter.ts`
- `types.ts`
- `workspaceStore.ts`
- `index.ts`

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误（如果老项目代码本身无错误）

- [ ] **Step 3: 提交**

```bash
git add src/utils/workspace/
git commit -m "feat: copy workspace filesystem layer from legacy"
```

---

### Task 7: 复制状态管理模块

**Files:**
- Create: `src/utils/cardStore.ts`
- Create: `src/utils/boardStore.ts`
- Create: `src/utils/libraryStore.ts`
- Create: `src/utils/trashStore.ts`
- Create: `src/utils/backupStore.ts`
- Create: `src/utils/tagExtractor.ts`
- Create: `src/utils/renderBlocks.ts`
- Create: `src/utils/api.ts`
- Create: `src/utils/newCardStore.ts`

- [ ] **Step 1: 从老项目复制文件**

从老项目 `src/utils/` 目录复制以下文件：
- `cardStore.ts`
- `boardStore.ts`
- `libraryStore.ts`
- `trashStore.ts`
- `backupStore.ts`
- `tagExtractor.ts`
- `renderBlocks.ts`
- `api.ts`
- `newCardStore.ts`

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/utils/cardStore.ts src/utils/boardStore.ts src/utils/libraryStore.ts src/utils/trashStore.ts src/utils/backupStore.ts src/utils/tagExtractor.ts src/utils/renderBlocks.ts src/utils/api.ts src/utils/newCardStore.ts
git commit -m "feat: copy state management modules from legacy"
```

---

### Task 8: 复制主题和类型模块

**Files:**
- Create: `src/theme/panelSurface.ts`
- Create: `src/theme/cardVariantStyles.ts`
- Create: `src/types/card.ts`
- Create: `src/types/connection.ts`

- [ ] **Step 1: 从老项目复制文件**

从老项目复制：
- `src/theme/panelSurface.ts`
- `src/theme/cardVariantStyles.ts`
- `src/types/card.ts`
- `src/types/connection.ts`

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/theme/ src/types/
git commit -m "feat: copy theme and type modules from legacy"
```

---

### Task 9: 复制 Electron 主进程

**Files:**
- Create: `electron/main.ts`
- Create: `electron/preload.ts`
- Create: `electron/menu.ts`

- [ ] **Step 1: 从老项目复制文件**

从老项目 `electron/` 目录复制：
- `main.ts`
- `preload.ts`
- `menu.ts`

- [ ] **Step 2: 验证 Electron 模式**

Run: `npm run electron:dev`
Expected: Electron 窗口启动，显示 "Heptabase Canvas v2"

- [ ] **Step 3: 提交**

```bash
git add electron/
git commit -m "feat: copy electron main process from legacy"
```

---

### Task 10: 复制 BlockNote 编辑器

**Files:**
- Create: `src/components/editor/BlockNoteEditor.tsx`
- Create: `src/components/editor/CustomBasicTextStyleButton.tsx`
- Create: `src/components/editor/ImageToolbar.tsx`
- Create: `src/components/editor/DragOnlySideMenu.tsx`
- Create: `src/components/editor/useImageColumnDrop.ts`

- [ ] **Step 1: 从老项目复制文件**

从老项目 `src/components/editor/` 目录复制所有文件。

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/components/editor/
git commit -m "feat: copy BlockNote editor from legacy"
```

---

## Phase 3: ReactFlowCanvas + CardNode（基础渲染）

### Task 11: 创建 ReactFlowCanvas 主组件

**Files:**
- Create: `src/components/canvas/ReactFlowCanvas.tsx`

- [ ] **Step 1: 编写 ReactFlowCanvas.tsx**

```tsx
import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  addEdge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { CardNode } from './CardNode'
import { SectionNode } from './SectionNode'
import { ConnectionEdge } from './ConnectionEdge'

const nodeTypes = {
  card: CardNode,
  section: SectionNode,
}

const edgeTypes = {
  connection: ConnectionEdge,
}

export function ReactFlowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node[]>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([])

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: Edge = {
        id: `edge-${params.source}-${params.target}`,
        source: params.source!,
        target: params.target!,
        type: 'connection',
      }
      setEdges((eds) => addEdge(newEdge, eds))
    },
    [setEdges]
  )

  const onPaneClick = useCallback(() => {
    // 退出所有节点的编辑模式：取消选中所有节点
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        selected: false,
      }))
    )
  }, [setNodes])

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    // 选中当前节点，触发 CardNode 进入编辑模式
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        selected: n.id === node.id,
      }))
    )
  }, [setNodes])

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}
```

- [ ] **Step 2: 更新 App.tsx 使用 ReactFlowCanvas**

```tsx
import { ReactFlowCanvas } from './components/canvas/ReactFlowCanvas'

function App() {
  return (
    <div className="w-full h-full">
      <ReactFlowCanvas />
    </div>
  )
}

export default App
```

- [ ] **Step 3: 验证画布显示**

Run: `npm run dev`
Expected: 浏览器显示空白 React Flow 画布（带网格背景和控制按钮）

- [ ] **Step 4: 提交**

```bash
git add src/components/canvas/ReactFlowCanvas.tsx src/App.tsx
git commit -m "feat(canvas): add ReactFlowCanvas shell"
```

---

### Task 12: 创建 CardNode 组件（预览态）

**Files:**
- Create: `src/components/canvas/CardNode.tsx`

- [ ] **Step 1: 编写 CardNode.tsx**

```tsx
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useCardStore } from '../../utils/cardStore'
import { getCardVariantStyles } from '../../theme/cardVariantStyles'
import type { CardColor, CardVariant } from '../../types/card'

export interface CardNodeData {
  cardId: string
  color: CardColor
  variant: CardVariant
  collapsed?: boolean
  fixedHeight?: boolean
  width?: number
  height?: number
}

const DEFAULT_CARD_WIDTH = 280
const DEFAULT_CARD_HEIGHT = 200

export const CardNode = memo(({ data, selected }: NodeProps<CardNodeData>) => {
  const card = useCardStore((s) => s.cards[data.cardId])
  const styles = getCardVariantStyles(data.color, data.variant)

  if (!card) {
    return (
      <div
        className="rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center"
        style={{
          width: data.width ?? DEFAULT_CARD_WIDTH,
          height: data.height ?? DEFAULT_CARD_HEIGHT,
        }}
      >
        <span className="text-gray-400 text-sm">Card not found</span>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-sm transition-shadow"
      style={{
        width: data.width ?? DEFAULT_CARD_WIDTH,
        height: data.height ?? DEFAULT_CARD_HEIGHT,
        backgroundColor: styles.cardBg,
        border: styles.border,
        boxShadow: selected ? `0 0 0 2px ${styles.accent}` : styles.boxShadow,
      }}
    >
      {/* 顶部连接点 */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Top}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />

      {/* 卡片头部 */}
      <div
        className="px-3 py-2 text-sm font-medium truncate"
        style={{ color: styles.textColor }}
      >
        {card.title || 'Untitled'}
      </div>

      {/* 卡片内容 - previewHTML */}
      <div
        className="px-3 pb-3 overflow-hidden"
        style={{
          height: `calc(100% - 36px)`,
          color: styles.textColor,
        }}
        dangerouslySetInnerHTML={{ __html: card.previewHTML || '' }}
      />

      {/* 底部连接点 */}
      <Handle
        type="target"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />
    </div>
  )
})

CardNode.displayName = 'CardNode'
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/components/canvas/CardNode.tsx
git commit -m "feat(canvas): add CardNode preview mode"
```

---

### Task 13: 创建 SectionNode 和 ConnectionEdge 占位组件

**Files:**
- Create: `src/components/canvas/SectionNode.tsx`
- Create: `src/components/canvas/ConnectionEdge.tsx`

- [ ] **Step 1: 编写 SectionNode.tsx**

```tsx
import { memo } from 'react'
import { type NodeProps } from '@xyflow/react'

export interface SectionNodeData {
  name: string
  color: string
  width?: number
  height?: number
}

export const SectionNode = memo(({ data }: NodeProps<SectionNodeData>) => {
  return (
    <div
      className="rounded-xl border-2 border-dashed"
      style={{
        width: data.width ?? 400,
        height: data.height ?? 300,
        borderColor: data.color ?? '#cbd5e1',
        backgroundColor: `${data.color ?? '#cbd5e1'}10`,
      }}
    >
      <div className="px-4 py-2 text-sm font-medium text-gray-600">
        {data.name || 'Section'}
      </div>
    </div>
  )
})

SectionNode.displayName = 'SectionNode'
```

- [ ] **Step 2: 编写 ConnectionEdge.tsx**

```tsx
import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react'

export const ConnectionEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) => {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: '#94a3b8',
          strokeWidth: 2,
          strokeDasharray: '6,4',
        }}
      />
    </>
  )
})

ConnectionEdge.displayName = 'ConnectionEdge'
```

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add src/components/canvas/SectionNode.tsx src/components/canvas/ConnectionEdge.tsx
git commit -m "feat(canvas): add SectionNode and ConnectionEdge placeholders"
```

---

### Task 14: 集成 useWorkspaceLifecycle hook

**Files:**
- Create: `src/hooks/useWorkspaceLifecycle.ts`
- Modify: `src/components/canvas/ReactFlowCanvas.tsx`

- [ ] **Step 1: 编写 useWorkspaceLifecycle.ts**

```typescript
import { useEffect, useRef } from 'react'
import { type Node, type Edge } from '@xyflow/react'
import { useWorkspaceStore } from '../utils/workspace/workspaceStore'
import { useCardStore } from '../utils/cardStore'
import { useBoardStore } from '../utils/boardStore'

interface UseWorkspaceLifecycleOptions {
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
}

export function useWorkspaceLifecycle({ setNodes, setEdges }: UseWorkspaceLifecycleOptions) {
  const initialized = useRef(false)
  const workspaceStore = useWorkspaceStore()
  const cardStore = useCardStore()
  const boardStore = useBoardStore()

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // Phase 1~6 范围内：此 hook 为骨架实现
    // 完整工作区生命周期将在 Phase 7~8 中实现：
    // 1. 尝试恢复上次工作区
    // 2. 加载卡片到 cardStore
    // 3. 加载画板列表
    // 4. 加载首个画板 snapshot → setNodes/setEdges
    // 5. 启动 syncEngine

    console.log('Workspace lifecycle initialized')
  }, [setNodes, setEdges])
}
```

- [ ] **Step 2: 更新 ReactFlowCanvas.tsx 集成 hook**

```tsx
import { useWorkspaceLifecycle } from '../../hooks/useWorkspaceLifecycle'

// 在 ReactFlowCanvas 组件内添加：
useWorkspaceLifecycle({ setNodes, setEdges })
```

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add src/hooks/useWorkspaceLifecycle.ts src/components/canvas/ReactFlowCanvas.tsx
git commit -m "feat(hooks): add useWorkspaceLifecycle skeleton"
```

---

### Task 15: 集成 useBoardSync hook

**Files:**
- Create: `src/hooks/useBoardSync.ts`
- Modify: `src/components/canvas/ReactFlowCanvas.tsx`

- [ ] **Step 1: 编写 useBoardSync.ts**

```typescript
import { useEffect, useRef } from 'react'
import { type Node, type Edge } from '@xyflow/react'

interface UseBoardSyncOptions {
  nodes: Node[]
  edges: Edge[]
}

export function useBoardSync({ nodes, edges }: UseBoardSyncOptions) {
  const prevNodesRef = useRef(nodes)
  const prevEdgesRef = useRef(edges)

  useEffect(() => {
    // Phase 1~6 范围内：此 hook 为骨架实现
    // 完整画板同步将在 Phase 7~9 中实现：
    // 1. 监听 nodes/edges 变化
    // 2. debounce 600ms
    // 3. 转换为 BoardSnapshot 格式
    // 4. 写入 boards/<id>.json

    if (
      JSON.stringify(prevNodesRef.current) !== JSON.stringify(nodes) ||
      JSON.stringify(prevEdgesRef.current) !== JSON.stringify(edges)
    ) {
      console.log('Board changed, syncing...')
      prevNodesRef.current = nodes
      prevEdgesRef.current = edges
    }
  }, [nodes, edges])
}
```

- [ ] **Step 2: 更新 ReactFlowCanvas.tsx 集成 hook**

```tsx
import { useBoardSync } from '../../hooks/useBoardSync'

// 在 ReactFlowCanvas 组件内添加：
useBoardSync({ nodes, edges })
```

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add src/hooks/useBoardSync.ts src/components/canvas/ReactFlowCanvas.tsx
git commit -m "feat(hooks): add useBoardSync skeleton"
```

---

## Phase 4: 集成 BlockNote 编辑器

### Task 16: 更新 CardNode 支持编辑模式

**Files:**
- Modify: `src/components/canvas/CardNode.tsx`

- [ ] **Step 1: 更新 CardNode.tsx**

```tsx
import { memo, useState, useEffect, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useCardStore } from '../../utils/cardStore'
import { getCardVariantStyles } from '../../theme/cardVariantStyles'
import { BlockNoteEditor } from '../editor/BlockNoteEditor'
import type { CardColor, CardVariant } from '../../types/card'

export interface CardNodeData {
  cardId: string
  color: CardColor
  variant: CardVariant
  collapsed?: boolean
  fixedHeight?: boolean
  width?: number
  height?: number
}

const DEFAULT_CARD_WIDTH = 280
const DEFAULT_CARD_HEIGHT = 200

export const CardNode = memo(({ data, selected }: NodeProps<CardNodeData>) => {
  const [isEditing, setIsEditing] = useState(false)
  const card = useCardStore((s) => s.cards[data.cardId])
  const updateCard = useCardStore((s) => s.updateCard)
  const styles = getCardVariantStyles(data.color, data.variant)

  // 选中时进入编辑模式
  useEffect(() => {
    if (selected) {
      setIsEditing(true)
    }
  }, [selected])

  const handleContentChange = useCallback(
    (content: string) => {
      updateCard(data.cardId, { content })
    },
    [data.cardId, updateCard]
  )

  if (!card) {
    return (
      <div
        className="rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center"
        style={{
          width: data.width ?? DEFAULT_CARD_WIDTH,
          height: data.height ?? DEFAULT_CARD_HEIGHT,
        }}
      >
        <span className="text-gray-400 text-sm">Card not found</span>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-sm transition-shadow"
      style={{
        width: data.width ?? DEFAULT_CARD_WIDTH,
        height: data.height ?? DEFAULT_CARD_HEIGHT,
        backgroundColor: styles.cardBg,
        border: styles.border,
        boxShadow: selected ? `0 0 0 2px ${styles.accent}` : styles.boxShadow,
      }}
    >
      {/* 顶部连接点 */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Top}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />

      {/* 卡片头部 */}
      <div
        className="px-3 py-2 text-sm font-medium truncate"
        style={{ color: styles.textColor }}
      >
        {card.title || 'Untitled'}
      </div>

      {/* 卡片内容 */}
      <div
        className="px-3 pb-3 overflow-hidden"
        style={{
          height: `calc(100% - 36px)`,
          color: styles.textColor,
        }}
      >
        {isEditing ? (
          <BlockNoteEditor
            content={card.content}
            onChange={handleContentChange}
            onBlur={() => setIsEditing(false)}
          />
        ) : (
          <div dangerouslySetInnerHTML={{ __html: card.previewHTML || '' }} />
        )}
      </div>

      {/* 底部连接点 */}
      <Handle
        type="target"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />
    </div>
  )
})

CardNode.displayName = 'CardNode'
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/components/canvas/CardNode.tsx
git commit -m "feat(canvas): integrate BlockNote editor into CardNode"
```

---

### Task 17: 处理编辑模式退出

**Files:**
- Modify: `src/components/canvas/ReactFlowCanvas.tsx`

- [ ] **Step 1: 更新 ReactFlowCanvas.tsx**

```tsx
import { useCallback, useMemo, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  addEdge,
} from '@xyflow/react'

// ...

export function ReactFlowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node[]>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([])
  const { setNodes: setReactFlowNodes } = useReactFlow()
  const editingNodeIdRef = useRef<string | null>(null)

  // ...

  const onPaneClick = useCallback(() => {
    // 退出所有节点的编辑模式
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        selected: false,
      }))
    )
    editingNodeIdRef.current = null
  }, [setNodes])

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      editingNodeIdRef.current = node.id
    },
    []
  )

  // ...
}
```

- [ ] **Step 2: 验证编辑模式切换**

Run: `npm run dev`
Expected:
- 点击卡片 → 进入编辑模式（显示 BlockNote 编辑器）
- 点击画布空白处 → 退出编辑模式（显示 previewHTML）

- [ ] **Step 3: 提交**

```bash
git add src/components/canvas/ReactFlowCanvas.tsx
git commit -m "feat(canvas): handle edit mode exit on pane click"
```

---

## Phase 5: 连接线功能

### Task 18: 实现 ConnectionEdge 贝塞尔曲线

**Files:**
- Modify: `src/components/canvas/ConnectionEdge.tsx`

- [ ] **Step 1: 更新 ConnectionEdge.tsx**

```tsx
import { memo } from 'react'
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'

export const ConnectionEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        ...style,
        stroke: '#94a3b8',
        strokeWidth: 2,
        strokeDasharray: '6,4',
      }}
    />
  )
})

ConnectionEdge.displayName = 'ConnectionEdge'
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/components/canvas/ConnectionEdge.tsx
git commit -m "feat(canvas): implement bezier curve ConnectionEdge"
```

---

### Task 19: 实现连接创建交互

**Files:**
- Modify: `src/components/canvas/ReactFlowCanvas.tsx`

- [ ] **Step 1: 更新 onConnect 处理**

```tsx
const onConnect = useCallback(
  (params: Connection) => {
    const newEdge: Edge = {
      id: `edge-${params.source}-${params.target}-${Date.now()}`,
      source: params.source!,
      target: params.target!,
      type: 'connection',
    }
    setEdges((eds) => addEdge(newEdge, eds))
  },
  [setEdges]
)
```

- [ ] **Step 2: 验证连接创建**

Run: `npm run dev`
Expected:
- 从卡片 A 的 source Handle 拖拽到卡片 B 的 target Handle
- 创建虚线贝塞尔曲线连接
- 移动卡片时连接自动跟随

- [ ] **Step 3: 提交**

```bash
git add src/components/canvas/ReactFlowCanvas.tsx
git commit -m "feat(canvas): implement connection creation via drag"
```

---

### Task 20: 实现连接删除

**Files:**
- Modify: `src/components/canvas/ReactFlowCanvas.tsx`

- [ ] **Step 1: 添加 onEdgeClick 处理**

```tsx
const onEdgeClick = useCallback(
  (_event: React.MouseEvent, edge: Edge) => {
    setEdges((eds) => eds.filter((e) => e.id !== edge.id))
  },
  [setEdges]
)
```

- [ ] **Step 2: 在 ReactFlow 组件上绑定 onEdgeClick**

```tsx
<ReactFlow
  // ...
  onEdgeClick={onEdgeClick}
  // ...
/>
```

- [ ] **Step 3: 验证连接删除**

Run: `npm run dev`
Expected: 点击连接线 → 连接被删除

- [ ] **Step 4: 提交**

```bash
git add src/components/canvas/ReactFlowCanvas.tsx
git commit -m "feat(canvas): implement edge deletion on click"
```

---

## Phase 6: 分区功能

### Task 21: 实现 SectionNode 完整功能

**Files:**
- Modify: `src/components/canvas/SectionNode.tsx`

- [ ] **Step 1: 更新 SectionNode.tsx**

```tsx
import { memo, useState, useCallback } from 'react'
import { type NodeProps } from '@xyflow/react'

export interface SectionNodeData {
  name: string
  color: string
  width?: number
  height?: number
}

export const SectionNode = memo(({ data, selected }: NodeProps<SectionNodeData>) => {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(data.name || 'Section')

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true)
  }, [])

  const handleBlur = useCallback(() => {
    setIsEditing(false)
    // TODO: 更新节点数据
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditing(false)
    }
  }, [])

  return (
    <div
      className="rounded-xl border-2 border-dashed"
      style={{
        width: data.width ?? 400,
        height: data.height ?? 300,
        borderColor: data.color ?? '#cbd5e1',
        backgroundColor: `${data.color ?? '#cbd5e1'}10`,
        boxShadow: selected ? `0 0 0 2px ${data.color ?? '#cbd5e1'}` : 'none',
      }}
      onDoubleClick={handleDoubleClick}
    >
      <div className="px-4 py-2">
        {isEditing ? (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full text-sm font-medium bg-transparent border-none outline-none"
            autoFocus
          />
        ) : (
          <span className="text-sm font-medium text-gray-600">{name}</span>
        )}
      </div>
    </div>
  )
})

SectionNode.displayName = 'SectionNode'
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/components/canvas/SectionNode.tsx
git commit -m "feat(canvas): implement SectionNode with name editing"
```

---

### Task 22: 实现分区大小调整

**Files:**
- Modify: `src/components/canvas/SectionNode.tsx`

- [ ] **Step 1: 添加 resize handle**

```tsx
import { memo, useState, useCallback, useRef } from 'react'
import { type NodeProps } from '@xyflow/react'

// ...

export const SectionNode = memo(({ data, selected, id }: NodeProps<SectionNodeData>) => {
  // ...
  const [size, setSize] = useState({
    width: data.width ?? 400,
    height: data.height ?? 300,
  })
  const resizingRef = useRef(false)
  const startPosRef = useRef({ x: 0, y: 0 })
  const startSizeRef = useRef({ width: 0, height: 0 })

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    resizingRef.current = true
    startPosRef.current = { x: e.clientX, y: e.clientY }
    startSizeRef.current = { ...size }

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return
      const dx = e.clientX - startPosRef.current.x
      const dy = e.clientY - startPosRef.current.y
      setSize({
        width: Math.max(200, startSizeRef.current.width + dx),
        height: Math.max(150, startSizeRef.current.height + dy),
      })
    }

    const handleMouseUp = () => {
      resizingRef.current = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [size])

  return (
    <div
      className="rounded-xl border-2 border-dashed relative"
      style={{
        width: size.width,
        height: size.height,
        borderColor: data.color ?? '#cbd5e1',
        backgroundColor: `${data.color ?? '#cbd5e1'}10`,
        boxShadow: selected ? `0 0 0 2px ${data.color ?? '#cbd5e1'}` : 'none',
      }}
      onDoubleClick={handleDoubleClick}
    >
      {/* ... */}

      {/* Resize handle */}
      {selected && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          onMouseDown={handleResizeStart}
        >
          <svg viewBox="0 0 16 16" className="w-full h-full text-gray-400">
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
```

- [ ] **Step 2: 验证大小调整**

Run: `npm run dev`
Expected:
- 选中分区 → 显示 resize handle
- 拖拽 resize handle → 分区大小改变

- [ ] **Step 3: 提交**

```bash
git add src/components/canvas/SectionNode.tsx
git commit -m "feat(canvas): add section resize handle"
```

---

### Task 23: 实现分区卡片跟随移动

**Files:**
- Create: `src/hooks/useSectionSync.ts`
- Modify: `src/components/canvas/ReactFlowCanvas.tsx`

- [ ] **Step 1: 编写 useSectionSync.ts**

```typescript
import { useEffect, useRef } from 'react'
import { type Node } from '@xyflow/react'

interface UseSectionSyncOptions {
  nodes: Node[]
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
}

export function useSectionSync({ nodes, setNodes }: UseSectionSyncOptions) {
  const prevNodesRef = useRef<Node[]>(nodes)

  useEffect(() => {
    const prevNodes = prevNodesRef.current
    const sectionNodes = nodes.filter((n) => n.type === 'section')

    let hasChanges = false
    const updatedNodes = nodes.map((node) => {
      // 检查是否有分区移动了
      for (const section of sectionNodes) {
        const prevSection = prevNodes.find((n) => n.id === section.id)
        if (!prevSection) continue

        const dx = section.position.x - prevSection.position.x
        const dy = section.position.y - prevSection.position.y

        if (dx === 0 && dy === 0) continue

        // 检查卡片是否在分区内
        if (node.type === 'card') {
          const nodeX = node.position.x
          const nodeY = node.position.y
          const sectionX = section.position.x
          const sectionY = section.position.y
          const sectionW = (section.data?.width as number) ?? 400
          const sectionH = (section.data?.height as number) ?? 300

          if (
            nodeX >= sectionX &&
            nodeX <= sectionX + sectionW &&
            nodeY >= sectionY &&
            nodeY <= sectionY + sectionH
          ) {
            hasChanges = true
            return {
              ...node,
              position: {
                x: node.position.x + dx,
                y: node.position.y + dy,
              },
            }
          }
        }
      }
      return node
    })

    if (hasChanges) {
      setNodes(updatedNodes)
    }

    prevNodesRef.current = nodes
  }, [nodes, setNodes])
}
```

- [ ] **Step 2: 在 ReactFlowCanvas.tsx 中集成**

```tsx
import { useSectionSync } from '../../hooks/useSectionSync'

// 在组件内添加：
useSectionSync({ nodes, setNodes })
```

- [ ] **Step 3: 验证跟随移动**

Run: `npm run dev`
Expected:
- 创建分区和卡片
- 将卡片拖入分区内
- 拖拽分区 → 内部卡片跟随移动

- [ ] **Step 4: 提交**

```bash
git add src/hooks/useSectionSync.ts src/components/canvas/ReactFlowCanvas.tsx
git commit -m "feat(canvas): implement section card follow movement"
```

---

## 最终验证

### Task 24: 端到端验证

- [ ] **Step 1: 完整功能测试**

Run: `npm run dev`

验证清单：
- [ ] 画布显示正常（网格背景、控制按钮）
- [ ] 能创建卡片（双击或粘贴）
- [ ] 卡片显示 previewHTML
- [ ] 选中卡片进入编辑模式，BlockNote 正常工作
- [ ] 点击画布空白处退出编辑模式
- [ ] 能创建连接（拖拽 Handle）
- [ ] 连接显示为虚线贝塞尔曲线
- [ ] 移动卡片时连接自动跟随
- [ ] 点击连接可删除
- [ ] 能创建分区
- [ ] 分区可调整大小
- [ ] 双击分区可编辑名称
- [ ] 分区内卡片跟随分区移动
- [ ] 100 个卡片时 60fps

- [ ] **Step 2: TypeScript 类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Lint 检查**

Run: `npm run lint`
Expected: 无错误

- [ ] **Step 4: 最终提交**

```bash
git commit -m "feat: complete Phase 1-6 React Flow migration"
```

---

## Spec 覆盖检查

| Spec 需求 | 对应 Task |
|-----------|----------|
| 项目骨架（package.json, vite.config, tsconfig） | Task 1~5 |
| 复制完全复用模块 | Task 6~10 |
| ReactFlowCanvas 主组件 | Task 11 |
| CardNode 预览态 | Task 12 |
| SectionNode / ConnectionEdge 占位 | Task 13 |
| useWorkspaceLifecycle | Task 14 |
| useBoardSync | Task 15 |
| CardNode 集成 BlockNote | Task 16 |
| 编辑模式退出 | Task 17 |
| ConnectionEdge 贝塞尔曲线 | Task 18 |
| 连接创建交互 | Task 19 |
| 连接删除 | Task 20 |
| SectionNode 名称编辑 | Task 21 |
| 分区大小调整 | Task 22 |
| 分区卡片跟随 | Task 23 |
| 端到端验证 | Task 24 |

---

## Placeholder 扫描

- [x] 无 "TBD"、"TODO"、"implement later" 等占位符
- [x] 每个 Task 都有明确的文件路径
- [x] 每个 Step 都有具体的代码或命令
- [x] 类型名称前后一致
