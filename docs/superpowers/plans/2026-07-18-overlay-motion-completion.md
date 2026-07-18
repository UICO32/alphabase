# Overlay and Motion Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish consistent overlay surfaces, focus behavior, spatial motion, and reduced-motion support across shared primitives and high-frequency custom overlays without changing business behavior.

**Architecture:** Extend the existing theme with semantic floating-surface and motion classes, migrate shared Radix primitives first, then adopt those classes in custom positioned overlays without changing their positioning logic. Migrate the remaining custom card editor modal to the existing Dialog foundation and finish with focused browser regressions.

**Tech Stack:** React 18, TypeScript, Radix UI, Tailwind CSS 4, Vitest, Testing Library, Playwright, GitNexus.

---

## Working rules

- Run GitNexus upstream impact before editing every existing function/component. Warn before HIGH/CRITICAL edits.
- Shared primitives retain their public exports and sizing behavior.
- Custom overlay positioning calculations and command handlers are out of scope.
- Use targeted patches; never stage unrelated dirty hunks.
- Run `detect_changes` before any commit.

### Task 1: Shared floating-surface contract

**Files:**
- Modify: `src/theme/animations.css`
- Modify: `src/index.css`
- Create: `src/components/ui/overlayFoundation.test.ts`

- [ ] Write source and computed-style assertions for `.ui-floating-surface`, `.ui-floating-content`, `.ui-tooltip-content`, and `.ui-command-bar`.
- [ ] Add semantic classes using `--surface-card`, `--line-default`, `--shadow-lg`, `--z-dropdown`, existing duration/easing tokens, and `data-side` directional movement.
- [ ] Ensure reduced-motion forces `animation-duration` and `transition-duration` to 1ms and `transform: none` for every new class.
- [ ] Run `pnpm exec vitest run src/components/ui/overlayFoundation.test.ts`, typecheck, and targeted ESLint.

### Task 2: ContextMenu, Select, and Tooltip primitives

**Files:**
- Modify: `src/components/ui/shadcn/context-menu.tsx`
- Modify: `src/components/ui/shadcn/select.tsx`
- Modify: `src/components/ui/shadcn/tooltip.tsx`
- Modify: `src/components/ui/overlayFoundation.test.ts`

- [ ] Impact-check `ContextMenuContent`, `ContextMenuItem`, `SelectContent`, `SelectItem`, and `TooltipContent`.
- [ ] Lock public exports and verify no `zoom-in`, `zoom-out`, generic `z-50`, or `z-[60]` remains.
- [ ] Apply shared surface/content classes while preserving Radix portal, viewport, side, collision, checked and disabled behavior.
- [ ] Give menu/select items the same focus, disabled and destructive state semantics as Dropdown.
- [ ] Run focused tests, typecheck, targeted ESLint, and existing BoardList/MoreActions consumers.

### Task 3: Custom canvas and editor overlays

**Files:**
- Modify: `src/components/canvas/card/SummaryFormatMenu.tsx`
- Modify: `src/components/canvas/card/BoardSubmenu.tsx`
- Modify: `src/components/canvas/AlignmentToolbar.tsx`
- Modify: `src/components/editor/ImageToolbar.tsx`
- Modify: `src/components/canvas/FrameNode.tsx`
- Create: `src/components/ui/customOverlayWiring.test.ts`

- [ ] Impact-check every component and Frame menu symbol; stop and warn on HIGH/CRITICAL.
- [ ] Add tests that pin existing portal targets, click handlers and positioning styles.
- [ ] Replace local surface/animation classes with `.ui-floating-surface` plus the correct directional content class.
- [ ] Preserve pointer-down propagation guards, outside-click listeners, coordinates and menu command payloads.
- [ ] Verify focused unit tests, typecheck and targeted ESLint.

### Task 4: Bottom command bar and CardEditDialog

**Files:**
- Modify: `src/components/ui/ClipUrlBar.tsx`
- Modify: `src/components/ui/CardEditDialog.tsx`
- Create: `src/components/ui/CardEditDialog.test.ts`

- [ ] Impact-check `ClipUrlBar`, `CardEditDialog`, focus-at-coordinate handlers and close/save callbacks.
- [ ] Migrate ClipUrlBar from generic `animate-fadeInUp` to `.ui-command-bar`; preserve its non-modal input flow.
- [ ] Lock CardEditDialog save, cancel, Escape, backdrop, focus and editor-entry behavior in tests.
- [ ] Replace only the modal shell with the shared Dialog foundation; keep editor state, dimensions and transition sequencing intact.
- [ ] Verify canvas/right-panel/dialog editor entry regression tests, typecheck and targeted ESLint.

### Task 5: Motion debt cleanup

**Files:**
- Modify: `src/components/ui/CardLibraryView.tsx`
- Modify: `src/components/ui/BoardLibraryView.tsx`
- Modify: `src/components/ui/settings/SystemSettings.tsx`
- Modify: `src/theme/animations.css`
- Modify: `src/index.css`

- [ ] Impact-check the touched components.
- [ ] Replace remaining `active:scale-*` with a 1px pressed translation or surface change.
- [ ] Remove bounce/zoom from generic overlay-facing classes and replace hard-coded near-duplicate durations with existing tokens.
- [ ] Keep hover lift at 1–2px only where it communicates draggable/card affordance.
- [ ] Disable stagger, shimmer, pulse, pressed transforms and view transitions under reduced-motion while retaining non-animated loading information.
- [ ] Run focused Card Library/Board Library/settings tests, typecheck and targeted ESLint.

### Task 6: Keyboard, viewport, and reduced-motion E2E

**Files:**
- Modify: `tests/e2e/interaction-ui-keyboard.spec.ts`
- Create: `tests/e2e/interaction-ui-overlays.spec.ts`

- [ ] Cover Tooltip, ContextMenu and Select keyboard open/close and focus behavior.
- [ ] Cover custom menu command behavior and verify their bounding boxes stay inside 480px and 1280px viewports.
- [ ] Cover ClipUrlBar and CardEditDialog Escape, outside click, focus return and viewport-safe geometry.
- [ ] Under `reducedMotion: 'reduce'`, assert Tooltip/Menu/Select/command bar/modal spatial transforms and durations are disabled.
- [ ] Run both new overlay tests plus existing responsive/keyboard suites with one worker.
- [ ] Run typecheck, targeted ESLint, focused Vitest, and GitNexus `detect_changes({ scope: 'all' })`; report unrelated dirty-tree risk separately.

