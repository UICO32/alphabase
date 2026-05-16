# UI Polish & Card Color System Design

Date: 2026-05-16

## Overview

Batch fix of bugs, cursor styles, card color system overhaul, connection line logic improvement, and code maintainability cleanup — all in one pass.

---

## 1. Bug Fixes

### 1.1 Board library view: workspace switch fails to update board list

**Root cause:** `useWorkspaceLifecycle` is called inside `ReactFlowCanvas`, which is only rendered when `viewMode === 'board'` (see App.tsx lines 131-146). When the user is in `boardLibrary` or `cards` view, `ReactFlowCanvas` is unmounted, so `useWorkspaceLifecycle`'s effect cleanup removes the `hepta-workspace-changed` event listener. When workspace changes, no handler picks up the event — stores never clear/reload, and the board list stays stale.

**Fix:** Move the `hepta-workspace-changed` event listener out of `useWorkspaceLifecycle` and into `App.tsx` (or a dedicated always-mounted hook). The listener should:
1. Stop the sync engine if running
2. Clear all stores (cards, boards, trash)
3. Set `ready = false` and bump `initKey`
4. The init effect in `useWorkspaceLifecycle` (which runs when `ReactFlowCanvas` remounts on viewMode change back to 'board') will pick up the new workspace path from localStorage and initialize

Alternatively, always render `ReactFlowCanvas` but hide it with CSS when not in board view. This is simpler but wastes DOM. The event listener approach is cleaner.

### 1.2 Creating board with numeric name fails but enters canvas

**Root cause:** `handleCreateBoard` in LeftPanel.tsx (line 129-143) already uses `crypto.randomUUID()` for the ID. The issue is likely that `handleCreateBoard` calls `setViewMode('board')` and dispatches `hepta-switch-board` even if the board creation silently fails. Need to verify whether `addBoard` can fail silently.

Looking more carefully: the `onBlur` handler on the new board input calls `handleCreateBoard` which checks `if (newBoardName.trim())`. If the name is "123", `newBoardName.trim()` is truthy, so it proceeds. The `addBoard` call should succeed. The real issue may be that the board is created but the `hepta-switch-board` event fires before the store updates, causing the canvas to show an empty board. Or the board gets created with an empty `boardData` entry, and `switchToBoard` creates default empty nodes, making it look like nothing happened.

**Fix:** Ensure `handleCreateBoard` creates the board with proper initial data, and that `switchToBoard` is called after the store has the new board. Add `saveBoardData(newBoard.id, { nodes: [], edges: [] })` right after `addBoard` to ensure the board has valid data.

---

## 2. Cursor Styles

### 2.1 Canvas (ReactFlow pane)
- Default: `cursor: default` (arrow pointer) — set via CSS on `.react-flow__pane`
- Panning: browser default grab behavior (ReactFlow handles this)
- Connecting: `cursor: crosshair` (handled by CardNode)

### 2.2 Card nodes
- Not editing, not connecting, not hovering: `cursor: default`
- Hovering (not selected): `cursor: pointer`
- Selected (not editing): `cursor: default` — indicates selected state
- Editing: `cursor: text` in content area, `cursor: default` on drag handle
- Connecting source: `cursor: crosshair`
- Connecting target nearby: `cursor: crosshair`

### 2.3 Left panel items
- Board list items: `cursor: pointer` (already has `cursor-pointer` class)
- Card library items: `cursor: pointer` (already has this)
- View mode tabs: `cursor: pointer`
- Workspace picker items: `cursor: pointer`

### 2.4 Implementation
Add to `src/index.css`:
```css
.react-flow__pane { cursor: default !important; }
.react-flow__pane.dragging { cursor: grabbing !important; }
```

CardNode cursor logic update:
```ts
const cursor = isEditing ? 'text'
  : (isConnectionTarget || isNearbyTarget) ? 'crosshair'
  : isHovered ? 'pointer'
  : 'default'
```

---

## 3. Card Color System

### 3.1 Color palette (9 colors + white default)

Colors are computed by overlaying a percentage of the pure stroke color onto white (light mode) or black (dark mode).

**Light mode formula:** `fillLight = white + X% stroke` (blended)
**Dark mode formula:** `fillDark = black + Y% stroke` (blended)

| Key     | Stroke (pure) | Overlay% (light) | Fill Light   | Overlay% (dark) | Fill Dark    |
|---------|---------------|-------------------|--------------|------------------|--------------|
| white   | #D4D4D4       | 0%                | #FFFFFF      | 0%               | #1E1E1E      |
| red     | #EF4444       | 8%                | #FDE8E8      | 10%              | #1A0A0A      |
| orange  | #F97316       | 8%                | #FEF0E0      | 10%              | #1A0F05      |
| yellow  | #EAB308       | 12%               | #FDF8E1      | 12%              | #1A1705      |
| green   | #22C55E       | 8%                | #E4F9EC      | 10%              | #051A0D      |
| cyan    | #06B6D4       | 8%                | #E0F5FA      | 10%              | #051519      |
| blue    | #3B82F6       | 8%                | #E8F0FE      | 10%              | #0A0F1A      |
| purple  | #A855F7       | 8%                | #F3E8FE      | 10%              | #10051A      |
| pink    | #EC4899       | 8%                | #FDE8F2      | 10%              | #1A050F      |
| gray    | #9CA3AF       | 6%                | #F3F4F6      | 8%               | #141416      |

Yellow uses 12% because its high lightness makes low overlays nearly invisible. Gray uses less to stay neutral.

### 3.2 New `CardColor` type

```ts
export type CardColor = 'white' | 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'purple' | 'pink' | 'gray'
```

### 3.3 Remove `CardVariant`

The old `solid | glass | outline` variant system is replaced by the new color system. Every card has a `color` field only. The visual rendering is determined by `stroke` + `fill` from the color definition.

**Migration strategy for existing data:**
- `CardFile.variant` field is kept as optional `string` in the file type for backward compatibility
- `cardFileToGlobalCard` ignores the `variant` field, uses `color` only
- `globalCardToCardFile` does not write `variant`
- Old files with `variant` but no meaningful `color` default to `'white'`

### 3.4 Single source of truth: `CARD_COLORS` map

One object in `src/types/card.ts` holds all color definitions for both light and dark mode:

```ts
export const CARD_COLORS: Record<CardColor, {
  stroke: string
  fillLight: string
  fillDark: string
}> = { ... }
```

Delete `src/theme/cardVariantStyles.ts` and `src/theme/panelSurface.ts`. All rendering logic reads from `CARD_COLORS`.

### 3.5 CardNode rendering

- Background: `fillLight` or `fillDark` based on `isDarkMode`
- Border: 1px solid `stroke`, with opacity adjustments for hover/select states
- Text: `stroke` color for headings, muted variant for body text
- Remove `getCardVariantStyles` function entirely
- Fix dark mode bug: pass actual `isDarkMode` instead of hardcoded `false`

### 3.6 Color picker UI

Add a color picker row to `CardEditDialog`. A horizontal row of 10 small circles (white + 9 colors), current color highlighted with a ring. Clicking changes `card.color` in the store.

---

## 4. Connection Line Logic

### 4.1 Preview line: center-to-cursor

Current behavior is correct — preview line goes from the source card's nearest edge point to the mouse cursor. Keep this.

### 4.2 Confirmed edge: edge-to-edge with proper handle assignment

**Problem:** When a connection is completed, `connectionMediator.complete()` is called with a target handle determined by click position. But the source handle is always `'top'` (hardcoded in `connectionMediator.start()`). This means edges always originate from the top of the source card regardless of relative position.

**Fix:** When completing a connection, compute both source and target handle sides based on the center-to-center vector between the two cards:

```ts
function getBestHandles(
  sourcePos: { x: number; y: number },
  sourceSize: { w: number; h: number },
  targetPos: { x: number; y: number },
  targetSize: { w: number; h: number }
): { sourceHandle: string; targetHandle: string } {
  const dx = targetPos.x - sourcePos.x
  const dy = targetPos.y - sourcePos.y
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  // Source handle
  let sourceHandle: string
  if (absDx * sourceSize.h > absDy * sourceSize.w) {
    sourceHandle = dx > 0 ? 'right' : 'left'
  } else {
    sourceHandle = dy > 0 ? 'bottom' : 'top'
  }

  // Target handle (reversed direction)
  let targetHandle: string
  if (absDx * targetSize.h > absDy * targetSize.w) {
    targetHandle = dx > 0 ? 'left-target' : 'right-target'
  } else {
    targetHandle = dy > 0 ? 'top-target' : 'bottom-target'
  }

  return { sourceHandle, targetHandle }
}
```

Update `connectionMediator.start()` to accept a computed source handle, or compute it at completion time.

### 4.3 Edge style

- Confirmed connections: solid line, `strokeWidth: 2`, color `var(--text-tertiary)`, selected: `var(--border-active)`
- Preview/draft connections: dashed line (current style)

In `ConnectionEdge.tsx`, remove `strokeDasharray` for confirmed edges. Keep it only for the preview SVG overlay.

---

## 5. Code Maintainability

### 5.1 Unify color/style definitions

- Delete `src/theme/cardVariantStyles.ts` (old variant system)
- Delete `src/theme/panelSurface.ts` (unused after token migration)
- Consolidate all card color logic into `src/types/card.ts` + a new `src/utils/cardStyles.ts` helper
- Remove `CardVariant` type from all files
- Update `cardConverter.ts` to handle migration from old `variant` field

### 5.2 Clean up dead code

- Remove unused imports across all modified files
- Remove `CARD_HEADER_HEIGHT` if not used
- Remove any unused CSS classes from `theme/animations.css`
- Remove all `console.log` from `subscribeStores.ts` and `syncEngine.ts`

### 5.3 Split large components

- `CardNode.tsx`: Extract into `src/components/canvas/card/` directory:
  - `ConnectionButton.tsx` — the "+" connection dot
  - `CardContent.tsx` — preview HTML vs BlockNote editor
  - `CardHandles.tsx` — the 8 invisible handles
  - `index.ts` — re-exports
- `ReactFlowCanvas.tsx`: Extract:
  - `ConnectionPreview.tsx` — the SVG overlay for preview lines
  - Move `edgePointOnRect` utility to `src/utils/geometry.ts`
- `LeftPanel.tsx`: Extract:
  - `BoardList.tsx` — the board list section
  - `BoardContextMenu.tsx` — the context menu

---

## 6. File Change Summary

### New files
- `src/components/canvas/card/ConnectionButton.tsx`
- `src/components/canvas/card/CardContent.tsx`
- `src/components/canvas/card/CardHandles.tsx`
- `src/components/canvas/card/index.ts`
- `src/components/canvas/ConnectionPreview.tsx`
- `src/utils/cardStyles.ts`
- `src/utils/geometry.ts`

### Modified files
- `src/types/card.ts` — new CardColor values, remove CardVariant, new CARD_COLORS map
- `src/utils/cardStore.ts` — remove variant field, update addCard/updateCard
- `src/components/canvas/CardNode.tsx` — use sub-components, new color system, cursor fixes, dark mode fix
- `src/components/canvas/ConnectionEdge.tsx` — solid lines for confirmed, handle-based routing
- `src/components/canvas/ReactFlowCanvas.tsx` — cursor fixes, extract preview, debug log cleanup
- `src/components/ui/BoardLibraryView.tsx` — no changes needed (already reactive via Zustand)
- `src/components/ui/LeftPanel.tsx` — cursor pointer on board items, extract sub-components
- `src/components/ui/CardEditDialog.tsx` — add color picker, remove variant references
- `src/components/ui/CardLibraryView.tsx` — remove variant references
- `src/utils/workspace/cardConverter.ts` — handle variant migration
- `src/utils/workspace/types.ts` — make variant optional in CardFile
- `src/utils/subscribeStores.ts` — remove debug logs, remove variant handling
- `src/utils/connectionMediator.ts` — compute source handle at completion time
- `src/hooks/useWorkspaceLifecycle.ts` — move workspace-changed listener to App level
- `src/App.tsx` — add workspace-changed event listener (always mounted)
- `src/index.css` — canvas cursor styles

### Deleted files
- `src/theme/cardVariantStyles.ts`
- `src/theme/panelSurface.ts`

---

## 7. Success Criteria

1. Switching workspaces in board library view immediately updates the board list
2. Creating a board named "123" works correctly and enters the canvas with the new board
3. Canvas shows arrow cursor by default; cards show pointer on hover
4. Left panel board/card library items show pointer cursor
5. Cards default to white; 10 color options available in picker
6. Confirmed connections render as solid lines; preview connections are dashed
7. Connection endpoints align with card edges based on relative card positions
8. No `CardVariant` type or `getCardVariantStyles` references remain
9. CardNode, ReactFlowCanvas, LeftPanel split into focused sub-components
10. All debug console.log removed from subscribeStores and syncEngine
11. Dark mode renders card colors correctly (fix hardcoded `false` bug)