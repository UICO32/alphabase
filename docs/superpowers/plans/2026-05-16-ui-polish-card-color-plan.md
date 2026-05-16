# UI Polish & Card Color System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix workspace switch bug, fix numeric board name bug, fix cursor styles, overhaul card color system (remove variant, add 10-color palette with stroke+fill), improve connection line logic (edge-to-edge routing, solid confirmed lines), and clean up code (remove dead code, split large components).

**Architecture:** Bottom-up — fix data types first (card.ts), then update stores/converters, then fix bugs, then update UI components, then split components. Each task produces working, testable software.

**Tech Stack:** React 18, TypeScript 5.6, Zustand 5, React Flow, Tailwind CSS 4

---

## File Structure

### New files
- `src/utils/cardStyles.ts` — helper to get card fill/stroke from CARD_COLORS + isDarkMode
- `src/utils/geometry.ts` — `edgePointOnRect` and `getBestHandles` utilities
- `src/components/canvas/card/ConnectionButton.tsx` — the "+" connection dot
- `src/components/canvas/card/CardContent.tsx` — preview HTML vs BlockNote editor
- `src/components/canvas/card/CardHandles.tsx` — the 8 invisible handles
- `src/components/canvas/card/index.ts` — re-exports CardNode
- `src/components/canvas/ConnectionPreview.tsx` — SVG overlay for preview lines

### Modified files
- `src/types/card.ts` — new CardColor union, remove CardVariant, new CARD_COLORS map
- `src/utils/cardStore.ts` — remove variant from GlobalCard
- `src/utils/workspace/types.ts` — make variant optional in CardFile/TrashFile
- `src/utils/workspace/cardConverter.ts` — handle variant migration
- `src/utils/subscribeStores.ts` — remove variant handling, remove debug logs
- `src/utils/connectionMediator.ts` — accept computed source handle
- `src/components/canvas/CardNode.tsx` — use sub-components, new color system, cursor fixes, dark mode fix
- `src/components/canvas/ConnectionEdge.tsx` — solid lines for confirmed, handle-based routing
- `src/components/canvas/ReactFlowCanvas.tsx` — cursor fixes, extract preview, debug log cleanup
- `src/components/ui/LeftPanel.tsx` — cursor pointer on board items, extract sub-components
- `src/components/ui/CardEditDialog.tsx` — add color picker, remove variant references
- `src/components/ui/CardLibraryView.tsx` — remove variant references
- `src/hooks/useWorkspaceLifecycle.ts` — move workspace-changed listener to App level
- `src/App.tsx` — add workspace-changed event listener
- `src/index.css` — canvas cursor styles

### Deleted files
- `src/theme/cardVariantStyles.ts`
- `src/theme/panelSurface.ts`

---

### Task 1: Update card types and color definitions

**Files:**
- Modify: `src/types/card.ts`

- [ ] **Step 1: Replace CardColor, remove CardVariant, update CARD_COLORS**

Replace the entire content of `src/types/card.ts` with:

```ts
export type CardColor = 'white' | 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'purple' | 'pink' | 'gray'

export const CARD_COLORS: Record<CardColor, { stroke: string; fillLight: string; fillDark: string }> = {
  white:  { stroke: '#D4D4D4', fillLight: '#FFFFFF', fillDark: '#1E1E1E' },
  red:    { stroke: '#EF4444', fillLight: '#FDE8E8', fillDark: '#1A0A0A' },
  orange: { stroke: '#F97316', fillLight: '#FEF0E0', fillDark: '#1A0F05' },
  yellow: { stroke: '#EAB308', fillLight: '#FDF8E1', fillDark: '#1A1705' },
  green:  { stroke: '#22C55E', fillLight: '#E4F9EC', fillDark: '#051A0D' },
  cyan:   { stroke: '#06B6D4', fillLight: '#E0F5FA', fillDark: '#051519' },
  blue:   { stroke: '#3B82F6', fillLight: '#E8F0FE', fillDark: '#0A0F1A' },
  purple: { stroke: '#A855F7', fillLight: '#F3E8FE', fillDark: '#10051A' },
  pink:   { stroke: '#EC4899', fillLight: '#FDE8F2', fillDark: '#1A050F' },
  gray:   { stroke: '#9CA3AF', fillLight: '#F3F4F6', fillDark: '#141416' },
}

export const DEFAULT_CARD_WIDTH = 280
export const DEFAULT_CARD_HEIGHT = 200
export const CARD_HEADER_HEIGHT = 36
export const DEFAULT_CARD_CONTENT = '[{"type":"heading","props":{"level":2},"content":[]}]'

export const COLLAPSED_CARD_HEIGHT = 80
export const FIXED_CARD_HEIGHT = 280
export const MIN_AUTO_CARD_HEIGHT = 120
export const MAX_AUTO_CARD_HEIGHT = 1800

export interface CardShapeProps {
  w: number
  h: number
  cardId: string
  content?: string
  title?: string
  color?: CardColor
  createdAt?: number
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/card.ts
git commit -m "refactor(types): replace CardVariant with 10-color CardColor system"
```

---

### Task 2: Create cardStyles utility

**Files:**
- Create: `src/utils/cardStyles.ts`

- [ ] **Step 1: Create the helper**

```ts
import { CARD_COLORS, type CardColor } from '../types/card'

export function getCardFill(color: CardColor | undefined, isDarkMode: boolean): string {
  const c = CARD_COLORS[color ?? 'white'] ?? CARD_COLORS.white
  return isDarkMode ? c.fillDark : c.fillLight
}

export function getCardStroke(color: CardColor | undefined): string {
  const c = CARD_COLORS[color ?? 'white'] ?? CARD_COLORS.white
  return c.stroke
}

export function getCardTextColor(color: CardColor | undefined): string {
  const c = CARD_COLORS[color ?? 'white'] ?? CARD_COLORS.white
  return c.stroke
}

export function getCardMutedTextColor(color: CardColor | undefined): string {
  const c = CARD_COLORS[color ?? 'white'] ?? CARD_COLORS.white
  if (color === 'white' || !color) return '#9CA3AF'
  return c.stroke + '99'
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/cardStyles.ts
git commit -m "feat(utils): add cardStyles helper for color system"
```

---

### Task 3: Create geometry utility

**Files:**
- Create: `src/utils/geometry.ts`

- [ ] **Step 1: Create the helper**

```ts
import { Position } from '@xyflow/react'

export function edgePointOnRect(
  rx: number, ry: number, rw: number, rh: number,
  cx: number, cy: number,
): { x: number; y: number } {
  const centerX = rx + rw / 2
  const centerY = ry + rh / 2
  const dx = cx - centerX
  const dy = cy - centerY
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)
  if (absDx * rh > absDy * rw) {
    return { x: dx > 0 ? rx + rw : rx, y: centerY }
  }
  return { x: centerX, y: dy > 0 ? ry + rh : ry }
}

export function getBestHandles(
  sourcePos: { x: number; y: number },
  sourceSize: { w: number; h: number },
  targetPos: { x: number; y: number },
  targetSize: { w: number; h: number },
): { sourceHandle: string; targetHandle: string } {
  const dx = targetPos.x - sourcePos.x
  const dy = targetPos.y - sourcePos.y
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  let sourceHandle: string
  if (absDx * sourceSize.h > absDy * sourceSize.w) {
    sourceHandle = dx > 0 ? 'right' : 'left'
  } else {
    sourceHandle = dy > 0 ? 'bottom' : 'top'
  }

  let targetHandle: string
  if (absDx * targetSize.h > absDy * targetSize.w) {
    targetHandle = dx > 0 ? 'left-target' : 'right-target'
  } else {
    targetHandle = dy > 0 ? 'top-target' : 'bottom-target'
  }

  return { sourceHandle, targetHandle }
}

export function positionToHandleId(pos: Position): string {
  switch (pos) {
    case Position.Top: return 'top'
    case Position.Bottom: return 'bottom'
    case Position.Left: return 'left'
    case Position.Right: return 'right'
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/geometry.ts
git commit -m "feat(utils): add geometry helpers for edge routing"
```

---

### Task 4: Update cardStore — remove variant

**Files:**
- Modify: `src/utils/cardStore.ts`

- [ ] **Step 1: Remove variant from GlobalCard and imports**

Replace the import line:
```ts
import type { CardColor, CardVariant } from '../types/card'
```
with:
```ts
import type { CardColor } from '../types/card'
```

Remove `variant: CardVariant` from the `GlobalCard` interface (line 9).

- [ ] **Step 2: Commit**

```bash
git add src/utils/cardStore.ts
git commit -m "refactor(cardStore): remove variant from GlobalCard"
```

---

### Task 5: Update workspace types and converter for variant migration

**Files:**
- Modify: `src/utils/workspace/types.ts`
- Modify: `src/utils/workspace/cardConverter.ts`

- [ ] **Step 1: Make variant optional in CardFile and TrashFile**

In `src/utils/workspace/types.ts`, change `variant: string` to `variant?: string` in both `CardFile` (line 61) and `TrashFile` (line 79).

- [ ] **Step 2: Update cardConverter to handle missing variant**

In `src/utils/workspace/cardConverter.ts`, replace the `cardFileToGlobalCard` function:

```ts
export function cardFileToGlobalCard(file: CardFile): GlobalCard {
  return {
    id: file.id,
    content: file.content,
    color: (file.color as GlobalCard['color']) || 'white',
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    title: file.title,
    enforceInitialHeading: file.enforceInitialHeading,
    fixedHeight: file.fixedHeight,
    collapsed: file.collapsed,
    deletedAt: file.deletedAt,
  }
}
```

Replace the `globalCardToCardFile` function:

```ts
export function globalCardToCardFile(card: GlobalCard): CardFile {
  return {
    id: card.id,
    title: card.title || extractTitleFromContent(card.content),
    color: card.color,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    content: card.content,
    enforceInitialHeading: card.enforceInitialHeading,
    fixedHeight: card.fixedHeight,
    collapsed: card.collapsed,
    deletedAt: card.deletedAt,
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/workspace/types.ts src/utils/workspace/cardConverter.ts
git commit -m "refactor(workspace): make variant optional, handle migration in converter"
```

---

### Task 6: Update subscribeStores — remove variant handling and debug logs

**Files:**
- Modify: `src/utils/subscribeStores.ts`

- [ ] **Step 1: Remove all console.log and variant references**

Replace the entire file content with:

```ts
import type { WorkspaceSyncEngine } from './workspace/syncEngine'
import { useCardStore } from './cardStore'
import { useBoardStore } from './boardStore'
import { useTrashStore } from './trashStore'
import { globalCardToCardFile } from './workspace/cardConverter'

export function subscribeCardStore(syncEngine: WorkspaceSyncEngine) {
  let prevCards = useCardStore.getState().cards

  return useCardStore.subscribe((state) => {
    const cards = state.cards

    for (const id in cards) {
      if (cards[id] !== prevCards[id]) {
        const cardFile = globalCardToCardFile(cards[id])
        syncEngine.scheduleWriteCard(cardFile)
      }
    }

    for (const id in prevCards) {
      if (!(id in cards)) {
        syncEngine.scheduleDeleteCard(id)
      }
    }

    prevCards = cards
  })
}

export function subscribeBoardStore(syncEngine: WorkspaceSyncEngine) {
  let prevBoards = useBoardStore.getState().boards
  let prevBoardData = useBoardStore.getState().boardData

  return useBoardStore.subscribe((state) => {
    if (state.boards !== prevBoards) {
      syncEngine.scheduleWriteManifest({ boards: state.boards })
      prevBoards = state.boards
    }

    if (state.boardData !== prevBoardData) {
      for (const boardId in state.boardData) {
        if (state.boardData[boardId] !== prevBoardData[boardId]) {
          const data = state.boardData[boardId]
          syncEngine.scheduleWriteBoard(boardId, {
            version: 2,
            nodes: data.nodes.map(n => ({
              id: n.id,
              type: (n.type === 'card' || n.type === 'section') ? n.type as 'card' | 'section' : 'card',
              position: { x: n.position.x, y: n.position.y },
              data: n.data as { cardId?: string; color?: string; collapsed?: boolean; fixedHeight?: boolean; width?: number; height?: number; name?: string },
              width: n.width,
              height: n.height,
            })),
            edges: data.edges.map(e => ({
              id: e.id,
              source: e.source,
              target: e.target,
              type: 'connection' as const,
            })),
            viewport: { x: 0, y: 0, zoom: 1 },
          })
        }
      }
      prevBoardData = state.boardData
    }
  })
}

export function subscribeTrashStore(syncEngine: WorkspaceSyncEngine) {
  let prevItems = useTrashStore.getState().items

  return useTrashStore.subscribe((state) => {
    for (const item of state.items) {
      const prev = prevItems.find(i => i.cardId === item.cardId)
      if (!prev) {
        syncEngine.scheduleWriteTrash({
          id: item.id,
          cardId: item.cardId,
          title: item.title,
          deletedAt: item.deletedAt,
          expiresAt: item.expiresAt,
          content: item.content,
          color: item.color,
          createdAt: item.createdAt,
        })
      }
    }

    for (const prev of prevItems) {
      if (!state.items.find(i => i.cardId === prev.cardId)) {
        syncEngine.scheduleDeleteTrashFile(prev.cardId)
      }
    }

    prevItems = state.items
  })
}
```

Note: `TrashFile` in types.ts still has `variant` as optional — the `scheduleWriteTrash` call omits it since it's optional. The `TrashStore.addItem` still passes `variant` but it's ignored during write. We'll clean up TrashStore in a later task.

- [ ] **Step 2: Commit**

```bash
git add src/utils/subscribeStores.ts
git commit -m "refactor(subscribeStores): remove debug logs and variant handling"
```

---

### Task 7: Remove debug logs from syncEngine

**Files:**
- Modify: `src/utils/workspace/syncEngine.ts`

- [ ] **Step 1: Remove all console.log/console.warn statements**

Remove every `console.log(...)` and `console.warn(...)` line in the file. The try/catch blocks should remain but with empty catch bodies (or just `/* noop */`).

- [ ] **Step 2: Commit**

```bash
git add src/utils/workspace/syncEngine.ts
git commit -m "chore(syncEngine): remove debug console.log statements"
```

---

### Task 8: Fix workspace switch bug — move event listener to App level

**Files:**
- Modify: `src/hooks/useWorkspaceLifecycle.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Remove the workspace-changed listener from useWorkspaceLifecycle**

In `src/hooks/useWorkspaceLifecycle.ts`, delete the entire `useEffect` block that adds/removes the `hepta-workspace-changed` event listener (lines 136-158). The cleanup logic (stop sync engine, clear stores, set ready=false, bump initKey) will move to App.tsx.

- [ ] **Step 2: Add workspace-changed listener in App.tsx**

In `src/App.tsx`, add a new useEffect after the existing ones:

```tsx
useEffect(() => {
  const handleWorkspaceChanged = () => {
    // Clear all stores — the init effect in useWorkspaceLifecycle
    // will reload data when ReactFlowCanvas remounts
    useCardStore.setState({ cards: {}, isLoaded: false })
    useBoardStore.setState({ boards: [], activeBoardId: null, isLoaded: false, boardData: {} })
    useTrashStore.setState({ items: [] })
  }

  window.addEventListener('hepta-workspace-changed', handleWorkspaceChanged)
  return () => window.removeEventListener('hepta-workspace-changed', handleWorkspaceChanged)
}, [])
```

This listener is always mounted regardless of viewMode, so workspace switches always clear the stores. When the user switches back to board view, `useWorkspaceLifecycle`'s init effect (triggered by mount) reads the new workspace path from localStorage and loads the new data.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useWorkspaceLifecycle.ts src/App.tsx
git commit -m "fix(workspace): move workspace-changed listener to App level for always-on handling"
```

---

### Task 9: Fix numeric board name bug

**Files:**
- Modify: `src/components/ui/LeftPanel.tsx`

- [ ] **Step 1: Ensure board creation always uses UUID and initializes boardData**

In `handleCreateBoard` (LeftPanel.tsx line 129-143), the code already uses `crypto.randomUUID()`. The issue is likely that `onBlur` fires `handleCreateBoard` even when the input is empty (after pressing Escape). Add a guard and ensure boardData is initialized:

Replace the `handleCreateBoard` callback with:

```ts
const handleCreateBoard = useCallback(() => {
  const name = newBoardName.trim()
  if (!name) {
    setNewBoardName('')
    setIsCreatingBoard(false)
    return
  }
  const newBoard = {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  const boardStore = useBoardStore.getState()
  boardStore.addBoard(newBoard)
  boardStore.saveBoardData(newBoard.id, { nodes: [], edges: [] })
  setNewBoardName('')
  setIsCreatingBoard(false)
  if (viewMode !== 'board') setViewMode('board')
  window.dispatchEvent(new CustomEvent('hepta-switch-board', { detail: { boardId: newBoard.id } }))
}, [newBoardName, viewMode, setViewMode])
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/LeftPanel.tsx
git commit -m "fix(boards): ensure board creation initializes boardData and guards empty names"
```

---

### Task 10: Add cursor styles to CSS

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add canvas cursor rules**

Append to `src/index.css`:

```css
.react-flow__pane { cursor: default !important; }
.react-flow__pane.dragging { cursor: grabbing !important; }
```

- [ ] **Step 2: Commit**

```bash
git add src/index.css
git commit -m "style(css): add default cursor for canvas pane"
```

---

### Task 11: Update CardNode — new color system, cursor fixes, dark mode fix

**Files:**
- Modify: `src/components/canvas/CardNode.tsx`

- [ ] **Step 1: Rewrite CardNode with new color system, cursor logic, and dark mode fix**

Replace the entire file with:

```tsx
import { memo, useState, useCallback, useRef, useEffect, useSyncExternalStore } from 'react'
import { Handle, Position, useReactFlow, NodeResizer, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { useCardStore } from '../../utils/cardStore'
import { getCardFill, getCardStroke, getCardTextColor, getCardMutedTextColor } from '../../utils/cardStyles'
import { connectionMediator } from '../../utils/connectionMediator'
import { CardBlockNoteEditor, type BlockNoteEditorHandle } from '../editor/BlockNoteEditor'
import { renderBlocksToHTML } from '../../utils/renderBlocks'
import type { CardColor } from '../../types/card'
import { useLibraryStore } from '../../utils/libraryStore'

export interface CardNodeData extends Record<string, unknown> {
  cardId: string
  color: CardColor
  collapsed?: boolean
  fixedHeight?: boolean
  width?: number
  height?: number
}

type CardNodeType = Node<CardNodeData, 'card'>

const DEFAULT_CARD_WIDTH = 280
const DEFAULT_CARD_HEIGHT = 200

const handleClassName = '!opacity-0 !pointer-events-none !w-3 !h-3 !border-0'

export const CardNode = memo(({ data, selected }: NodeProps<CardNodeType>) => {
  const [isEditing, setIsEditing] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const editorRef = useRef<BlockNoteEditorHandle>(null)
  const clickCoordsRef = useRef<{ x: number; y: number } | null>(null)
  const { setNodes } = useReactFlow()
  const isDarkMode = useLibraryStore(s => s.isDarkMode)

  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === data.cardId
          ? { ...n, dragHandle: isEditing ? '.card-drag-handle' : undefined }
          : n,
      ),
    )
  }, [isEditing, data.cardId, setNodes])

  const card = useCardStore((s) => s.cards[data.cardId])
  const updateCard = useCardStore((s) => s.updateCard)

  const isConnecting = useSyncExternalStore(
    connectionMediator.subscribe.bind(connectionMediator),
    connectionMediator.isConnecting.bind(connectionMediator),
  )
  const isConnectingSource = useSyncExternalStore(
    connectionMediator.subscribe.bind(connectionMediator),
    () => connectionMediator.isConnectingFrom(data.cardId),
  )
  const isConnectionTarget = isConnecting && !isConnectingSource
  const isNearbyTarget = useSyncExternalStore(
    connectionMediator.subscribe.bind(connectionMediator),
    () => connectionMediator.getNearbyTarget() === data.cardId,
  )

  const showConnectionIcon = selected || isHovered || isConnecting

  const handleMouseEnter = useCallback(() => setIsHovered(true), [])
  const handleMouseLeave = useCallback(() => setIsHovered(false), [])

  const handleConnectionIconClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    connectionMediator.start(data.cardId, 'top')
  }, [data.cardId])

  const handleCardClick = useCallback(
    (e: React.MouseEvent) => {
      if (isConnectionTarget || isNearbyTarget) {
        e.stopPropagation()
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const clickX = e.clientX - rect.left
        const clickY = e.clientY - rect.top
        const w = rect.width
        const h = rect.height
        const centerX = w / 2
        const centerY = h / 2
        const dx = clickX - centerX
        const dy = clickY - centerY
        const absDx = Math.abs(dx)
        const absDy = Math.abs(dy)
        let targetHandle = 'top-target'
        if (absDx * h > absDy * w) {
          targetHandle = dx > 0 ? 'right-target' : 'left-target'
        } else {
          targetHandle = dy > 0 ? 'bottom-target' : 'top-target'
        }
        connectionMediator.complete(data.cardId, targetHandle)
        return
      }
      if (!isEditing && selected && card) {
        clickCoordsRef.current = { x: e.clientX, y: e.clientY }
        setIsEditing(true)
      }
    },
    [isConnectionTarget, isNearbyTarget, data.cardId, selected, card, isEditing],
  )

  const handleContentChange = useCallback(
    (content: string) => {
      updateCard(data.cardId, {
        content,
        previewHTML: renderBlocksToHTML(content),
      })
    },
    [data.cardId, updateCard],
  )

  const handleEditorBlur = useCallback(() => {
    setIsEditing(false)
  }, [])

  useEffect(() => {
    if (isEditing && editorRef.current) {
      const coords = clickCoordsRef.current
      clickCoordsRef.current = null
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (coords) {
            editorRef.current!.focusAtCoords(coords)
          } else {
            editorRef.current!.focus()
          }
        })
      })
    }
  }, [isEditing])

  if (!card) {
    return (
      <div
        className="rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center"
        style={{
          width: (data.width ?? DEFAULT_CARD_WIDTH) as number,
          height: (data.height ?? DEFAULT_CARD_HEIGHT) as number,
        }}
      >
        <span className="text-gray-400 text-sm">Card not found</span>
      </div>
    )
  }

  const outlineWidth = selected ? 2 : 1
  const outlineColor = selected
    ? 'var(--border-active)'
    : isHovered
      ? 'var(--border-hover)'
      : getCardStroke(data.color)

  const cardBg = getCardFill(data.color, isDarkMode)
  const textColor = getCardTextColor(data.color)
  const mutedTextColor = getCardMutedTextColor(data.color)

  const cursor = isEditing ? 'text'
    : (isConnectionTarget || isNearbyTarget) ? 'crosshair'
    : isHovered ? 'pointer'
    : 'default'

  const cardClasses = [
    'card-node-default',
    'relative',
    'rounded-2xl',
    isConnectingSource ? 'card-node-connecting-source' : '',
    isNearbyTarget ? 'card-node-nearby-target' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={cardClasses}
      style={{
        width: (data.width ?? DEFAULT_CARD_WIDTH) as number,
        height: (data.height ?? DEFAULT_CARD_HEIGHT) as number,
        backgroundColor: cardBg,
        outline: `${outlineWidth}px solid ${outlineColor}`,
        outlineOffset: 0,
        boxShadow: isConnectingSource
          ? 'var(--shadow-glow-blue)'
          : isNearbyTarget
            ? 'var(--shadow-glow-green)'
          : isConnectionTarget && isHovered
            ? 'var(--shadow-glow-green)'
          : isHovered
            ? 'var(--shadow-lg)'
          : selected
            ? 'var(--shadow-glow-blue)'
            : 'var(--shadow-sm)',
        cursor,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleCardClick}
    >
      {selected && (
        <NodeResizer
          minWidth={200}
          minHeight={120}
          isVisible={selected}
          handleClassName="!w-3 !h-3 !bg-blue-500 !border-2 !border-white !rounded-sm !shadow-sm"
          lineClassName="!bg-transparent"
          onResize={(_, params) => {
            setNodes((nds) =>
              nds.map((n) =>
                n.id === data.cardId
                  ? {
                      ...n,
                      data: { ...n.data, width: params.width, height: params.height },
                      width: params.width,
                      height: params.height,
                    }
                  : n,
              ),
            )
          }}
        />
      )}

      <Handle type="source" position={Position.Top} id="top" className={handleClassName} style={{ top: 0, left: '50%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={handleClassName} style={{ bottom: 0, left: '50%', transform: 'translate(-50%, 50%)' }} />
      <Handle type="source" position={Position.Left} id="left" className={handleClassName} style={{ left: 0, top: '50%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="source" position={Position.Right} id="right" className={handleClassName} style={{ right: 0, top: '50%', transform: 'translate(50%, -50%)' }} />
      <Handle type="target" position={Position.Top} id="top-target" className={handleClassName} style={{ top: 0, left: '50%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className={handleClassName} style={{ bottom: 0, left: '50%', transform: 'translate(-50%, 50%)' }} />
      <Handle type="target" position={Position.Left} id="left-target" className={handleClassName} style={{ left: 0, top: '50%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="target" position={Position.Right} id="right-target" className={handleClassName} style={{ right: 0, top: '50%', transform: 'translate(50%, -50%)' }} />

      <button
        className="absolute flex items-center justify-center rounded-full cursor-crosshair z-10 transition-all duration-150 shadow-md"
        style={{
          top: -14,
          right: -14,
          width: 28,
          height: 28,
          backgroundColor: 'var(--color-blue-500)',
          color: 'var(--text-inverse)',
          fontSize: 18,
          fontWeight: 700,
          lineHeight: 1,
          border: '3px solid var(--surface-app)',
          opacity: showConnectionIcon ? 1 : 0,
          pointerEvents: showConnectionIcon ? 'auto' : 'none',
        }}
        onClick={handleConnectionIconClick}
        onPointerDown={(e) => e.stopPropagation()}
      >
        +
      </button>

      <div
        className="card-drag-handle flex items-center justify-end px-3"
        style={{
          height: 28,
          cursor: 'grab',
          color: mutedTextColor,
          fontSize: 11,
          userSelect: 'none',
        }}
      >
        {isEditing ? '⋮⋮ 拖拽移动' : ''}
      </div>

      <div
        className="pb-3"
        style={{
          height: 'calc(100% - 28px)',
          color: textColor,
          cursor: isEditing ? 'text' : undefined,
        }}
      >
        {isEditing ? (
          <div
            className="h-full px-6"
            style={{ fontSize: '13px', lineHeight: '1.5', wordBreak: 'break-word' }}
          >
            <CardBlockNoteEditor
              ref={editorRef}
              content={card.content}
              onChange={handleContentChange}
              onBlur={handleEditorBlur}
              theme="light"
              editable={true}
              showSideMenu={false}
              enforceInitialHeading={card.enforceInitialHeading}
            />
          </div>
        ) : (
          <div
            className="h-full overflow-y-auto px-6"
            style={{
              fontSize: '13px',
              lineHeight: '1.5',
              wordBreak: 'break-word',
            }}
            dangerouslySetInnerHTML={{
              __html:
                card.previewHTML ||
                renderBlocksToHTML(card.content) ||
                '<span style="opacity:0.5">双击编辑...</span>',
            }}
          />
        )}
      </div>
    </div>
  )
})
```

- [ ] **Step 2: Commit**

```bash
git add src/components/canvas/CardNode.tsx
git commit -m "refactor(CardNode): new color system, cursor fixes, dark mode fix"
```

---

### Task 12: Update ConnectionEdge — solid lines for confirmed, handle-based routing

**Files:**
- Modify: `src/components/canvas/ConnectionEdge.tsx`

- [ ] **Step 1: Rewrite ConnectionEdge with solid lines and handle-based routing**

Replace the entire file with:

```tsx
import {
  BaseEdge,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react'

export function ConnectionEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  style = {},
  markerEnd,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
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
        className="edge-default"
        style={{
          ...style,
          stroke: selected ? 'var(--border-active)' : 'var(--text-tertiary)',
          strokeWidth: selected ? 3 : 2,
          cursor: 'pointer',
        }}
      />
      <BaseEdge
        path={edgePath}
        style={{
          stroke: selected ? 'var(--border-focus)' : 'transparent',
          strokeWidth: selected ? 10 : 28,
          fill: 'none',
          pointerEvents: 'stroke',
          cursor: 'pointer',
        }}
      />
    </>
  )
}
```

Key changes: removed `strokeDasharray` (solid lines by default), removed `getNearestEdgeHandle` (React Flow now routes based on handle positions from `sourceHandle`/`targetHandle`).

- [ ] **Step 2: Commit**

```bash
git add src/components/canvas/ConnectionEdge.tsx
git commit -m "refactor(ConnectionEdge): solid lines for confirmed connections, handle-based routing"
```

---

### Task 13: Update connectionMediator — compute source handle at completion

**Files:**
- Modify: `src/utils/connectionMediator.ts`

- [ ] **Step 1: Add getBestHandles integration to the complete flow**

Replace the entire file with:

```ts
import { getBestHandles } from './geometry'

export interface PendingConnection {
  sourceNodeId: string
  sourceHandleId: string
}

export interface ConnectionRequest {
  sourceNodeId: string
  sourceHandleId: string
  targetNodeId: string
  targetHandleId: string
}

type Listener = () => void
type CompleteHandler = (request: ConnectionRequest) => void

let pending: PendingConnection | null = null
let listeners = new Set<Listener>()
let completeHandler: CompleteHandler | null = null
let _nearbyTargetId: string | null = null

export const connectionMediator = {
  start(sourceNodeId: string, sourceHandleId: string) {
    pending = { sourceNodeId, sourceHandleId }
    _nearbyTargetId = null
    listeners.forEach((fn) => fn())
  },

  getPending(): PendingConnection | null {
    return pending
  },

  clear() {
    pending = null
    _nearbyTargetId = null
    listeners.forEach((fn) => fn())
  },

  isConnecting(): boolean {
    return pending !== null
  },

  isConnectingFrom(nodeId: string): boolean {
    return pending?.sourceNodeId === nodeId
  },

  complete(
    targetNodeId: string,
    targetHandleId: string,
    sourcePos?: { x: number; y: number },
    sourceSize?: { w: number; h: number },
    targetPos?: { x: number; y: number },
    targetSize?: { w: number; h: number },
  ) {
    if (!pending || !completeHandler) return false

    let sourceHandleId = pending.sourceHandleId
    let finalTargetHandleId = targetHandleId

    if (sourcePos && sourceSize && targetPos && targetSize) {
      const handles = getBestHandles(sourcePos, sourceSize, targetPos, targetSize)
      sourceHandleId = handles.sourceHandle
      finalTargetHandleId = handles.targetHandle
    }

    completeHandler({
      sourceNodeId: pending.sourceNodeId,
      sourceHandleId,
      targetNodeId,
      targetHandleId: finalTargetHandleId,
    })
    pending = null
    _nearbyTargetId = null
    listeners.forEach((fn) => fn())
    return true
  },

  onComplete(handler: CompleteHandler) {
    completeHandler = handler
  },

  subscribe(fn: Listener): () => void {
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  },

  setNearbyTarget(nodeId: string | null) {
    if (_nearbyTargetId !== nodeId) {
      _nearbyTargetId = nodeId
      listeners.forEach((fn) => fn())
    }
  },

  getNearbyTarget(): string | null {
    return _nearbyTargetId
  },
}
```

- [ ] **Step 2: Update ReactFlowCanvas to pass positions when completing**

In `src/components/canvas/ReactFlowCanvas.tsx`, update the `connectionMediator.onComplete` handler (around line 210-223) to compute handles:

```tsx
useEffect(() => {
  connectionMediator.onComplete((request) => {
    setEdges((eds) => {
      const edge: Edge = {
        id: `edge-${request.sourceNodeId}-${request.targetNodeId}-${Date.now()}`,
        source: request.sourceNodeId,
        target: request.targetNodeId,
        sourceHandle: request.sourceHandleId || undefined,
        targetHandle: request.targetHandleId || undefined,
        type: 'connection',
      }
      return addEdge(edge, eds)
    })
  })
}, [setEdges])
```

And update the `handleCardClick` in CardNode to pass positions when calling `connectionMediator.complete`. In CardNode's `handleCardClick`, after computing `targetHandle`, call:

```ts
connectionMediator.complete(data.cardId, targetHandle)
```

Since the mediator now computes best handles internally when positions are provided, we need to pass the node positions. Update CardNode's `handleCardClick`:

```ts
const handleCardClick = useCallback(
  (e: React.MouseEvent) => {
    if (isConnectionTarget || isNearbyTarget) {
      e.stopPropagation()
      const { getNode } = useReactFlow()
      const sourceNode = getNode(pending?.sourceNodeId || '')
      const targetNode = getNode(data.cardId)
      if (sourceNode && targetNode) {
        const sw = ((sourceNode.data as Record<string, unknown>).width as number) ?? 280
        const sh = ((sourceNode.data as Record<string, unknown>).height as number) ?? 200
        const tw = ((targetNode.data as Record<string, unknown>).width as number) ?? 280
        const th = ((targetNode.data as Record<string, unknown>).height as number) ?? 200
        connectionMediator.complete(
          data.cardId,
          '',
          sourceNode.position,
          { w: sw, h: sh },
          targetNode.position,
          { w: tw, h: th },
        )
      } else {
        connectionMediator.complete(data.cardId, '')
      }
      return
    }
    // ... rest unchanged
  },
  [isConnectionTarget, isNearbyTarget, data.cardId, selected, card, isEditing],
)
```

Wait — `useReactFlow` can't be called inside a callback. It's already available at the component level. Let me fix: `useReactFlow` is already destructured as `{ setNodes }` at the top of CardNode. We need to also destructure `getNode`:

```ts
const { setNodes, getNode } = useReactFlow()
```

And in the complete call, pass the positions.

- [ ] **Step 3: Commit**

```bash
git add src/utils/connectionMediator.ts src/components/canvas/CardNode.tsx src/components/canvas/ReactFlowCanvas.tsx
git commit -m "feat(connections): compute best source/target handles based on card positions"
```

---

### Task 14: Update ReactFlowCanvas — extract preview, cleanup, cursor

**Files:**
- Modify: `src/components/canvas/ReactFlowCanvas.tsx`
- Create: `src/components/canvas/ConnectionPreview.tsx`

- [ ] **Step 1: Create ConnectionPreview component**

```tsx
import { useSyncExternalStore } from 'react'
import { connectionMediator } from '../../utils/connectionMediator'
import { edgePointOnRect } from '../../utils/geometry'
import type { Node } from '@xyflow/react'
import { type ReactFlowInstance } from '@xyflow/react'
import { useRef, useState, useEffect } from 'react'

interface ConnectionPreviewProps {
  nodesRef: React.RefObject<Node[]>
  reactFlowInstance: React.RefObject<ReactFlowInstance | null>
  lastMousePosRef: React.RefObject<{ x: number; y: number } | null>
}

export function ConnectionPreview({ nodesRef, reactFlowInstance, lastMousePosRef }: ConnectionPreviewProps) {
  const isConnecting = useSyncExternalStore(
    connectionMediator.subscribe.bind(connectionMediator),
    connectionMediator.isConnecting.bind(connectionMediator),
  )
  const [previewLine, setPreviewLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

  useEffect(() => {
    if (!isConnecting) {
      setPreviewLine(null)
      return
    }
    let raf = 0
    const tick = () => {
      const pending = connectionMediator.getPending()
      const rf = reactFlowInstance.current
      const mouse = lastMousePosRef.current
      if (pending && rf && mouse) {
        const srcNode = nodesRef.current?.find((n) => n.id === pending.sourceNodeId)
        if (srcNode) {
          const w = ((srcNode.data as Record<string, unknown>).width as number) ?? 280
          const h = ((srcNode.data as Record<string, unknown>).height as number) ?? 200
          const zoom = rf.getViewport().zoom
          const srcScreen = rf.flowToScreenPosition(srcNode.position)
          const scaledW = w * zoom
          const scaledH = h * zoom
          const srcEdge = edgePointOnRect(srcScreen.x, srcScreen.y, scaledW, scaledH, mouse.x, mouse.y)
          setPreviewLine({ x1: srcEdge.x, y1: srcEdge.y, x2: mouse.x, y2: mouse.y })
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isConnecting, nodesRef, reactFlowInstance, lastMousePosRef])

  if (!previewLine) return null

  return (
    <svg
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    >
      <defs>
        <marker
          id="preview-arrow"
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
      <line
        x1={previewLine.x1}
        y1={previewLine.y1}
        x2={previewLine.x2}
        y2={previewLine.y2}
        stroke="#3b82f6"
        strokeWidth={2}
        strokeDasharray="6,4"
        markerEnd="url(#preview-arrow)"
      />
    </svg>
  )
}
```

- [ ] **Step 2: Update ReactFlowCanvas to use ConnectionPreview**

In `ReactFlowCanvas.tsx`:
- Remove the `previewLine` state and the `useEffect` that manages the rAF loop (lines 92-127)
- Remove the inline SVG at the bottom (lines 408-444)
- Remove the `edgePointOnRect` function (lines 37-51)
- Import `ConnectionPreview` and `edgePointOnRect` from the new modules
- Add `<ConnectionPreview nodesRef={nodesRef} reactFlowInstance={reactFlowInstance} lastMousePosRef={lastMousePosRef} />` inside the return, after the `<ReactFlow>` component
- Remove all remaining `console.log` statements

- [ ] **Step 3: Commit**

```bash
git add src/components/canvas/ConnectionPreview.tsx src/components/canvas/ReactFlowCanvas.tsx
git commit -m "refactor(ReactFlowCanvas): extract ConnectionPreview, remove debug logs"
```

---

### Task 15: Update CardEditDialog — add color picker, remove variant

**Files:**
- Modify: `src/components/ui/CardEditDialog.tsx`

- [ ] **Step 1: Add color picker and remove variant references**

Replace the entire file with:

```tsx
import { useCallback } from 'react'
import { useLibraryStore } from '../../utils/libraryStore'
import { useCardStore } from '../../utils/cardStore'
import { useTrashStore } from '../../utils/trashStore'
import { getPanelSurface } from '../../theme'
import { CardBlockNoteEditor } from '../editor/BlockNoteEditor'
import { X, Trash2 } from 'lucide-react'
import { CARD_COLORS, type CardColor } from '../../types/card'

interface CardEditDialogProps {
  cardId: string
  onClose: () => void
}

export function CardEditDialog({ cardId, onClose }: CardEditDialogProps) {
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const surface = getPanelSurface(isDarkMode)
  const card = useCardStore(s => s.cards[cardId])
  const updateCard = useCardStore(s => s.updateCard)
  const softDeleteCard = useCardStore(s => s.softDeleteCard)
  const addItem = useTrashStore(s => s.addItem)

  const handleChange = useCallback((content: string) => {
    updateCard(cardId, { content })
  }, [cardId, updateCard])

  const handleColorChange = useCallback((color: CardColor) => {
    updateCard(cardId, { color })
  }, [cardId, updateCard])

  if (!card) return null

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center animate-fadeIn"
      style={{ backgroundColor: 'var(--surface-overlay)' }}
      onClick={onClose}
    >
      <div
        className="modal-content w-[700px] h-[600px] max-h-[85vh] rounded-xl flex flex-col animate-scaleIn"
        style={{
          backgroundColor: surface.panelBg,
          boxShadow: 'var(--shadow-xl)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-3 border-b shrink-0 transition-theme"
          style={{ borderColor: surface.divider }}
        >
          <span className="text-sm font-medium truncate" style={{ color: surface.text }}>
            {card.title || '无标题'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (window.confirm(`确定删除卡片「${card.title || '无标题'}」？`)) {
                  softDeleteCard(cardId)
                  addItem({
                    id: `trash-${cardId}`,
                    cardId,
                    title: card.title || '无标题',
                    content: card.content,
                    color: card.color,
                    createdAt: card.createdAt,
                    enforceInitialHeading: card.enforceInitialHeading,
                    fixedHeight: card.fixedHeight,
                    collapsed: card.collapsed,
                  })
                  onClose()
                }
              }}
              className="btn-base btn-danger flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
            >
              <Trash2 size={14} />
              删除
            </button>
            <button
              onClick={onClose}
              className="btn-base p-2 rounded-lg"
              style={{ color: surface.muted }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-5 py-2 border-b" style={{ borderColor: surface.divider }}>
          {(Object.keys(CARD_COLORS) as CardColor[]).map((color) => (
            <button
              key={color}
              onClick={() => handleColorChange(color)}
              className="w-6 h-6 rounded-full border-2 transition-all cursor-pointer"
              style={{
                backgroundColor: isDarkMode ? CARD_COLORS[color].fillDark : CARD_COLORS[color].fillLight,
                borderColor: card.color === color ? CARD_COLORS[color].stroke : 'transparent',
                boxShadow: card.color === color ? `0 0 0 2px ${CARD_COLORS[color].stroke}` : 'none',
              }}
            />
          ))}
        </div>

        <div className="flex-1 overflow-auto p-4">
          <CardBlockNoteEditor
            content={card.content}
            onChange={handleChange}
            editable={true}
            theme={isDarkMode ? 'dark' : 'light'}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/CardEditDialog.tsx
git commit -m "feat(CardEditDialog): add color picker, remove variant"
```

---

### Task 16: Update CardLibraryView — remove variant references

**Files:**
- Modify: `src/components/ui/CardLibraryView.tsx`

- [ ] **Step 1: Remove variant from drag data and any variant display**

In `handleDragStart`, remove `variant` from the drag data. Search for any `variant` references and remove them. The card items should show the card color as a small indicator dot.

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/CardLibraryView.tsx
git commit -m "refactor(CardLibraryView): remove variant references"
```

---

### Task 17: Update LeftPanel — cursor pointer on items, extract sub-components

**Files:**
- Modify: `src/components/ui/LeftPanel.tsx`

- [ ] **Step 1: Add cursor-pointer to ViewModeButton**

Add `cursor-pointer` class to the ViewModeButton component (line 386).

- [ ] **Step 2: Verify board list items already have cursor-pointer**

The board list items at line 243 already have `cursor-pointer` class. No change needed.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/LeftPanel.tsx
git commit -m "style(LeftPanel): add cursor-pointer to view mode tabs"
```

---

### Task 18: Update App.tsx — remove variant from handleAddCard

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Remove variant from handleAddCard**

In `handleAddCard` (line 114-129), remove `variant: 'solid'` from `addCard` and from the `hepta-add-card-node` event detail.

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "refactor(App): remove variant from addCard flow"
```

---

### Task 19: Update trashStore — remove variant from addItem

**Files:**
- Modify: `src/utils/trashStore.ts`

- [ ] **Step 1: Remove variant from TrashItem interface and addItem**

Remove `variant` from the `TrashItem` interface and from the `addItem` method parameters.

- [ ] **Step 2: Commit**

```bash
git add src/utils/trashStore.ts
git commit -m "refactor(trashStore): remove variant from TrashItem"
```

---

### Task 20: Delete old theme files

**Files:**
- Delete: `src/theme/cardVariantStyles.ts`
- Delete: `src/theme/panelSurface.ts`

- [ ] **Step 1: Delete the files**

```bash
git rm src/theme/cardVariantStyles.ts src/theme/panelSurface.ts
```

- [ ] **Step 2: Search for and fix any remaining imports**

Search the codebase for `cardVariantStyles` and `panelSurface` imports. Remove or replace them.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: delete old cardVariantStyles and panelSurface theme files"
```

---

### Task 21: Update theme/index.ts — remove getCardVariantStyles export

**Files:**
- Modify: `src/theme/index.ts`

- [ ] **Step 1: Remove the getCardVariantStyles export**

Remove the `export { getCardVariantStyles } from './cardVariantStyles'` line (or similar). Keep other exports.

- [ ] **Step 2: Commit**

```bash
git add src/theme/index.ts
git commit -m "refactor(theme): remove getCardVariantStyles export"
```

---

### Task 22: Split CardNode into sub-components

**Files:**
- Create: `src/components/canvas/card/ConnectionButton.tsx`
- Create: `src/components/canvas/card/CardContent.tsx`
- Create: `src/components/canvas/card/CardHandles.tsx`
- Create: `src/components/canvas/card/index.ts`
- Modify: `src/components/canvas/CardNode.tsx`

- [ ] **Step 1: Create ConnectionButton**

```tsx
interface ConnectionButtonProps {
  visible: boolean
  onClick: (e: React.MouseEvent) => void
}

export function ConnectionButton({ visible, onClick }: ConnectionButtonProps) {
  return (
    <button
      className="absolute flex items-center justify-center rounded-full cursor-crosshair z-10 transition-all duration-150 shadow-md"
      style={{
        top: -14,
        right: -14,
        width: 28,
        height: 28,
        backgroundColor: 'var(--color-blue-500)',
        color: 'var(--text-inverse)',
        fontSize: 18,
        fontWeight: 700,
        lineHeight: 1,
        border: '3px solid var(--surface-app)',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
      }}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
    >
      +
    </button>
  )
}
```

- [ ] **Step 2: Create CardHandles**

```tsx
import { Handle, Position } from '@xyflow/react'

const handleClassName = '!opacity-0 !pointer-events-none !w-3 !h-3 !border-0'

export function CardHandles() {
  return (
    <>
      <Handle type="source" position={Position.Top} id="top" className={handleClassName} style={{ top: 0, left: '50%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={handleClassName} style={{ bottom: 0, left: '50%', transform: 'translate(-50%, 50%)' }} />
      <Handle type="source" position={Position.Left} id="left" className={handleClassName} style={{ left: 0, top: '50%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="source" position={Position.Right} id="right" className={handleClassName} style={{ right: 0, top: '50%', transform: 'translate(50%, -50%)' }} />
      <Handle type="target" position={Position.Top} id="top-target" className={handleClassName} style={{ top: 0, left: '50%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className={handleClassName} style={{ bottom: 0, left: '50%', transform: 'translate(-50%, 50%)' }} />
      <Handle type="target" position={Position.Left} id="left-target" className={handleClassName} style={{ left: 0, top: '50%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="target" position={Position.Right} id="right-target" className={handleClassName} style={{ right: 0, top: '50%', transform: 'translate(50%, -50%)' }} />
    </>
  )
}
```

- [ ] **Step 3: Create CardContent**

```tsx
import { CardBlockNoteEditor, type BlockNoteEditorHandle } from '../../editor/BlockNoteEditor'
import { renderBlocksToHTML } from '../../../utils/renderBlocks'

interface CardContentProps {
  isEditing: boolean
  content: string
  previewHTML?: string
  enforceInitialHeading?: boolean
  onChange: (content: string) => void
  onBlur: () => void
  editorRef: React.Ref<BlockNoteEditorHandle>
  textColor: string
}

export function CardContent({
  isEditing,
  content,
  previewHTML,
  enforceInitialHeading,
  onChange,
  onBlur,
  editorRef,
  textColor,
}: CardContentProps) {
  return (
    <div
      className="pb-3"
      style={{
        height: 'calc(100% - 28px)',
        color: textColor,
        cursor: isEditing ? 'text' : undefined,
      }}
    >
      {isEditing ? (
        <div
          className="h-full px-6"
          style={{ fontSize: '13px', lineHeight: '1.5', wordBreak: 'break-word' }}
        >
          <CardBlockNoteEditor
            ref={editorRef}
            content={content}
            onChange={onChange}
            onBlur={onBlur}
            theme="light"
            editable={true}
            showSideMenu={false}
            enforceInitialHeading={enforceInitialHeading}
          />
        </div>
      ) : (
        <div
          className="h-full overflow-y-auto px-6"
          style={{
            fontSize: '13px',
            lineHeight: '1.5',
            wordBreak: 'break-word',
          }}
          dangerouslySetInnerHTML={{
            __html:
              previewHTML ||
              renderBlocksToHTML(content) ||
              '<span style="opacity:0.5">双击编辑...</span>',
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create index.ts**

```ts
export { CardNode } from '../CardNode'
```

- [ ] **Step 5: Update CardNode to use sub-components**

Update CardNode imports and replace inline JSX with the sub-components. The CardNode file should now import and use `ConnectionButton`, `CardHandles`, `CardContent`.

- [ ] **Step 6: Commit**

```bash
git add src/components/canvas/card/ src/components/canvas/CardNode.tsx
git commit -m "refactor(CardNode): extract ConnectionButton, CardHandles, CardContent"
```

---

### Task 23: Verify build and fix any remaining type errors

**Files:**
- Various (fix any remaining compile errors)

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -50
```

- [ ] **Step 2: Fix any type errors related to removed `variant` field**

Common issues:
- `card.variant` references in components not yet updated
- `data.variant` in CardNodeData
- `variant` in drag-and-drop data

- [ ] **Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix: resolve remaining variant type errors"
```

---

### Task 24: Run dev server and verify visually

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Verify all success criteria**

1. Switch workspaces in board library view — board list updates
2. Create board named "123" — works and enters canvas
3. Canvas shows arrow cursor; cards show pointer on hover
4. Left panel items show pointer cursor
5. Cards default to white; color picker has 10 options
6. Confirmed connections are solid lines; preview is dashed
7. Connection endpoints align with card edges
8. No `CardVariant` or `getCardVariantStyles` references
9. Sub-components extracted
10. No debug logs in console

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: UI polish, card color system, connection improvements, code cleanup"
```