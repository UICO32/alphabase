# Maintainability Refactor v3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure directories, split large files, clean root artifacts — no behavior changes.

**Architecture:** Move stores to `src/stores/`, converters to `src/converters/`; extract sub-components from large files; delete debug screenshots.

**Tech Stack:** React 18 + TypeScript 5.6 + Vite 5

---

## Phase 1: Directory Restructuring

### Task 1.1: Create `src/stores/` and move store files

**Files:**
- Create: `src/stores/`
- Move: `src/utils/cardStore.ts` → `src/stores/cardStore.ts`
- Move: `src/utils/boardStore.ts` → `src/stores/boardStore.ts`
- Move: `src/utils/libraryStore.ts` → `src/stores/libraryStore.ts`
- Move: `src/utils/newCardStore.ts` → `src/stores/newCardStore.ts`
- Move: `src/utils/trashStore.ts` → `src/stores/trashStore.ts`
- Move: `src/utils/backupStore.ts` → `src/stores/backupStore.ts`
- Move: `src/utils/workspace/workspaceStore.ts` → `src/stores/workspaceStore.ts`

- [ ] **Step 1: Create directory and move files**

```bash
mkdir -p src/stores
git mv src/utils/cardStore.ts src/stores/cardStore.ts
git mv src/utils/boardStore.ts src/stores/boardStore.ts
git mv src/utils/libraryStore.ts src/stores/libraryStore.ts
git mv src/utils/newCardStore.ts src/stores/newCardStore.ts
git mv src/utils/trashStore.ts src/stores/trashStore.ts
git mv src/utils/backupStore.ts src/stores/backupStore.ts
git mv src/utils/workspace/workspaceStore.ts src/stores/workspaceStore.ts
```

- [ ] **Step 2: Update all imports referencing these files**

Replace in all `src/` and `electron/` files:
- `from '../../utils/cardStore'` → `from '../../stores/cardStore'`
- `from '../utils/cardStore'` → `from '../stores/cardStore'`
- `from './utils/cardStore'` → `from './stores/cardStore'`
- Same pattern for boardStore, libraryStore, newCardStore, trashStore, backupStore
- `from '../../utils/workspace/workspaceStore'` → `from '../../stores/workspaceStore'`
- `from '../utils/workspace/workspaceStore'` → `from '../stores/workspaceStore'`
- `from './utils/workspace/workspaceStore'` → `from './stores/workspaceStore'`

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(stores): move store files to src/stores/"
```

---

### Task 1.2: Create `src/converters/` and move converter files

**Files:**
- Create: `src/converters/`
- Move: `src/utils/flomoConverter.ts` → `src/converters/flomoConverter.ts`
- Move: `src/utils/htmlToBlocks.ts` → `src/converters/htmlToBlocks.ts`
- Move: `src/utils/renderBlocks.ts` → `src/converters/renderBlocks.ts`
- Move: `src/utils/richTextUtils.ts` → `src/converters/richTextUtils.ts`
- Move: `src/utils/workspace/cardConverter.ts` → `src/converters/cardConverter.ts`

- [ ] **Step 1: Create directory and move files**

```bash
mkdir -p src/converters
git mv src/utils/flomoConverter.ts src/converters/flomoConverter.ts
git mv src/utils/htmlToBlocks.ts src/converters/htmlToBlocks.ts
git mv src/utils/renderBlocks.ts src/converters/renderBlocks.ts
git mv src/utils/richTextUtils.ts src/converters/richTextUtils.ts
git mv src/utils/workspace/cardConverter.ts src/converters/cardConverter.ts
```

- [ ] **Step 2: Update all imports**

Replace in all source files:
- `from '../../utils/flomoConverter'` → `from '../../converters/flomoConverter'`
- `from '../utils/flomoConverter'` → `from '../converters/flomoConverter'`
- Same pattern for htmlToBlocks, renderBlocks, richTextUtils
- `from '../utils/workspace/cardConverter'` → `from '../converters/cardConverter'`
- `from '../../utils/workspace/cardConverter'` → `from '../../converters/cardConverter'`

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(converters): move converter files to src/converters/"
```

---

### Task 1.3: Move sync-related files to `src/sync/`

**Files:**
- Create: `src/sync/`
- Move: `src/utils/flomoSync.ts` → `src/sync/flomoSync.ts`
- Move: `src/utils/subscribeStores.ts` → `src/sync/subscribeStores.ts`
- Move: `src/utils/syncEngineRef.ts` → `src/sync/syncEngineRef.ts`
- Move: `src/utils/workspace/syncEngine.ts` → `src/sync/syncEngine.ts`

- [ ] **Step 1: Create directory and move files**

```bash
mkdir -p src/sync
git mv src/utils/flomoSync.ts src/sync/flomoSync.ts
git mv src/utils/subscribeStores.ts src/sync/subscribeStores.ts
git mv src/utils/syncEngineRef.ts src/sync/syncEngineRef.ts
git mv src/utils/workspace/syncEngine.ts src/sync/syncEngine.ts
```

- [ ] **Step 2: Update all imports**

Replace in all source files:
- `from '../../utils/flomoSync'` → `from '../../sync/flomoSync'`
- `from '../utils/flomoSync'` → `from '../sync/flomoSync'`
- Same pattern for subscribeStores, syncEngineRef
- `from '../utils/workspace/syncEngine'` → `from '../sync/syncEngine'`
- `from '../../utils/workspace/syncEngine'` → `from '../../sync/syncEngine'`

- [ ] **Step 3: Update workspace/index.ts barrel if it re-exports syncEngine**

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(sync): move sync files to src/sync/"
```

---

## Phase 2: Large File Splitting

### Task 2.1: Split SettingsDialog.tsx into tab components

**Files:**
- Create: `src/components/ui/settings/SystemSettings.tsx`
- Create: `src/components/ui/settings/SyncSettings.tsx`
- Create: `src/components/ui/settings/ExportSettings.tsx`
- Modify: `src/components/ui/SettingsDialog.tsx`

- [ ] **Step 1: Create settings directory**

```bash
mkdir -p src/components/ui/settings
```

- [ ] **Step 2: Extract SystemSettings component**

Move the `SystemSettings` function (lines 136-251) and `PANEL_HUE_OPTIONS` constant to `src/components/ui/settings/SystemSettings.tsx`. Export `SystemSettings` and `PANEL_HUE_OPTIONS`.

- [ ] **Step 3: Extract SyncSettings component**

Move the `SyncSettings` function (lines 253-427) to `src/components/ui/settings/SyncSettings.tsx`. Export `SyncSettings`.

- [ ] **Step 4: Extract ExportSettings component**

Move the `ExportSettings` function (lines 429-461) to `src/components/ui/settings/ExportSettings.tsx`. Export `ExportSettings`.

- [ ] **Step 5: Update SettingsDialog.tsx**

Replace inline components with imports from `./settings/`. SettingsDialog.tsx should be ~115 lines (shell + NavButton + tab routing).

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(ui): split SettingsDialog into tab sub-components"
```

---

### Task 2.2: Extract keyboard and undo/redo hooks from ReactFlowCanvas

**Files:**
- Create: `src/hooks/useCanvasKeyboard.ts`
- Modify: `src/components/canvas/ReactFlowCanvas.tsx`

- [ ] **Step 1: Extract useCanvasKeyboard hook**

Move the keyboard shortcut `useEffect` (Ctrl+Z/Ctrl+Shift+Z/Ctrl+Y) and `handleUndo`/`handleRedo` callbacks into `src/hooks/useCanvasKeyboard.ts`:

```ts
import { useCallback, useEffect } from 'react'

interface UseCanvasKeyboardOptions {
  undo: () => { nodes: any[]; edges: any[] } | undefined
  redo: () => { nodes: any[]; edges: any[] } | undefined
  setNodes: (updater: any) => void
  setEdges: (updater: any) => void
  clear: () => void
}

export function useCanvasKeyboard({ undo, redo, setNodes, setEdges, clear }: UseCanvasKeyboardOptions) {
  const handleUndo = useCallback(() => {
    const entry = undo()
    if (entry) {
      setNodes(entry.nodes.map((n: any) => ({ ...n, selected: false })))
      setEdges(entry.edges.map((e: any) => ({ ...e })))
    }
  }, [undo, setNodes, setEdges])

  const handleRedo = useCallback(() => {
    const entry = redo()
    if (entry) {
      setNodes(entry.nodes.map((n: any) => ({ ...n, selected: false })))
      setEdges(entry.edges.map((e: any) => ({ ...e })))
    }
  }, [redo, setNodes, setEdges])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey
      if (!isCtrl) return
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault()
        handleRedo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo])

  return { handleUndo, handleRedo }
}
```

- [ ] **Step 2: Update ReactFlowCanvas.tsx**

Remove the inline `handleUndo`, `handleRedo`, and keyboard `useEffect`. Import and call `useCanvasKeyboard` instead.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(canvas): extract useCanvasKeyboard hook from ReactFlowCanvas"
```

---

### Task 2.3: Split ImageToolbar.tsx into action and crop components

**Files:**
- Create: `src/components/editor/image-toolbar/ToolbarActions.tsx`
- Create: `src/components/editor/image-toolbar/CropOverlay.tsx`
- Modify: `src/components/editor/ImageToolbar.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p src/components/editor/image-toolbar
```

- [ ] **Step 2: Extract CropOverlay component**

Move the crop overlay JSX (the `cropping && target &&` block, lines 292-364) and related callbacks (`handleCropMouseDown`, `applyCrop`, `cancelCrop`) into `src/components/editor/image-toolbar/CropOverlay.tsx`.

- [ ] **Step 3: Extract ToolbarActions component**

Move the toolbar buttons (Copy, Download, Crop) into `src/components/editor/image-toolbar/ToolbarActions.tsx`.

- [ ] **Step 4: Update ImageToolbar.tsx**

Import and use `ToolbarActions` and `CropOverlay`. ImageToolbar.tsx should handle only: portal setup, position tracking, mouse event listeners, and composing the sub-components. Target ~120 lines.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(editor): split ImageToolbar into ToolbarActions and CropOverlay"
```

---

## Phase 3: Root Directory Cleanup

### Task 3.1: Delete debug screenshots and test artifacts

- [ ] **Step 1: Delete all root .png files**

```bash
rm -f card-editing.png card-fix-verify.png card-preview-verify.png
rm -f electron-verify.png page-loaded.png page-test.png
rm -f slash-menu-test.png text-selected.png
rm -f toolbar-test.png toolbar-test2.png toolbar-visible.png
rm -f before-test.png canvas-state.png canvas-verify.png hover-test.png
```

- [ ] **Step 2: Delete test_package.json**

```bash
rm -f test_package.json
```

- [ ] **Step 3: Add *.png to .gitignore for root-level screenshots**

Append to `.gitignore`:
```
# Debug screenshots
/*.png
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove debug screenshots and test artifacts from root"
```

---

## Verification

### Task 4.1: Final verification

- [ ] **Step 1: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 2: Dev server starts**

```bash
pnpm dev
```

Verify no console errors on load.

- [ ] **Step 3: Verify directory structure**

```bash
ls src/stores/ src/converters/ src/sync/
```

All three directories should exist with the expected files.
