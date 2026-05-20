# Maintainability Refactor v3 — Lean Execution

Date: 2026-05-20
Status: Approved
Supersedes: v2 plan (2026-05-17) — too broad, never executed

## Goal

Improve codebase maintainability through targeted restructuring. No behavior changes.

## Phase 1: Directory Restructuring

Split `src/utils/` (28 files) into purpose-specific directories:

```
src/
  stores/              ← state management (from utils/)
    cardStore.ts
    boardStore.ts
    libraryStore.ts
    workspaceStore.ts
    undoStore.ts
  utils/
    converters/        ← format conversion (from utils/)
      markdownConverter.ts
      htmlConverter.ts
    geometry.ts        ← pure utility functions stay
    debounce.ts
    ...etc
  sync/                ← sync engine (from utils/)
    syncEngine.ts
    syncMetadata.ts
    conflictResolver.ts
```

**Rules**:
- Move files, update all imports
- No logic changes
- Each move is a separate commit for easy rollback

## Phase 2: Large File Splitting

### SettingsDialog.tsx (460 lines)
Split into:
- `SettingsDialog.tsx` — shell with tabs, ~80 lines
- `SettingsGeneral.tsx` — general settings tab
- `SettingsWorkspace.tsx` — workspace management tab
- `SettingsAbout.tsx` — about/version info tab

### ReactFlowCanvas.tsx (459 lines)
Already split `ReactFlowInner` out. Further extract:
- `useCanvasKeyboard.ts` — keyboard shortcut handling
- `useCanvasDnd.ts` — drag-and-drop logic

### ImageToolbar.tsx (369 lines)
Split into:
- `ImageToolbar.tsx` — shell/container, ~60 lines
- `ImageToolbarActions.tsx` — action buttons
- `ImageResizeControls.tsx` — resize slider and presets

## Phase 3: Root Directory Cleanup

Delete debug artifacts:
- `card-editing.png`, `card-fix-verify.png`, `card-preview-verify.png`
- `electron-verify.png`, `page-loaded.png`, `page-test.png`
- `slash-menu-test.png`, `text-selected.png`
- `toolbar-test.png`, `toolbar-test2.png`, `toolbar-visible.png`
- `test_package.json`

## Out of Scope

These were in v2 but are over-engineering for current needs:
- Event bus abstraction (window.dispatchEvent works fine)
- ResizablePanel component (not a maintainability issue)
- Centralized types file (types near their usage is clearer)
- Naming convention overhaul (current naming is consistent enough)

## Success Criteria

- All imports resolve after restructuring
- `pnpm dev` starts without errors
- No behavior changes — same UI, same functionality
- Each phase is independently verifiable
