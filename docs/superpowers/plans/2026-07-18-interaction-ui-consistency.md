# Interaction UI Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve responsive behavior, interaction states, overlays, and motion without materially changing the existing visual language or information architecture.

**Architecture:** A single responsive workspace policy will derive wide, medium, and narrow behavior and keep transient drawer state separate from existing desktop panel preferences. Existing UI primitives and theme tokens will be extended in place, then only high-frequency consumers and current custom modal surfaces will migrate. Every phase is independently testable and preserves unrelated changes in the dirty workspace.

**Tech Stack:** React 18, TypeScript, Zustand, Radix UI, Tailwind CSS 4, Vitest, Testing Library, Playwright, GitNexus.

---

## Working-tree rules

- The current workspace contains unrelated and overlapping user changes, especially in `RightPanel.tsx`, `CardLibraryView.tsx`, and `src/index.css`. Never restore, overwrite, or broadly format these files.
- Before editing each existing function/component, run GitNexus `impact({ target, direction: "upstream", repo: "D:\\USE\\save\\code\\abase" })`. Report HIGH or CRITICAL results before editing.
- Use targeted patches. Before every commit run `detect_changes({ scope: "staged", repo: "D:\\USE\\save\\code\\abase" })`.
- Stage only owned hunks with `git add -p`. If an owned hunk cannot be separated from a pre-existing user hunk, leave the task uncommitted and report it rather than staging unrelated work.
- In this repository, focused `.test.ts` files are preferred for reliable Vitest discovery. Use `React.createElement` when a component test needs React without JSX.

## File map

### Create

- `src/hooks/workspaceLayout.ts` — pure breakpoints and responsive panel state transitions.
- `src/hooks/workspaceLayout.test.ts` — breakpoint, mutual-exclusion, preference-preservation tests.
- `src/hooks/useWorkspaceLayout.ts` — browser width subscription and App-facing responsive controller.
- `src/components/ui/ResponsiveSidePanel.tsx` — normal panel versus edge-drawer presentation and accessibility behavior.
- `src/components/ui/ResponsiveSidePanel.test.ts` — narrow drawer rendering, dismissal, and focus tests.
- `tests/e2e/interaction-ui-responsive.spec.ts` — viewport and panel interaction regression coverage.
- `tests/e2e/interaction-ui-keyboard.spec.ts` — keyboard, focus return, Escape, and reduced-motion coverage.

### Modify

- `src/App.tsx` — own responsive controller, effective insets, drawer overlay, and panel callbacks.
- `src/components/ui/LeftPanel.tsx` — controlled open state and shared responsive wrapper.
- `src/components/ui/RightPanel.tsx` — controlled open state, shared responsive wrapper, narrow-mode resize guard.
- `src/components/ui/Toolbar.tsx` — shared IconButton usage, selected semantics, right-panel callback.
- `src/stores/panelStore.ts` — preserve desktop panel preferences; do not store viewport mode or drawer state.
- `src/components/ui/Button.tsx` and `src/components/ui/IconButton.tsx` — unified state props and data attributes.
- `src/components/ui/BoardList.tsx` and `src/components/ui/CardLibraryView.tsx` — high-frequency state migration only.
- `src/components/ui/shadcn/dialog.tsx` — viewport-safe sizing, optional close button, shared overlay/motion classes.
- `src/components/ui/WorkspacePicker.tsx`, `WorkspaceConflictDialog.tsx`, `TrashBinPanel.tsx` — migrate custom modal shells to Dialog primitives.
- `src/theme/tokens.css`, `src/theme/animations.css`, `src/index.css` — state, overlay, drawer, duration, and reduced-motion rules.
- `src/components/ui/shadcn/sonner.tsx` or `src/App.tsx` — one visible Toast and five-second default duration, depending on the existing wrapper boundary.

---

### Task 1: Pure responsive workspace policy

**Files:**
- Create: `src/hooks/workspaceLayout.ts`
- Create: `src/hooks/workspaceLayout.test.ts`

- [ ] **Step 1: Run impact analysis for panel preference setters**

Run GitNexus impact for `setLeftPanelCollapsed`, `setRightPanelCollapsed`, and `toggleAllSidebars` in `src/stores/panelStore.ts`. Do not edit if the result is HIGH/CRITICAL until the user is warned.

- [ ] **Step 2: Write failing policy tests**

Cover these exact cases:

```ts
import { describe, expect, it } from 'vitest'
import {
  getWorkspaceLayoutMode,
  reduceResponsivePanels,
  type ResponsivePanelState,
} from './workspaceLayout'

const initial: ResponsivePanelState = {
  desktopLeftOpen: true,
  desktopRightOpen: true,
  mediumOpenSide: 'left',
  drawerSide: null,
}

describe('getWorkspaceLayoutMode', () => {
  it.each([
    [1099, 'medium'],
    [1100, 'wide'],
    [819, 'narrow'],
    [820, 'medium'],
  ] as const)('maps %dpx to %s', (width, expected) => {
    expect(getWorkspaceLayoutMode(width)).toBe(expected)
  })
})

describe('reduceResponsivePanels', () => {
  it('opens only one medium panel', () => {
    const next = reduceResponsivePanels(initial, { type: 'open', mode: 'medium', side: 'right' })
    expect(next.mediumOpenSide).toBe('right')
  })

  it('opens only one transient narrow drawer', () => {
    const opened = reduceResponsivePanels(initial, { type: 'open', mode: 'narrow', side: 'left' })
    const switched = reduceResponsivePanels(opened, { type: 'open', mode: 'narrow', side: 'right' })
    expect(switched.drawerSide).toBe('right')
  })

  it('does not overwrite wide preferences while using a drawer', () => {
    const opened = reduceResponsivePanels(initial, { type: 'open', mode: 'narrow', side: 'right' })
    const closed = reduceResponsivePanels(opened, { type: 'close', mode: 'narrow', side: 'right' })
    expect(closed.desktopLeftOpen).toBe(true)
    expect(closed.desktopRightOpen).toBe(true)
  })

  it('closes the transient drawer when leaving narrow mode', () => {
    const opened = { ...initial, drawerSide: 'left' as const }
    expect(reduceResponsivePanels(opened, { type: 'modeChanged', mode: 'medium' }).drawerSide).toBeNull()
  })
})
```

- [ ] **Step 3: Run the tests and verify failure**

Run: `pnpm exec vitest run src/hooks/workspaceLayout.test.ts`

Expected: FAIL because `workspaceLayout.ts` does not exist.

- [ ] **Step 4: Implement the pure policy**

Implement the exact public boundary:

```ts
export type WorkspaceLayoutMode = 'wide' | 'medium' | 'narrow'
export type PanelSide = 'left' | 'right'

export interface ResponsivePanelState {
  desktopLeftOpen: boolean
  desktopRightOpen: boolean
  mediumOpenSide: PanelSide | null
  drawerSide: PanelSide | null
}

export type ResponsivePanelEvent =
  | { type: 'open'; mode: WorkspaceLayoutMode; side: PanelSide }
  | { type: 'close'; mode: WorkspaceLayoutMode; side: PanelSide }
  | { type: 'toggle'; mode: WorkspaceLayoutMode; side: PanelSide }
  | { type: 'modeChanged'; mode: WorkspaceLayoutMode }

export const WIDE_WORKSPACE_MIN = 1100
export const MEDIUM_WORKSPACE_MIN = 820

export function getWorkspaceLayoutMode(width: number): WorkspaceLayoutMode {
  if (width >= WIDE_WORKSPACE_MIN) return 'wide'
  if (width >= MEDIUM_WORKSPACE_MIN) return 'medium'
  return 'narrow'
}
```

`reduceResponsivePanels` must update desktop preferences only in wide mode, `mediumOpenSide` only in medium mode, and `drawerSide` only in narrow mode. `modeChanged` must clear `drawerSide` whenever the destination is not narrow.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
pnpm exec vitest run src/hooks/workspaceLayout.test.ts
pnpm exec eslint src/hooks/workspaceLayout.ts src/hooks/workspaceLayout.test.ts
```

Expected: all tests and lint pass. Stage only these two files, run GitNexus staged `detect_changes`, then commit `feat: add responsive workspace policy`.

---

### Task 2: App-facing responsive controller

**Files:**
- Create: `src/hooks/useWorkspaceLayout.ts`
- Modify: `src/App.tsx`
- Modify: `src/stores/panelStore.ts`

- [ ] **Step 1: Impact-check the App and panel store symbols**

Run upstream impact for `App`, `usePanelStore`, `setLeftPanelCollapsed`, `setRightPanelCollapsed`, and `toggleAllSidebars`. Report HIGH/CRITICAL before editing.

- [ ] **Step 2: Add a width subscription and controller test seam**

`useWorkspaceLayout.ts` must use `useSyncExternalStore` with a single `resize` subscription and expose:

```ts
export interface WorkspaceLayoutController {
  mode: WorkspaceLayoutMode
  leftOpen: boolean
  rightOpen: boolean
  drawerSide: PanelSide | null
  openPanel: (side: PanelSide) => void
  closePanel: (side: PanelSide) => void
  togglePanel: (side: PanelSide) => void
  closeDrawer: () => void
}

export function useWorkspaceLayout(): WorkspaceLayoutController
```

Initialize desktop preferences from `usePanelStore`. Synchronize wide-mode actions back to its existing collapsed booleans. Keep `mediumOpenSide` and `drawerSide` inside the hook so responsive transitions never overwrite desktop preferences.

- [ ] **Step 3: Route App shell calculations through effective open state**

In `App`, replace direct visual use of `leftPanelCollapsed/rightPanelCollapsed` with controller-derived `leftOpen/rightOpen`. Keep the store as the preference source. Calculate chrome insets as:

```ts
const chromeInsets = {
  top: CANVAS_CHROME_GAP,
  right: layout.mode === 'narrow' || !layout.rightOpen
    ? CANVAS_CHROME_GAP
    : rightPanelWidth + CANVAS_CHROME_GAP,
  bottom: CANVAS_CHROME_GAP,
  left: layout.mode === 'narrow' || !layout.leftOpen
    ? CANVAS_CHROME_GAP
    : LEFT_PANEL_WIDTH + CANVAS_CHROME_GAP,
}
```

Pass controlled open/close callbacks to both panels and pass `onOpenRightPanel={() => layout.openPanel('right')}` to Toolbar.

- [ ] **Step 4: Preserve the Tab shortcut semantics by mode**

Replace the direct `toggleAllSidebars()` call in App with controller behavior:

- wide: toggle both desktop panel preferences together;
- medium: toggle the currently open side, defaulting to left if none is open;
- narrow: close the active drawer, or open the left drawer if none is open.

Do not remove `toggleAllSidebars` until GitNexus confirms it has no other callers. If it still has callers, leave it intact.

- [ ] **Step 5: Verify**

Run targeted hook tests, `pnpm typecheck`, and targeted ESLint for App, the hook, and panel store. Stage only owned hunks, run staged `detect_changes`, and commit `feat: coordinate responsive panel state`.

---

### Task 3: Responsive side panel and edge drawer

**Files:**
- Create: `src/components/ui/ResponsiveSidePanel.tsx`
- Create: `src/components/ui/ResponsiveSidePanel.test.ts`
- Modify: `src/components/ui/LeftPanel.tsx`
- Modify: `src/components/ui/RightPanel.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Impact-check `LeftPanel`, `RightPanel`, and `beginRightPanelResize`**

Report HIGH/CRITICAL results. Pay special attention to the existing right-panel resize tests and lazy panel wiring.

- [ ] **Step 2: Write failing drawer behavior tests**

Using Testing Library without JSX, verify:

- narrow + open renders `role="dialog"` and `aria-modal="true"`;
- left and right sides receive different transform directions;
- Escape calls `onOpenChange(false)`;
- clicking the overlay calls `onOpenChange(false)`;
- close returns focus to the supplied trigger ref;
- wide/medium presentation does not render an overlay or modal semantics.

- [ ] **Step 3: Implement `ResponsiveSidePanel`**

Public API:

```ts
interface ResponsiveSidePanelProps {
  side: 'left' | 'right'
  mode: 'wide' | 'medium' | 'narrow'
  open: boolean
  width: number
  label: string
  triggerRef?: React.RefObject<HTMLElement>
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}
```

For narrow mode, render a fixed overlay beneath the title bar and a flush edge drawer with `width: min(360px, 88vw)`. Trap focus while open, close on Escape/overlay, and restore trigger focus. For wide/medium, render the existing absolute panel shell without modal semantics.

- [ ] **Step 4: Convert LeftPanel and RightPanel to controlled presentation**

Both panels receive `mode`, `open`, `onOpen`, and `onClose`. Remove direct visual decisions based on collapsed store fields. Preserve content, active tabs, lazy loading, and all existing callbacks.

RightPanel keeps its stored width in wide/medium modes. Hide and disable the resize handle in narrow mode; never mutate `rightPanelWidth` from drawer sizing.

- [ ] **Step 5: Add drawer CSS**

Add scoped classes using existing tokens:

```css
.workspace-drawer-overlay {
  position: fixed;
  inset: var(--workspace-titlebar-height, 24px) 0 0;
  z-index: var(--z-overlay);
  background: color-mix(in srgb, var(--surface-overlay) 72%, transparent);
  animation: workspace-overlay-in var(--duration-normal) var(--ease-out) both;
}

.workspace-drawer {
  position: absolute;
  inset-block: 0;
  width: min(360px, 88vw);
  background: var(--surface-panel);
  box-shadow: var(--shadow-xl);
  transition: transform var(--duration-normal) var(--ease-out);
}
```

The drawer has no outer margin and no floating-card radius. Only the inner edge may use the existing panel boundary treatment.

- [ ] **Step 6: Verify**

Run the new component test, existing `RightPanel.test.ts`, `rightPanelLazyWiring.test.ts`, typecheck, and targeted ESLint. Then staged `detect_changes` and commit `feat: add responsive edge drawers`.

---

### Task 4: Viewport-safe Dialog foundation

**Files:**
- Modify: `src/components/ui/shadcn/dialog.tsx`
- Modify: `src/theme/animations.css`

- [ ] **Step 1: Impact-check `DialogContent`, `DialogOverlay`, and all exported Dialog symbols**

Because these are shared primitives, summarize direct consumers and report HIGH/CRITICAL before editing.

- [ ] **Step 2: Add primitive tests or source assertions**

Verify Dialog content has `w-[calc(100vw-2rem)]`, a configurable maximum width, shared focus ring close control, and an optional close button.

- [ ] **Step 3: Extend DialogContent without breaking existing consumers**

Use this compatible boundary:

```ts
interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  showCloseButton?: boolean
  size?: 'sm' | 'md' | 'lg'
}
```

Defaults: `showCloseButton = true`, `size = 'md'`. Size controls only max-width (`sm: 28rem`, `md: 32rem`, `lg: 37.5rem`); all sizes use `w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]`.

Replace zoom-heavy entry with a short fade plus small translate. Use existing duration/easing tokens and preserve Radix data-state selectors.

- [ ] **Step 4: Verify**

Run focused tests, typecheck, and ESLint. Stage only the Dialog primitive and animation hunks, run `detect_changes`, and commit `refactor: standardize dialog surface`.

---

### Task 5: Migrate current custom modal shells

**Files:**
- Modify: `src/components/ui/WorkspacePicker.tsx`
- Modify: `src/components/ui/WorkspaceConflictDialog.tsx`
- Modify: `src/components/ui/TrashBinPanel.tsx`
- Add or modify focused `.test.ts` files for each component

- [ ] **Step 1: Impact-check all three component functions and their action handlers**

WorkspaceConflictDialog is a safety-critical recovery path. Do not change choice meanings, default recommendations, or data operations.

- [ ] **Step 2: Write behavioral tests before migration**

Lock these behaviors:

- WorkspacePicker closes on outside click and Escape, and selecting a workspace emits the same event.
- WorkspaceConflictDialog cannot dismiss by outside click or Escape; only `backup`, `continue`, or `cancel` reaches `onChoice`.
- TrashBinPanel closes on outside click/Escape but permanent deletion still requires its existing confirmation.

- [ ] **Step 3: Replace only the outer shells with Dialog primitives**

Use `Dialog open onOpenChange`, `DialogContent`, `DialogTitle`, and `DialogDescription`. Preserve inner content and business handlers.

- WorkspacePicker: `size="md"`, `max-height` scroll region.
- WorkspaceConflictDialog: `size="lg"`, `showCloseButton={false}`, prevent outside interaction and Escape.
- TrashBinPanel: `size="lg"`, keep header actions and scroll region.

- [ ] **Step 4: Verify**

Run the three focused component tests, typecheck, and targeted ESLint. Run staged `detect_changes`; commit `refactor: unify primary modal shells` only if staged hunks exclude unrelated work.

---

### Task 6: Shared interaction-state primitives

**Files:**
- Modify: `src/components/ui/Button.tsx`
- Modify: `src/components/ui/IconButton.tsx`
- Modify: `src/theme/animations.css`
- Modify: `src/index.css`
- Create: `src/components/ui/interactionPrimitives.test.ts`

- [ ] **Step 1: Impact-check Button and IconButton**

List all direct consumers. Warn before editing if shared impact is HIGH/CRITICAL.

- [ ] **Step 2: Write failing state tests**

Verify both primitives:

- forward disabled and loading semantics;
- accept `selected?: boolean`;
- set `data-selected="true"` when selected;
- preserve caller-provided `aria-pressed` or `aria-selected`;
- include the common focus-visible class.

- [ ] **Step 3: Implement the compatible state API**

Add `selected?: boolean` without removing existing variants or sizes. Selected styling must use shared data selectors rather than component-specific inline colors.

CSS rules:

```css
.interactive-control {
  transition:
    background-color var(--duration-fast) var(--ease-default),
    border-color var(--duration-fast) var(--ease-default),
    color var(--duration-fast) var(--ease-default),
    box-shadow var(--duration-fast) var(--ease-default),
    transform var(--duration-fast) var(--ease-default);
}

.interactive-control:active:not(:disabled) { transform: translateY(1px); }
.interactive-control[data-selected="true"] {
  background: var(--surface-card-active);
  color: var(--fg-primary);
  border-color: var(--line-active);
}
.interactive-control:disabled { cursor: not-allowed; }
```

Remove the global `scale(0.96)` pressed behavior from `.btn-base`; selected controls must remain selected during hover/focus.

- [ ] **Step 4: Verify**

Run the primitive test, typecheck, and targeted ESLint. Run staged `detect_changes`; commit `refactor: unify control interaction states`.

---

### Task 7: Migrate Toolbar and panel navigation states

**Files:**
- Modify: `src/components/ui/Toolbar.tsx`
- Modify: `src/components/ui/LeftPanel.tsx`
- Modify: `src/components/ui/RightPanel.tsx`
- Modify: `src/components/ui/BoardList.tsx`
- Modify focused Toolbar/LeftPanel/RightPanel/BoardList tests

- [ ] **Step 1: Impact-check all touched component functions**

Account for existing lazy-loading and resize flows in RightPanel and existing dirty hunks in BoardList/RightPanel.

- [ ] **Step 2: Add semantic state assertions**

Tests must verify:

- lasso, text tool, and topography controls expose `aria-pressed`;
- panel tab buttons expose `aria-selected` and live in a tablist-compatible group;
- active board exposes `aria-current="page"`;
- icon-only controls have accessible names;
- responsive panel triggers call the App-provided controller callbacks.

- [ ] **Step 3: Migrate high-frequency controls**

Use IconButton for Toolbar actions and panel expand/collapse controls. Pass `selected` plus the appropriate ARIA state for persistent tools. Preserve the black primary Add Card treatment as an existing visual exception.

Keep the segmented indicator but make the buttons semantic: `role="tab"`, `aria-selected`, and roving behavior if existing Radix Tabs can be adopted without changing layout. Do not replace panel content architecture merely to obtain tab styling.

Add keyboard activation to the workspace picker header control, which is currently a clickable div; render it as a button or use Button with full-width content.

- [ ] **Step 4: Verify**

Run focused tests, typecheck, and targeted ESLint. Run staged `detect_changes`; commit `refactor: align toolbar and panel states` if owned hunks are separable.

---

### Task 8: Migrate Card Library high-frequency controls

**Files:**
- Modify: `src/components/ui/CardLibraryView.tsx`
- Modify: `src/components/ui/CardLibraryRelevanceButton.tsx`
- Modify existing Card Library focused tests

- [ ] **Step 1: Impact-check CardLibraryView and CardLibraryRelevanceButton**

Preserve current relevance sort behavior, lazy boundary, and first-load skeleton work already present in the dirty workspace.

- [ ] **Step 2: Add state assertions**

Verify selected search mode, sort option, tag filter, and relevance control expose semantic selected state. Verify disabled sync/relevance controls do not receive hover/pressed styling.

- [ ] **Step 3: Apply shared state classes only to controls**

Migrate search mode, sort options, tag filters, relevance, sync, and filter-clear controls to the shared interaction state. Do not restructure card rendering, data filtering, semantic search, or lazy loading.

Replace card `active:scale-[0.98]` with a 1px pressed translation or surface change; retain the existing subtle hover lift unless reduced motion is enabled.

- [ ] **Step 4: Verify**

Run Card Library/Relevance/Skeleton focused tests, typecheck, and targeted ESLint. Run staged `detect_changes`; commit `refactor: align card library interaction states` only with separable hunks.

---

### Task 9: Overlay, Toast, and reduced-motion completion

**Files:**
- Modify: `src/components/ui/shadcn/popover.tsx`
- Modify: `src/components/ui/shadcn/dropdown-menu.tsx`
- Modify: `src/components/ui/shadcn/sonner.tsx` or `src/App.tsx`
- Modify: `src/theme/animations.css`
- Modify: `src/index.css`

- [ ] **Step 1: Impact-check shared Popover, Dropdown, and Toaster exports**

Summarize consumer count and report HIGH/CRITICAL before changing shared classes.

- [ ] **Step 2: Standardize surface and entry direction**

Popover and Dropdown retain Radix positioning but share semantic border, surface, shadow, z-index, and `140–180ms` state transitions. Animation direction follows `data-side`; no scale bounce.

Configure Sonner with:

```tsx
<Toaster
  position="bottom-center"
  richColors
  visibleToasts={1}
  duration={5000}
/>
```

- [ ] **Step 3: Expand reduced-motion coverage**

Under `@media (prefers-reduced-motion: reduce)`, disable drawer translation, Dialog/Popover/Dropdown spatial movement, segmented indicator sliding, list/card entrance, and pressed transforms. Keep state colors immediate and preserve loading information without movement where possible.

- [ ] **Step 4: Verify**

Run relevant primitive tests, typecheck, and targeted ESLint. Run staged `detect_changes`; commit `refactor: standardize overlay and motion behavior`.

---

### Task 10: Responsive and keyboard end-to-end verification

**Files:**
- Create: `tests/e2e/interaction-ui-responsive.spec.ts`
- Create: `tests/e2e/interaction-ui-keyboard.spec.ts`
- Modify only production files required by failures found in these tests

- [ ] **Step 1: Write viewport tests**

Cover `1280x800`, `900x800`, `680x800`, and `480x800`:

- 1280: both side panels may be open and canvas remains visible.
- 900: opening right closes left; opening left closes right.
- 680/480: panels appear as flush edge drawers with one active at a time.
- narrow drawer width is at most 88% of viewport and has no outer edge margin.
- Dialog content stays inside the viewport with at least 16px horizontal safety space.
- capture canvas transform/viewport before and after drawer open/close and assert it is unchanged.

- [ ] **Step 2: Write keyboard and reduced-motion tests**

Cover:

- panel trigger -> drawer -> Escape -> focus returns to trigger;
- Tab remains trapped inside an open modal drawer;
- WorkspaceConflictDialog ignores Escape;
- selected controls expose correct ARIA state;
- with `reducedMotion: 'reduce'`, drawer and overlay computed animation/transition movement is absent.

- [ ] **Step 3: Run targeted browser tests**

Run:

```powershell
pnpm exec playwright test tests/e2e/interaction-ui-responsive.spec.ts tests/e2e/interaction-ui-keyboard.spec.ts --workers=1
```

Expected: all new tests pass. Keep `reuseExistingServer: false` for trustworthy Electron/browser runs if the current Playwright config supports it.

- [ ] **Step 4: Run final focused verification**

Run:

```powershell
pnpm typecheck
pnpm exec eslint src/App.tsx src/hooks/workspaceLayout.ts src/hooks/useWorkspaceLayout.ts src/components/ui/ResponsiveSidePanel.tsx src/components/ui/LeftPanel.tsx src/components/ui/RightPanel.tsx src/components/ui/Toolbar.tsx src/components/ui/Button.tsx src/components/ui/IconButton.tsx src/components/ui/BoardList.tsx src/components/ui/CardLibraryView.tsx src/components/ui/CardLibraryRelevanceButton.tsx src/components/ui/WorkspacePicker.tsx src/components/ui/WorkspaceConflictDialog.tsx src/components/ui/TrashBinPanel.tsx src/components/ui/shadcn/dialog.tsx src/components/ui/shadcn/popover.tsx src/components/ui/shadcn/dropdown-menu.tsx
pnpm exec vitest run src/hooks/workspaceLayout.test.ts src/components/ui/ResponsiveSidePanel.test.ts src/components/ui/interactionPrimitives.test.ts src/components/ui/RightPanel.test.ts src/components/ui/BoardList.test.ts src/components/ui/CardLibraryRelevanceButton.test.ts src/components/ui/CardLibrarySkeleton.test.ts
pnpm exec playwright test tests/e2e/interaction-ui-responsive.spec.ts tests/e2e/interaction-ui-keyboard.spec.ts --workers=1
```

- [ ] **Step 5: Final graph and scope review**

Run GitNexus `detect_changes({ scope: "all", repo: "D:\\USE\\save\\code\\abase" })`. Compare the changed symbols and affected flows with Tasks 1–10. Explicitly report unrelated pre-existing changes and do not claim the entire dirty tree is part of this feature.

- [ ] **Step 6: Final commit or handoff**

If every owned hunk is separable, commit the E2E tests and any final owned fixes as `test: cover interaction UI responsiveness`. If overlap prevents safe staging, leave those hunks uncommitted and provide an exact file/hunk handoff.

## Completion criteria

- All acceptance criteria in `docs/superpowers/specs/2026-07-18-interaction-ui-consistency-design.md` map to at least one task above.
- No task changes visual branding, information architecture, canvas data behavior, search semantics, backup behavior, or workspace recovery choices.
- P0 can ship independently before P1/P2; each later task preserves a working application and has targeted verification.
- The final report distinguishes freshly verified results from checks skipped because of environment or unrelated dirty-tree failures.

