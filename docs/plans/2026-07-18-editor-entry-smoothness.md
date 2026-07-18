# Editor Entry Smoothness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove blank frames, content flashes, and delayed cursor jumps when entering the BlockNote editor from the canvas, right panel, or card dialog.

**Architecture:** Introduce one shared editor-entry surface that keeps the sanitized card preview visible while the lazy BlockNote instance mounts. `CardBlockNoteEditor` emits a one-shot readiness signal after its first layout frame; the surface then reveals the editor, enables interaction, and ignores stale signals from previously selected cards. Canvas focus remains coordinated through the existing editor handle, but runs before the shared surface reveals the editor.

**Tech Stack:** React 18, TypeScript, BlockNote/ProseMirror, DOMPurify, Vitest, Playwright, CSS transitions, GitNexus.

---

## File structure

- Create `src/components/editor/editorEntryTransition.ts`: pure transition state and stale-token guards.
- Create `src/components/editor/editorEntryTransition.test.ts`: reducer and reduced-motion tests.
- Create `src/components/editor/CardEditorEntry.tsx`: shared preview-preserving lazy-editor surface.
- Create `src/components/editor/CardEditorEntry.test.ts`: source-level integration assertions that do not load BlockNote in jsdom.
- Modify `src/components/editor/BlockNoteEditor.tsx`: add a one-shot `onReady` callback after the first layout frame.
- Create `src/components/editor/BlockNoteEditor.readiness.test.ts`: deterministic tests for readiness scheduling and cancellation.
- Modify `src/components/editor/cardEditorLoader.tsx`: keep the single lazy import used by every entry point.
- Modify `src/components/editor/card-blocknote-editor.css`: add entry surface layering and reduced-motion behavior without changing existing selection rules.
- Modify `src/components/editor/card-blocknote-editor.css.test.ts`: cover layering, opacity-only transition, and reduced motion.
- Modify `src/components/canvas/useCardNodeEditing.ts`: replace the unbounded ref polling loop with a pre-reveal focus callback.
- Modify `src/components/canvas/card/CardContent.tsx`: use the shared entry surface and preserve the existing sanitized preview.
- Create `src/components/canvas/useCardNodeEditing.test.ts`: assert the focus intent lifecycle through exported pure helpers.
- Modify `src/components/ui/RightPanel.tsx`: use the shared entry surface for card changes.
- Modify `src/components/ui/CardEditDialog.tsx`: remove the duplicate lazy import and use the shared entry surface.
- Create `src/components/ui/editorEntryWiring.test.ts`: verify all three entry points use the shared loader/surface and no empty editor fallback remains.
- Modify `tests/e2e/media-paste.spec.ts`: reuse its isolated temporary workspace in the same describe block to verify visual continuity and readiness for canvas, side panel, and dialog.

Impact analysis recorded before implementation:

- `CardBlockNoteEditorInner`: LOW, no indexed upstream callers.
- `useCardNodeEditing`: LOW, direct caller `CardNode`; affected flows `CardNode → TryFocus` and `CardNode → RegisterEditorHandle`.
- `CardContent`: LOW, direct caller `CardNode`.
- `ClipAwareEditorView`: LOW, direct caller `RightPanel`, indirect caller `App`.
- `CardEditDialog`: LOW, direct callers `ReactFlowCanvas` and `CardLibraryView`.

No HIGH or CRITICAL target symbol was found. Re-run impact immediately before editing if the GitNexus index changes.

### Task 1: Add a stale-safe editor entry state machine

**Files:**

- Create: `src/components/editor/editorEntryTransition.ts`
- Create: `src/components/editor/editorEntryTransition.test.ts`

- [ ] **Step 1: Write the failing reducer tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  createEditorEntryState,
  editorEntryReducer,
  shouldRevealEditorImmediately,
} from './editorEntryTransition'

describe('editorEntryReducer', () => {
  it('moves the current entry from mounting to ready to interactive', () => {
    const initial = createEditorEntryState('card-a')
    const ready = editorEntryReducer(initial, { type: 'ready', entryKey: 'card-a' })
    const interactive = editorEntryReducer(ready, { type: 'interactive', entryKey: 'card-a' })

    expect(ready.phase).toBe('ready')
    expect(interactive.phase).toBe('interactive')
  })

  it('ignores readiness from a stale card', () => {
    const current = createEditorEntryState('card-b')
    expect(editorEntryReducer(current, { type: 'ready', entryKey: 'card-a' })).toBe(current)
    expect(editorEntryReducer(current, { type: 'interactive', entryKey: 'card-a' })).toBe(current)
  })

  it('resets when the entry key changes', () => {
    const interactive = { entryKey: 'card-a', phase: 'interactive' as const }
    expect(editorEntryReducer(interactive, { type: 'reset', entryKey: 'card-b' })).toEqual({
      entryKey: 'card-b',
      phase: 'mounting',
    })
  })

  it('reveals immediately only for reduced motion', () => {
    expect(shouldRevealEditorImmediately(true)).toBe(true)
    expect(shouldRevealEditorImmediately(false)).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test and verify it fails because the module is missing**

Run: `pnpm exec vitest run src/components/editor/editorEntryTransition.test.ts`

Expected: FAIL with an import-resolution error for `./editorEntryTransition`.

- [ ] **Step 3: Implement the pure state machine**

```ts
export type EditorEntryPhase = 'mounting' | 'ready' | 'interactive'

export interface EditorEntryState {
  entryKey: string
  phase: EditorEntryPhase
}

export type EditorEntryAction =
  | { type: 'reset'; entryKey: string }
  | { type: 'ready'; entryKey: string }
  | { type: 'interactive'; entryKey: string }

export function createEditorEntryState(entryKey: string): EditorEntryState {
  return { entryKey, phase: 'mounting' }
}

export function editorEntryReducer(state: EditorEntryState, action: EditorEntryAction): EditorEntryState {
  if (action.type === 'reset') {
    return action.entryKey === state.entryKey && state.phase === 'mounting'
      ? state
      : createEditorEntryState(action.entryKey)
  }

  if (action.entryKey !== state.entryKey) return state
  if (action.type === 'ready' && state.phase === 'mounting') {
    return { ...state, phase: 'ready' }
  }
  if (action.type === 'interactive' && state.phase !== 'interactive') {
    return { ...state, phase: 'interactive' }
  }
  return state
}

export function shouldRevealEditorImmediately(prefersReducedMotion: boolean) {
  return prefersReducedMotion
}
```

- [ ] **Step 4: Run the reducer tests**

Run: `pnpm exec vitest run src/components/editor/editorEntryTransition.test.ts`

Expected: 4 tests pass.

- [ ] **Step 5: Commit the state-machine slice**

```bash
git add src/components/editor/editorEntryTransition.ts src/components/editor/editorEntryTransition.test.ts
git commit -m "test: define editor entry transition states"
```

### Task 2: Add deterministic BlockNote readiness

**Files:**

- Modify: `src/components/editor/BlockNoteEditor.tsx:1-612`
- Create: `src/components/editor/BlockNoteEditor.readiness.test.ts`

- [ ] **Step 1: Write the failing readiness scheduler tests**

```ts
import { describe, expect, it, vi } from 'vitest'
import { scheduleEditorReadyAfterLayout } from './BlockNoteEditor'

describe('scheduleEditorReadyAfterLayout', () => {
  it('notifies once on the next animation frame', () => {
    let callback: FrameRequestCallback | undefined
    const requestFrame = vi.fn((next: FrameRequestCallback) => {
      callback = next
      return 7
    })
    const cancelFrame = vi.fn()
    const onReady = vi.fn()

    scheduleEditorReadyAfterLayout(requestFrame, cancelFrame, onReady)
    expect(onReady).not.toHaveBeenCalled()
    callback?.(16)
    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it('cancels the pending notification on unmount', () => {
    const requestFrame = vi.fn(() => 9)
    const cancelFrame = vi.fn()
    const cleanup = scheduleEditorReadyAfterLayout(requestFrame, cancelFrame, vi.fn())

    cleanup()
    expect(cancelFrame).toHaveBeenCalledWith(9)
  })
})
```

- [ ] **Step 2: Run the test and verify the missing export failure**

Run: `pnpm exec vitest run src/components/editor/BlockNoteEditor.readiness.test.ts`

Expected: FAIL because `scheduleEditorReadyAfterLayout` is not exported.

- [ ] **Step 3: Add the readiness API without changing editor behavior**

Add this prop to `BlockNoteEditorProps`:

```ts
onReady?: () => void
```

Add the exported scheduler near the existing pure selection helpers:

```ts
type RequestFrame = (callback: FrameRequestCallback) => number
type CancelFrame = (handle: number) => void

export function scheduleEditorReadyAfterLayout(
  requestFrame: RequestFrame,
  cancelFrame: CancelFrame,
  onReady: () => void,
) {
  let active = true
  const frameId = requestFrame(() => {
    if (!active) return
    active = false
    onReady()
  })

  return () => {
    if (!active) cancelFrame(frameId)
    active = false
  }
}
```

Destructure `onReady` in `CardBlockNoteEditorInner`, keep a current callback ref, and notify only once per editor instance:

```ts
const onReadyRef = useRef(onReady)
onReadyRef.current = onReady
const didNotifyReadyRef = useRef(false)

useEffect(() => {
  if (didNotifyReadyRef.current) return
  return scheduleEditorReadyAfterLayout(
    requestAnimationFrame,
    cancelAnimationFrame,
    () => {
      if (didNotifyReadyRef.current) return
      didNotifyReadyRef.current = true
      onReadyRef.current?.()
    },
  )
}, [editor])
```

Do not call `onChange`, focus, or replaceBlocks from this effect.

- [ ] **Step 4: Run readiness and existing selection tests**

Run: `pnpm exec vitest run src/components/editor/BlockNoteEditor.readiness.test.ts src/components/editor/BlockNoteEditor.selection.test.ts`

Expected: readiness tests and all existing selection tests pass.

- [ ] **Step 5: Commit the readiness slice**

```bash
git add src/components/editor/BlockNoteEditor.tsx src/components/editor/BlockNoteEditor.readiness.test.ts
git commit -m "feat: signal when card editor is ready"
```

### Task 3: Build the shared preview-preserving editor surface

**Files:**

- Create: `src/components/editor/CardEditorEntry.tsx`
- Create: `src/components/editor/CardEditorEntry.test.ts`
- Modify: `src/components/editor/card-blocknote-editor.css`
- Modify: `src/components/editor/card-blocknote-editor.css.test.ts`

- [ ] **Step 1: Write failing source and CSS contract tests**

`CardEditorEntry.test.ts` must read `CardEditorEntry.tsx` and assert that it imports `LazyCardBlockNoteEditor`, renders `data-editor-entry-phase`, wires `onReady`, keeps a `card-preview-native` preview, and does not use a timer delay. Extend the CSS test with these assertions:

```ts
expect(css).toMatch(/\.card-editor-entry\s*\{[^}]*position:\s*relative/is)
expect(css).toMatch(/\.card-editor-entry__preview\s*\{[^}]*position:\s*absolute[^}]*pointer-events:\s*none/is)
expect(css).toMatch(/\.card-editor-entry__editor\s*\{[^}]*opacity:\s*0[^}]*pointer-events:\s*none/is)
expect(css).toMatch(/data-editor-entry-phase=["']ready["'][^}]*\.card-editor-entry__editor[^}]*opacity:\s*1/is)
expect(css).toMatch(/prefers-reduced-motion:\s*reduce/is)
expect(css).not.toMatch(/card-editor-entry[^}]*transition:[^;}]*(height|width|transform|padding)/is)
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm exec vitest run src/components/editor/CardEditorEntry.test.ts src/components/editor/card-blocknote-editor.css.test.ts`

Expected: FAIL because the shared surface and entry CSS do not exist.

- [ ] **Step 3: Implement `CardEditorEntry`**

The component accepts `entryKey`, `previewHTML`, all required editor props, an optional forwarded editor ref, and `onBeforeReveal`. Its core must follow this structure:

```tsx
const [state, dispatch] = useReducer(editorEntryReducer, entryKey, createEditorEntryState)
const activeKeyRef = useRef(entryKey)
const frameRef = useRef<number | null>(null)
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

activeKeyRef.current = entryKey
const effectivePhase = state.entryKey === entryKey ? state.phase : 'mounting'

useEffect(() => {
  dispatch({ type: 'reset', entryKey })
  return () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
  }
}, [entryKey])

const handleReady = useCallback(() => {
  const readyKey = entryKey
  onBeforeReveal?.()
  if (shouldRevealEditorImmediately(reducedMotion)) {
    dispatch({ type: 'interactive', entryKey: readyKey })
    return
  }
  dispatch({ type: 'ready', entryKey: readyKey })
  frameRef.current = requestAnimationFrame(() => {
    frameRef.current = null
    if (activeKeyRef.current !== readyKey) return
    dispatch({ type: 'ready', entryKey: readyKey })
  })
}, [entryKey, onBeforeReveal, reducedMotion])

const handleRevealTransitionEnd = useCallback((event: React.TransitionEvent<HTMLDivElement>) => {
  if (event.target !== event.currentTarget || event.propertyName !== 'opacity') return
  dispatch({ type: 'interactive', entryKey })
}, [entryKey])
```

Render the sanitized real preview until `effectivePhase === 'interactive'`, keep the editor mounted for layout, and use the shared lazy loader:

```tsx
<div className="card-editor-entry" data-editor-entry-phase={effectivePhase}>
  {effectivePhase !== 'interactive' && (
    <div
      aria-hidden="true"
      className="card-editor-entry__preview bn-editor bn-default-styles card-preview-native"
      dangerouslySetInnerHTML={{ __html: sanitizedPreviewHTML }}
    />
  )}
  <div className="card-editor-entry__editor" onTransitionEnd={handleRevealTransitionEnd}>
    <Suspense fallback={null}>
      <LazyCardBlockNoteEditor ref={editorRef} {...editorProps} onReady={handleReady} />
    </Suspense>
  </div>
</div>
```

Sanitize `previewHTML` with the same `DOMPurify.sanitize` URI policy currently used by `CardContent`. When `previewHTML` is empty, use `useCardStore.getState().getPreviewHTML(cardId)` and then the existing low-opacity “double click to edit” fallback.

- [ ] **Step 4: Add opacity-only layering styles**

```css
.card-editor-entry {
  position: relative;
  min-height: 100%;
}

.card-editor-entry__preview {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  user-select: none;
}

.card-editor-entry__editor {
  position: relative;
  z-index: 1;
  min-height: 100%;
  opacity: 0;
  pointer-events: none;
  transition: opacity 90ms ease-out;
}

.card-editor-entry[data-editor-entry-phase="ready"] .card-editor-entry__editor,
.card-editor-entry[data-editor-entry-phase="interactive"] .card-editor-entry__editor {
  opacity: 1;
}

.card-editor-entry[data-editor-entry-phase="interactive"] .card-editor-entry__editor {
  pointer-events: auto;
}

@media (prefers-reduced-motion: reduce) {
  .card-editor-entry__editor {
    transition: none;
  }
}
```

- [ ] **Step 5: Run shared-surface and CSS tests**

Run: `pnpm exec vitest run src/components/editor/CardEditorEntry.test.ts src/components/editor/card-blocknote-editor.css.test.ts src/components/editor/editorEntryTransition.test.ts`

Expected: all tests pass, including the pre-existing selection CSS assertions.

- [ ] **Step 6: Commit the shared surface**

```bash
git add src/components/editor/CardEditorEntry.tsx src/components/editor/CardEditorEntry.test.ts src/components/editor/card-blocknote-editor.css src/components/editor/card-blocknote-editor.css.test.ts
git commit -m "feat: preserve card preview while editor mounts"
```

### Task 4: Integrate the canvas and coordinate focus before reveal

**Files:**

- Modify: `src/components/canvas/useCardNodeEditing.ts:16-102`
- Modify: `src/components/canvas/card/CardContent.tsx:1-112`
- Modify: `src/components/canvas/CardNode.tsx:32-228`
- Create: `src/components/canvas/useCardNodeEditing.test.ts`

- [ ] **Step 1: Write failing focus-intent helper tests**

Export and test a pure `takeEditorFocusIntent` helper:

```ts
import { describe, expect, it } from 'vitest'
import { takeEditorFocusIntent } from './useCardNodeEditing'

describe('takeEditorFocusIntent', () => {
  it('returns and clears click coordinates', () => {
    const ref = { current: { x: 120, y: 80 } }
    expect(takeEditorFocusIntent(ref)).toEqual({ x: 120, y: 80 })
    expect(ref.current).toBeNull()
  })

  it('returns null when auto-edit has no click point', () => {
    const ref = { current: null }
    expect(takeEditorFocusIntent(ref)).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test and verify the missing export failure**

Run: `pnpm exec vitest run src/components/canvas/useCardNodeEditing.test.ts`

Expected: FAIL because `takeEditorFocusIntent` does not exist.

- [ ] **Step 3: Replace the polling effect with pre-reveal focus**

Add the helper and callback:

```ts
export function takeEditorFocusIntent(
  ref: { current: { x: number; y: number } | null },
) {
  const intent = ref.current
  ref.current = null
  return intent
}

const prepareEditorForReveal = useCallback(() => {
  const editor = editorRef.current
  if (!editor) return
  const coords = takeEditorFocusIntent(clickCoordsRef)
  if (coords) editor.focusAtCoords(coords)
  else editor.focus()
}, [])
```

Delete the `useEffect` that repeatedly calls `requestAnimationFrame(tryFocus)`. Return `prepareEditorForReveal` from the hook. Keep editor-handle registration, blur flushing, snapshot recording, and auto-edit confirmation unchanged.

- [ ] **Step 4: Wire `CardContent` and `CardNode` to `CardEditorEntry`**

Add `onBeforeEditorReveal` to `CardContentProps`, pass `prepareEditorForReveal` from `CardNode`, and replace only the editable branch with:

```tsx
<div className="h-full overflow-y-auto px-6" style={{ fontSize: '13px', lineHeight: '1.5' }}>
  <CardEditorEntry
    entryKey={cardId}
    cardId={cardId}
    content={content}
    previewHTML={previewHTML}
    editorRef={editorRef}
    onBeforeReveal={onBeforeEditorReveal}
    onChange={onChange}
    onFocus={onFocus}
    onBlur={onBlur}
    theme={isDarkMode ? 'dark' : 'light'}
    editable
    enforceInitialHeading={enforceInitialHeading}
    onNavigateToCard={onNavigateToCard}
    onTagClick={onTagClick}
  />
</div>
```

Keep the non-editing web and native-preview branches unchanged.

- [ ] **Step 5: Run canvas-focused tests**

Run: `pnpm exec vitest run src/components/canvas/useCardNodeEditing.test.ts src/components/editor/CardEditorEntry.test.ts src/components/editor/BlockNoteEditor.selection.test.ts`

Expected: all tests pass and no existing selection test regresses.

- [ ] **Step 6: Commit the canvas integration**

```bash
git add src/components/canvas/useCardNodeEditing.ts src/components/canvas/useCardNodeEditing.test.ts src/components/canvas/card/CardContent.tsx src/components/canvas/CardNode.tsx
git commit -m "perf: reveal canvas editor after focus is ready"
```

### Task 5: Integrate the right panel and card dialog

**Files:**

- Modify: `src/components/ui/RightPanel.tsx:1-282`
- Modify: `src/components/ui/CardEditDialog.tsx:1-194`
- Modify: `src/components/editor/cardEditorLoader.tsx`
- Create: `src/components/ui/editorEntryWiring.test.ts`

- [ ] **Step 1: Write failing wiring tests**

Read the three entry-point source files and assert:

```ts
expect(cardContentSource).toContain('<CardEditorEntry')
expect(rightPanelSource).toContain('<CardEditorEntry')
expect(dialogSource).toContain('<CardEditorEntry')
expect(dialogSource).not.toMatch(/\blazy\s*\(/)
expect(dialogSource).not.toContain('fallback={null}')
expect(rightPanelSource).not.toContain('<LazyCardBlockNoteEditor')
```

- [ ] **Step 2: Run the test and verify it fails on the old entry wiring**

Run: `pnpm exec vitest run src/components/ui/editorEntryWiring.test.ts`

Expected: FAIL because `RightPanel` and `CardEditDialog` still mount the lazy editor directly.

- [ ] **Step 3: Replace the right-panel editor branch**

Import `CardEditorEntry`, remove the direct editor-loader import, and render:

```tsx
<CardEditorEntry
  key={cardId}
  entryKey={cardId}
  cardId={cardId}
  content={card.content}
  previewHTML={card.previewHTML}
  onChange={handleChange}
  editable
  theme={isDarkMode ? 'dark' : 'light'}
/>
```

Keep `key={cardId}` so ProseMirror history and pending state remain isolated across cards. Keep clip/web mode switching unchanged.

- [ ] **Step 4: Replace the dialog editor branch**

Remove `lazy` and `Suspense` from the React import, delete the local `LazyCardBlockNoteEditor`, import `CardEditorEntry`, and render:

```tsx
<CardEditorEntry
  entryKey={cardId}
  cardId={cardId}
  content={card.content}
  previewHTML={card.previewHTML}
  onChange={handleChange}
  onFocus={handleEditorFocus}
  editable
  theme={isDarkMode ? 'dark' : 'light'}
/>
```

Do not change morph timing, close/delete behavior, color controls, or history snapshots.

- [ ] **Step 5: Run wiring and existing panel tests**

Run: `pnpm exec vitest run src/components/ui/editorEntryWiring.test.ts src/components/ui/RightPanel.test.ts src/components/editor/CardEditorEntry.test.ts`

Expected: all tests pass.

- [ ] **Step 6: Commit the remaining entry points**

```bash
git add src/components/ui/RightPanel.tsx src/components/ui/CardEditDialog.tsx src/components/editor/cardEditorLoader.tsx src/components/ui/editorEntryWiring.test.ts
git commit -m "perf: smooth panel and dialog editor entry"
```

### Task 6: Add cold-entry browser regression coverage

**Files:**

- Modify: `tests/e2e/media-paste.spec.ts`

- [ ] **Step 1: Extend the existing isolated workspace seed**

In `seedWorkspace`, add a paragraph after the existing heading so all new assertions have a unique stable marker without changing the existing media-paste title:

```ts
{
  type: 'paragraph',
  content: [{ type: 'text', text: 'Editor continuity sentinel' }],
}
```

Keep the existing 280×200 board node, temporary directory cleanup, and injected `window.electronAPI.fs` implementation unchanged.

- [ ] **Step 2: Assert canvas continuity across the mount boundary**

Before clicking, observe `.react-flow__node` with a `MutationObserver` and record whether the sentinel text is absent in any animation frame. Click the sentinel text, wait for `[data-editor-entry-phase="interactive"]`, and assert:

```ts
expect(blankFrames).toBe(0)
await expect(page.locator('.card-blocknote-editor--editable .ProseMirror')).toBeFocused()
await expect(page.getByText('Editor continuity sentinel').first()).toBeVisible()
```

- [ ] **Step 3: Assert side-panel continuity**

Use the card action bar button titled `侧边编辑`, watch the right-panel content for the same sentinel, wait for interactive, and assert zero blank animation frames and exactly one visible editable editor for that card.

- [ ] **Step 4: Assert dialog continuity**

Switch to the card-library view using the existing UI control, click the seeded card to open `CardEditDialog`, watch the dialog content during its morph, wait for interactive, and assert the sentinel remains visible throughout and the dialog dimensions do not change when the editor becomes interactive.

- [ ] **Step 5: Run the new E2E file against a fresh server**

Run in PowerShell:

```powershell
$env:CI='1'; pnpm exec playwright test tests/e2e/media-paste.spec.ts --project=chromium; Remove-Item Env:CI
```

Expected: 3 tests pass. `CI=1` makes `playwright.config.ts` set `reuseExistingServer: false`.

- [ ] **Step 6: Commit the E2E regression**

```bash
git add tests/e2e/media-paste.spec.ts
git commit -m "test: cover editor entry visual continuity"
```

### Task 7: Verify the complete slice and audit the graph

**Files:**

- Review all files changed in Tasks 1–6.

- [ ] **Step 1: Run all focused unit tests**

Run:

```powershell
pnpm exec vitest run src/components/editor/editorEntryTransition.test.ts src/components/editor/BlockNoteEditor.readiness.test.ts src/components/editor/BlockNoteEditor.selection.test.ts src/components/editor/CardEditorEntry.test.ts src/components/editor/card-blocknote-editor.css.test.ts src/components/canvas/useCardNodeEditing.test.ts src/components/ui/editorEntryWiring.test.ts src/components/ui/RightPanel.test.ts
```

Expected: every named test file passes with zero failed tests.

- [ ] **Step 2: Run targeted lint**

Run:

```powershell
pnpm exec eslint src/components/editor/editorEntryTransition.ts src/components/editor/editorEntryTransition.test.ts src/components/editor/CardEditorEntry.tsx src/components/editor/CardEditorEntry.test.ts src/components/editor/BlockNoteEditor.tsx src/components/editor/BlockNoteEditor.readiness.test.ts src/components/canvas/useCardNodeEditing.ts src/components/canvas/useCardNodeEditing.test.ts src/components/canvas/card/CardContent.tsx src/components/canvas/CardNode.tsx src/components/ui/RightPanel.tsx src/components/ui/CardEditDialog.tsx src/components/ui/editorEntryWiring.test.ts tests/e2e/media-paste.spec.ts
```

Expected: exit code 0 with no lint errors.

- [ ] **Step 3: Run typecheck and the full unit suite**

Run:

```powershell
pnpm typecheck
pnpm test:unit
```

Expected: both commands exit 0; the full suite reports zero failed test files.

- [ ] **Step 4: Run build and bundle budget checks**

Run:

```powershell
pnpm electron:build
pnpm check:bundle
```

Expected: Electron build exits 0, emits `dist-electron/main.cjs` and `dist-electron/preload.cjs`, and the bundle budget passes with one shared BlockNote editor chunk rather than an extra dialog copy.

- [ ] **Step 5: Re-run fresh-server E2E**

Run:

```powershell
$env:CI='1'; pnpm exec playwright test tests/e2e/media-paste.spec.ts --project=chromium; Remove-Item Env:CI
```

Expected: 3 tests pass with zero blank-frame observations.

- [ ] **Step 6: Run whitespace and GitNexus scope checks**

Run:

```powershell
git diff --check
```

Then run GitNexus `detect_changes({ scope: "compare", base_ref: "main", repo: "base", worktree: "D:\\USE\\save\\code\\abase" })`.

Expected: no whitespace errors; affected symbols stay within editor entry, canvas focus, right panel, and dialog flows. Investigate any unrelated changed flow before committing.

- [ ] **Step 7: Final implementation commit if any verified edits remain uncommitted**

```bash
git add src/components/editor src/components/canvas/useCardNodeEditing.ts src/components/canvas/useCardNodeEditing.test.ts src/components/canvas/card/CardContent.tsx src/components/canvas/CardNode.tsx src/components/ui/RightPanel.tsx src/components/ui/CardEditDialog.tsx src/components/ui/editorEntryWiring.test.ts tests/e2e/media-paste.spec.ts
git commit -m "perf: smooth all card editor entry points"
```
