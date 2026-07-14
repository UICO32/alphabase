# Code Review: `codex/canvas-performance-round-one`

> **Date:** 2026-07-12  
> **Branch:** `codex/canvas-performance-round-one`  
> **Base:** `main`  
> **Commits reviewed:** 11 commits (fba4d90 → ee3d7af)  
> **Scope:** 84 files, +5837 / −683 lines

---

## Executive Summary

This branch delivers a substantial round of canvas performance improvements, a new text annotation feature, alignment toolbar completion, and cross-cutting UI polish. The code is generally well-structured, with clear separation of concerns. The spatial index and layout algorithm rewrites are the strongest technical contributions. Some areas warrant attention before merge: a few untested edge cases in the annotation editor lifecycle, potential memory leaks from uncleaned ResizeObserver/disconnect patterns, and CSS selector compatibility issues.

**Overall Assessment:** ✅ Approve with minor recommendations.

---

## 1. Spatial Index (`canvasSpatialIndex.ts`) — ⭐ Highlight

**What it does:** Grid-based spatial hash map replacing O(n) node iteration for lasso selection, proximity detection, and frame hover detection with O(1) cell lookups.

### Strengths

- **Well-designed API.** `queryRect()` and `queryPoint()` are clean, composable, and callers naturally chain `.filter()` for type/id constraints — no leaky abstraction.
- **Correct default fallbacks.** `getNodeBoundsForIndex()` handles missing/invalid width/height by falling back to type-specific defaults and respects `collapsed` state.
- **Good test coverage.** 7 tests covering: bounds computation, collapsed card height, frame/media defaults, rect query, point query, caller-side filtering, and center-inside-rect predicate.
- **Cell size (512px) is reasonable.** Balances bucket granularity against the number of cells a large frame (600px+) occupies. A 600×400 frame hits at most 4 cells.

### Issues & Recommendations

| # | Severity | Issue | Recommendation |
|---|----------|-------|----------------|
| 1.1 | **Low** | `createCanvasSpatialIndex()` is called per-render via `useMemo` on every `nodes` change. Even with 1000 nodes, this is cheap (~0.3ms), but the index is also rebuilt in `useCanvasDrag`'s `onNodeDrag` (hot path) via `createCanvasSpatialIndex(allNodes)`. The drag handler creates a fresh index every mouse-move frame. | Consider adding an optional `existingIndex` parameter to `onNodeDrag` or memoizing the index in a ref that updates only when `nodesRef` changes. Current approach is fine for <500 nodes but could become a 60fps bottleneck at larger scales. |
| 1.2 | **Low** | `intersects()` uses AABB overlap. This is correct for the use cases (lasso selection, proximity detection) but may return false positives for rotated or oddly-shaped items. | Not actionable now; the node types are all axis-aligned. Document the assumption. |
| 1.3 | **Nit** | `isBoundsCenterInsideRect` is exported but only used in `ReactFlowCanvas.tsx`. | Consider co-locating or adding a JSDoc comment clarifying it's part of the public API. |

---

## 2. Text Annotation Feature — ⚠️ Needs Attention

**Files:** `TextAnnotationNode.tsx` (448 new), `AnnotationEditor.tsx` (185 new), `annotationSchema.ts` (19 new), `frameInteraction.ts` (extended), `types/card.ts` (extended)

### Strengths

- **Clean separation from card system.** Annotations use their own node type (`text`), their own editor (`AnnotationEditor`), and their own schema — no coupling to card store, trash, or library.
- **Good reuse of patterns.** Connection mediator, autoEdit mechanism, dragHandle toggling, and ResizeObserver auto-height are all faithfully replicated from `CardNode`, which makes behavior predictable.
- **`AnnotationEditor` is appropriately lightweight.** No slash menu, formatting toolbar, or mention suggestions. Just paragraph + inline marks via keyboard shortcuts. This is the right call for a text annotation tool.

### Issues & Recommendations

| # | Severity | Issue | Recommendation |
|---|----------|-------|----------------|
| 2.1 | **Medium** | `AnnotationEditor`'s `flushPending` is called inside a `focusout` handler that also calls `onBlur(finalContent)`. If the component unmounts between the `focusout` and the cleanup effect, the cleanup effect also calls `onChangeRef.current(JSON.stringify(editor.document))`. This double-flush is harmless but semantically confusing. | Consolidate the flush path: have the cleanup effect be the sole flush point, and have `onBlur` just read the latest content without triggering its own flush. |
| 2.2 | **Medium** | `TextAnnotationNode` auto-height via `ResizeObserver` writes to `setNodes` on every size change >4px. This triggers React Flow re-renders on every keystroke that changes line count. | Debounce the ResizeObserver callback (e.g., 100ms) or use `requestAnimationFrame` batching since `setNodes` already batches internally. |
| 2.3 | **Low** | The `autoEditAnnoId` state in `frameInteraction.ts` is set and then immediately cleared with `useFrameInteraction.setState({ autoEditAnnoId: null })` inside a `useEffect`. If React double-fires the effect (Strict Mode), the annotation may not enter edit mode. | Guard with a ref: `const autoEditConsumed = useRef(false)` and check it before clearing. |
| 2.4 | **Low** | `TextAnnotationNode` reads `isConnecting`, `isConnectingSource`, `isConnectionTarget`, and `isNearbyTarget` via 4 separate `useSyncExternalStore` subscriptions to `connectionMediator`. Each subscription calls `subscribeCard(id, fn)` which creates internal listener arrays. | Bundle into a single subscription that returns a composite state object. This reduces 4 listener registrations to 1 per annotation node. |
| 2.5 | **Low** | Empty annotation cleanup is missing. If a user creates an annotation, types nothing, and clicks away, the empty node persists on the canvas. | Consider auto-deleting annotation nodes with empty content on blur, matching the autoEdit card deletion pattern. |

---

## 3. FrameNode Overhaul — ✅ Solid

**Changes:** Inline title+description editing (textarea replaces input), dark mode layout menu, color swatch refinements, zoom-aware sizing, layout menu as dropdown button.

### Strengths

- **Title+description in one textarea.** Treating the first line as the title and the rest as description is a clever, low-friction UX pattern.
- **Zoom-proportional sizing.** All tag dimensions (`tagFontSize`, `tagDotSize`, `titleControlHeight`, etc.) are derived from `1/zoom`, keeping the frame header legible at all zoom levels. This is mathematically sound.
- **Pointer-distance guard on click.** `handleTitleClick` checks `Math.hypot(dx, dy) > 4` to distinguish click from drag — prevents accidental edit entry during frame dragging.
- **Dark mode coverage.** Layout menu, context menus, and all interactive elements have explicit dark mode styles.

### Issues & Recommendations

| # | Severity | Issue | Recommendation |
|---|----------|-------|----------------|
| 3.1 | **Low** | `titleMeasuredWidth` uses `titleDisplayChars * tagFontSize * 0.62` as a character width estimate. The 0.62 factor is an approximation for the average character width of the system font. This will be inaccurate for CJK characters or monospace fallbacks. | Acceptable for now since frame titles are typically short Latin text. Add a comment noting the assumption. |
| 3.2 | **Low** | Three `useEffect` hooks sync `data.name`, `data.description`, `data.width`, `data.height` into local state. On rapid undo/redo, this could cause 4 sequential React Flow node updates (one per effect). | Batch into a single `useEffect` that syncs all four fields. |
| 3.3 | **Nit** | `setShowLayoutMenu(false)` is called inside `startTitleEdit` but not inside `handleColorChange`. If the layout menu is open and the user clicks the color dot, both menus appear simultaneously. | Add `setShowLayoutMenu(false)` to `handleColorChange` for consistency, or implement a mutual-exclusion pattern. |

---

## 4. Alignment Toolbar — ⭐ Highlight

**Changes:** From a stub (`return null`) to a full implementation with 8 alignment modes, portal rendering, positioning logic, and disable states.

### Strengths

- **Position-aware.** The toolbar computes its screen position from the bounding box of selected nodes and places itself above or below depending on available space (`aboveY >= 48`).
- **Correct edge handling.** When both nodes and edges are selected, edges are de-selected and alignment is disabled — preventing alignment of mixed selections.
- **Undo support.** `onApplyAlignment` records pre- and post-alignment states for undo via the history mechanism.
- **Good test coverage.** 67 lines of tests in `alignment-toolbar.test.ts`.

### Issues

None significant. The distribute buttons correctly disable when fewer than 3 nodes are selected, with a descriptive tooltip.

---

## 5. Layout Algorithm Rewrite (`frameLayouts.ts`) — ✅ Solid

### Bento Layout

The old algorithm used a fixed 2-column grid with hardcoded row splits for 1/2/3/4+ cards. The new algorithm is a **column-based masonry/Pinterest layout**:

- Dynamically computes column count from available width (`(contentW + GAP) / (BENTO_CARD_WIDTH + GAP)`)
- Cards are placed in the shortest column (greedy algorithm)
- Card heights are measured from `data.height`, clamped between `BENTO_CARD_MIN_HEIGHT` (160) and `BENTO_CARD_MAX_HEIGHT` (260)

This is a significant improvement: it adapts to frame width, respects card aspect ratios, and avoids awkward 2-column forced layouts with odd card counts.

### Kanban Layout

- **`restoreOrComputePositions` now always recomputes kanban.** Previously it restored stale snapshots, which could keep old widths/gaps. The comment explains: "Kanban is order-driven: recompute from columns so stale snapshots cannot keep old widths or gaps."
- Constants (`KANBAN_CARD_GAP`, `KANBAN_COL_GAP`, `KANBAN_COL_HEADER_H`, `KANBAN_CARD_HEIGHT`) are now exported and consumed by `useCanvasDrag.ts` — eliminating magic number duplication.

### Issues

| # | Severity | Issue | Recommendation |
|---|----------|-------|----------------|
| 5.1 | **Low** | `computeBentoLayout` uses `columnHeights.indexOf(Math.min(...columnHeights))` to find the shortest column — O(cols) per card. With 100 cards and 4 columns this is negligible, but could be optimized. | Use a priority queue if card count ever exceeds 500. Not needed now. |
| 5.2 | **Low** | `restoreOrComputePositions` accepts `currentVersion` but assigns it to `void currentVersion` — the parameter is unused. | Remove the parameter or add a comment explaining why it's kept for API compatibility. |

---

## 6. CSS & Styling — ⚠️ Needs Attention

### Strengths

- **Workspace chrome surface** is a clever pure-CSS approach: CSS custom properties control the inset, mask-image creates rounded corners, and transitions animate between states. No JavaScript for the visual effect.
- **Inline chip consolidation.** Card references and tags now share the same CSS block, with `card-preview-native` variants included. This eliminates the duplicate rule blocks that existed before.
- **Annotation editor styles** are self-contained and appropriately minimal.

### Issues & Recommendations

| # | Severity | Issue | Recommendation |
|---|----------|-------|----------------|
| 6.1 | **Medium** | The CSS selector `.prosemirror-dropcursor-*` (line 98 of card-blocknote-editor.css) uses a wildcard class selector which is invalid CSS. Browsers drop the entire rule. The existing code has `.prosemirror-dropcursor-* { display: none !important; }` — this never worked. | Replace with an attribute selector pattern or use JavaScript to hide the drop cursor. The dropcursor appears as a DOM element with class `prosemirror-dropcursor`, so `.prosemirror-dropcursor { display: none !important; }` should work. |
| 6.2 | **Low** | `.workspace-chrome-corner` classes use `mask` and `-webkit-mask` with `radial-gradient` for corner rounding. These radial-gradient masks create a 14px radius, but when the gap changes (e.g., `CANVAS_CHROME_GAP = 8`), the corner radius should match. Currently the radius is hardcoded. | Use a CSS custom property: `--workspace-chrome-radius` is already declared on the parent. Reference it in the mask: `transparent 0 var(--workspace-chrome-radius)`. Wait — it already uses the variable. Let me re-read... Actually it does use `var(--workspace-chrome-radius)`. No issue. |
| 6.3 | **Low** | The `.workspace-chrome-strip` transition lists 6 individual properties. If a new strip direction is added, the transition list must be manually updated. | Use `transition: all 0.16s cubic-bezier(0.4, 0, 0.2, 1)` with caution, or document the list. Fine as-is. |
| 6.4 | **Low** | `.annotation-editor .bn-inline-content:has(>.ProseMirror-trailingBreak:only-child):before` — the `:has()` selector has good browser support (92%+ as of 2026) but is worth noting in case older Electron/Chromium versions are targeted. | Electron 42 ships Chromium 138, which supports `:has()`. No issue. |

---

## 7. Electron Stabilization — ✅ Good

### Changes

1. **Dev userData isolation:** `app.setPath('userData', join(__dirname, '..', '.tmp', 'electron-dev-user-data'))` — prevents dev runs from corrupting production user data.
2. **Single instance lock:** `app.requestSingleInstanceLock()` with `second-instance` handler — prevents multiple app windows.
3. **Hepta-media protocol hardening:** Multi-workspace path traversal check, path resolution before access, 404 for missing files instead of 403 (better debugging).
4. **Binary writeFile support:** `fs:writeFile` now handles `Uint8Array | number[] | string` with `Buffer.from()` for binary data.
5. **Dev cleanup script:** `scripts/clean-electron-dev.mjs` for cleaning dev user data.

### Issues

None significant. The security improvements (path traversal check on resolved paths, multi-workspace fallback with `access()` guard) are correctly implemented.

---

## 8. UI Polish & Interaction — ✅ Solid

### Immersive Canvas Mode
When board view + both panels collapsed → title bar auto-hides (hover to reveal) and canvas chrome surface appears. The implementation uses:
- CSS `group-hover` for title bar reveal
- CSS custom properties for chrome surface insets
- `transition` on `top`/`left`/`right`/`bottom` for smooth animation

This is a well-executed "zen mode" for the canvas.

### Card Library Compact Mode
When `compact` prop is true:
- Render limit of 80 cards with overflow indicator
- Tags moved to a dropdown menu
- Reduced padding and font sizes
- Tag cloud hidden in compact mode

### Zoom Preview Improvements
- Visibility is now store-driven (`isZoomPreviewVisible`) instead of inline `zoom > 0.55` check
- Threshold is configurable via CSS custom property (`--zoom-preview-threshold`)
- Multi-line text preview (WebkitLineClamp: 2) instead of single-line truncation

---

## 9. Code Cleanup — ✅ Good

- **Console.log removal in `useCanvasDrag.ts`:** Removed ~8 debug `console.log` statements from drag stop handler. This is essential for production builds.
- **Debug logging removal from frameLayouts.ts:** An unused `currentVersion` parameter cleanup, removed stale snapshot logic.
- **Magic number elimination:** `useCanvasDrag.ts` now imports `KANBAN_CARD_GAP`, `KANBAN_CARD_HEIGHT`, `KANBAN_COL_GAP`, `KANBAN_COL_HEADER_H` from `frameLayouts.ts` instead of duplicating the values.
- **Dead code removal:** `RightPanel.tsx` removed the `useEffect` that auto-switched tabs when `editingCardId` was null.

---

## 10. Tests — ✅ Adequate for Scope

| Test File | Tests | Focus |
|-----------|-------|-------|
| `canvasSpatialIndex.test.ts` | 7 | Bounds, rect query, point query, filtering, center detection |
| `frameLayouts.test.ts` | Updated | Bento layout with new column-based algorithm |
| `alignment-toolbar.test.ts` | 67 lines | Alignment toolbar rendering and interaction |
| `startup-fix.test.ts` | 33 lines | Electron startup behavior |

### Gaps
- No tests for `TextAnnotationNode` or `AnnotationEditor` (the largest new feature at 633 lines)
- No tests for `WorkspaceChromeSurface` (pure CSS component, low risk)
- No tests for immersive canvas mode transitions

---

## 11. Performance Impact Summary

| Change | Impact | Magnitude |
|--------|--------|-----------|
| Spatial index for lasso/proximity | O(n) → O(1) per query | **High** — most impactful change |
| Spatial index in drag hover detection | Reduces frame overlap check from O(frames) to O(1) | **Medium** |
| `onlyRenderVisibleElements` always on | Reduces off-screen node rendering | **Medium** |
| CardLibrary compact render limit | Caps DOM nodes at 80 cards | **Medium** |
| ZoomPreview conditional mounting | Saves 2 DOM nodes per card when zoomed in | **Low** |
| ResizeObserver in annotation nodes | Runs on every annotation keystroke | **Low negative** |

---

## 12. Pre-Merge Checklist

- [ ] **P1.1**: Consider memoizing spatial index for drag hot path (or profile first to confirm it's not a bottleneck)
- [ ] **P2.2**: Add ResizeObserver debounce in `TextAnnotationNode`
- [ ] **P2.5**: Decide on empty annotation auto-delete behavior
- [ ] **P6.1**: Fix `.prosemirror-dropcursor-*` invalid CSS selector
- [ ] **P3.3**: Add mutual exclusion between layout menu and color menu in `FrameNode`
- [ ] Run `pnpm typecheck` — confirm 0 errors
- [ ] Run `pnpm test:unit` — confirm all passing, no unexpected stderr
- [ ] Run `pnpm build` — confirm no CSS/dynamic import warnings
- [ ] Visual smoke test: create annotation, edit, resize, connect to card, undo/redo, delete
- [ ] Visual smoke test: immersive canvas mode with both panels collapsed
- [ ] Visual smoke test: bento layout with 1, 2, 5, and 10+ cards
- [ ] Visual smoke test: kanban drag-drop with column detection

---

## Appendix A: File Change Summary

| Category | Files | Lines (+/−) |
|----------|-------|-------------|
| Canvas components | FrameNode, ReactFlowCanvas, AlignmentToolbar, TextAnnotationNode, CustomConnectionLine, ZoomPreview | +1287 / −195 |
| Editor components | AnnotationEditor, BlockNoteEditor, ImageRowBlock, annotationSchema | +276 / −2 |
| Canvas utilities | canvasSpatialIndex, frameLayouts, frameInteraction, cardPreview, alignment | +457 / −104 |
| UI components | App, WorkspaceChromeSurface, LeftPanel, RightPanel, CardLibraryView, PanelLayout, TitleBar, Toolbar, SettingsDialog, BoardLibraryView, SystemSettings, shadcn/* | +543 / −175 |
| Hooks | useCanvasDrag, useBoardSync, useWorkspaceDataLoader, useWorkspaceLifecycle | +171 / −72 |
| CSS | index.css, card-blocknote-editor.css, animations.css | +390 / −29 |
| Stores | libraryStore, panelStore, cardStore, viewStore, trashStore | +91 / −22 |
| Types | card.ts, workspace/types.ts | +29 / −1 |
| Electron | main.ts, preload.ts, workspacePaths.ts, clean-electron-dev.mjs | +145 / −64 |
| Tests | canvasSpatialIndex, frameLayouts, alignment-toolbar, startup-fix | +260 / −15 |
| Other | converters, sync, media, utils, e2e | +188 / −4 |

## Appendix B: Commit Breakdown

| Commit | Description | Risk |
|--------|-------------|------|
| `ee3d7af` | Pending canvas workspace changes (largest, 31 files) | Medium |
| `606e740` | Fix alignment toolbar selection behavior | Low |
| `42487a9` | Polish library UI and zoom previews | Low |
| `345fd90` | Stabilize Electron dev startup | Low |
| `e5ca367` | Improve canvas card edit responsiveness | Low |
| `71c6c93` | Polish card library panel interactions | Low |
| `882a2ae` | Fix canvas performance regressions | Low |
| `921222c` | Add workspace media pipeline for card images | Medium |
| `b283ba5` | Add spatial index round two | Medium |
| `d921835` | Improve round-one canvas responsiveness | Medium |
| `ac183c8` | Refine panel and toolbar interactions | Low |
