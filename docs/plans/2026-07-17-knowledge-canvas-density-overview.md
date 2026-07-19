# Knowledge Canvas Density Overview Implementation Plan

## Goal

Add a zoom-driven distant view to the existing knowledge canvas. At low zoom, the normal card canvas transitions into a neutral dot field where every card remains anchored to its original position and is represented by a radial information-density field. Hovering a field colors every visible card in the same semantic cluster; clicking pins the cluster and opens a temporary right-side preview drawer with fading elbow connectors back to the corresponding canvas positions.

This is a presentation layer of the existing board, not a new persisted view mode.

## Locked product decisions

- Enter the transition at zoom `0.56`; finish it at `0.46`.
- Semantic clusters come from the existing embedding cluster result.
- If embeddings are unavailable, fall back to shared tags plus explicit board-edge connectivity.
- Only cards placed on the active board participate in fields, clusters, hover, and the drawer.
- Orphan cards still render gray density fields but do not open a group drawer.
- Density combines content richness and graph centrality.
- The overview follows the current light/dark theme, but remains grayscale until a cluster is active.
- The drawer overlays the canvas and never mutates or collapses the existing right panel.
- Clicking a drawer card closes the overview and smoothly focuses its original card.
- `Escape`, blank-canvas click, a new zoom gesture, or returning to near view clears the pinned cluster.
- While the overview is active, keep pan, wheel zoom, pinch zoom, hover, pin, drawer scroll, and preview-card focus; disable drag, selection, lasso, connection creation, and editing.
- Optimize for smooth interaction at 1,000 cards. At larger board sizes, increase dot spacing and cull offscreen fields rather than preserving fixed dot resolution.

## Architecture

The feature has four isolated units:

1. `densityOverviewModel.ts` builds a board-only, render-ready model from React Flow nodes/edges, global cards, and the embedding cluster result. It owns density scoring, fallback grouping, zoom progress, viewport projection, field radius, adaptive grid spacing, and hit testing.
2. `densityOverviewRenderer.ts` performs Canvas 2D drawing. It receives immutable render data and has no store or React dependencies.
3. `DensityOverviewLayer.tsx` reads the live React Flow transform, schedules drawing through one `requestAnimationFrame`, owns hover/pin state, and gates pointer behavior.
4. `DensityOverviewDrawer.tsx` renders readable previews and an SVG connector layer. It owns drawer scrolling and element measurements, but receives all cluster/card/position data through props.

`ReactFlowCanvas.tsx` remains the coordinate and interaction owner. It passes board nodes, visible edges, and a focus callback into the overview layer, and applies overview progress to the normal React Flow presentation through CSS variables/data attributes.

## Rendering and data rules

### Zoom transition

Use a clamped smoothstep rather than a hard switch:

```ts
const progress = smoothstep(0.56, 0.46, zoom)
```

- `progress = 0`: normal canvas only.
- `0 < progress < 1`: normal nodes/edges fade out while dots fade in.
- `progress = 1`: full distant view.
- Overview pointer hit testing starts at `progress >= 0.72` so transitional zooming does not accidentally pin clusters.
- Any zoom change clears pin immediately; hover resumes 120 ms after viewport movement settles.

### Density score

Extract these signals for every board card:

- Effective text characters after removing markup/JSON syntax.
- Block count.
- Image/attachment/embed count.
- Tag count.
- Visible board-edge degree.

Normalize with logarithmic caps so one huge card cannot dominate:

```ts
content = clamp01(log1p(textChars) / log1p(8000))
structure = clamp01(
  0.55 * log1p(blockCount) / log1p(80) +
  0.30 * log1p(mediaCount) / log1p(12) +
  0.15 * log1p(tagCount) / log1p(10)
)
centrality = clamp01(log1p(edgeDegree) / log1p(12))
density = 0.58 * content + 0.17 * structure + 0.25 * centrality
```

Use the score in two ways:

- Field radius grows from roughly `64` to `190` screen pixels at reference zoom `0.46`.
- Peak brightness and the proportion of large center dots grow with density.

Every field uses a Gaussian radial falloff. Center dots are largest and brightest; edge dots shrink smoothly into the low-luminance base grid.

### Semantic grouping

Primary path:

- Read `embeddingStore.clusterResult`.
- Intersect every cluster with active-board card IDs.
- Keep groups with at least two active-board cards.
- Preserve `cluster.id`, `cluster.label`, cohesion, and per-card similarity.
- Treat embedding orphans and single board intersections as ungrouped gray fields.

Fallback path, used only when no usable embedding cluster result exists:

- Build a union-find over active-board cards.
- Union cards connected by a visible board edge.
- Union cards sharing at least one explicit tag.
- Keep connected components with at least two cards; leave all others ungrouped.
- Generate deterministic fallback IDs from sorted member card IDs and use the most common tag, otherwise the most central card title, as the label.

Cluster colors are deterministic from the cluster ID, with a controlled accessible palette. They are only applied to the active hover/pinned cluster; all other fields remain grayscale.

### Canvas performance

- Draw the low-luminance base grid once per frame.
- Project only card nodes whose field bounds intersect the viewport plus one grid-cell margin.
- Use typed arrays for grid intensity and dominant cluster index.
- Splat each visible field only into grid cells inside its radius; do not compare every screen dot with every card.
- Cap device pixel ratio at `2`.
- Use `18px` base spacing through 1,000 cards, then increase spacing with `sqrt(cardCount / 1000)` and clamp it to `32px`.
- Cache the board model until cards, edges, card content, or cluster data change. Viewport movement only reprojects and redraws.
- Reuse a single RAF; cancel it on unmount.

## Interaction specification

### Hover and pin

- Hit-test against projected radial fields after movement settles.
- Choose the strongest field at the pointer; if it is ungrouped, show no color or drawer.
- Hovering a grouped field colors every field belonging to that cluster, including spatially separated cards.
- Hover opens a non-interactive preview drawer; moving off closes it unless pinned.
- Clicking the hovered group pins it and enables independent drawer scrolling.
- Clicking blank canvas, pressing `Escape`, or starting another zoom clears the pin.

### Drawer

- Width: `min(360px, calc(100vw - 32px))`.
- Overlay the right edge of the canvas with no changes to `panelStore` or `RightPanel`.
- Sort cards by canvas `y`, then `x`, preserving the user's spatial reading order.
- Each card shows cluster label/similarity, title, sanitized preview content, tags, and a compact density/connection summary.
- Apply top and bottom CSS masks so cards fade near the drawer boundaries.
- Hovering a preview card emphasizes only its connector.
- Clicking a preview card clears pin and calls `fitView` for its source node with `duration: 350`, `padding: 0.35`, and `maxZoom: 1.15`.
- The drawer uses `aside`, an accessible label, keyboard-focusable preview buttons, and visible focus states.

### Connectors

- Render connectors in one full-canvas SVG with `pointer-events: none`.
- Source is the projected center of the card's density field.
- Path shape is `source → diagonal bend → horizontal segment → drawer card`.
- Recompute endpoints on viewport change, drawer scroll, resize, and card-list layout changes.
- Multiply connector opacity by the same top/bottom fade factor used for drawer cards.

## File map

### Create

- `src/components/canvas/densityOverview/densityOverviewModel.ts` — pure scoring, grouping, projection, grid, and hit-test logic.
- `src/components/canvas/densityOverview/densityOverviewRenderer.ts` — Canvas 2D renderer and theme palette mapping.
- `src/components/canvas/densityOverview/DensityOverviewLayer.tsx` — React Flow/store integration, RAF scheduling, and interaction state.
- `src/components/canvas/densityOverview/DensityOverviewDrawer.tsx` — drawer, preview cards, connector SVG, scroll/fade behavior.
- `src/components/canvas/densityOverview/density-overview.css` — overview transition, pointer gating, drawer, masks, connectors, and reduced-motion rules.
- `src/components/canvas/densityOverview/densityOverviewModel.test.ts` — pure-model unit coverage.
- `src/components/canvas/densityOverview/DensityOverviewDrawer.test.tsx` — drawer behavior and accessibility coverage.
- `tests/e2e/canvas-density-overview.spec.ts` — real zoom, hover/pin, focus, dismissal, and theme behavior.

### Modify

- `src/components/canvas/ReactFlowCanvas.tsx` — mount the overview layer, expose live overview progress, gate normal interactions, and provide the source-card focus callback.
- `tests/e2e/canvas-performance.spec.ts` — extend large-board verification to include the distant-view transition and adaptive grid.

Do not modify `RightPanel`, `panelStore`, board persistence, node schemas, or embedding IPC contracts.

## Implementation sequence

### 1. Establish safety and baseline

Before editing `ReactFlowCanvas`, run the required GitNexus analysis:

```text
impact({ target: "ReactFlowCanvas", direction: "upstream", repo: "base", includeTests: true })
```

Report direct callers, affected processes/modules, and risk. If risk is HIGH or CRITICAL, stop and warn before editing.

Run:

```powershell
pnpm typecheck
pnpm test:unit
pnpm playwright test tests/e2e/canvas-performance.spec.ts
```

Expected: all three pass before feature changes. Record any pre-existing failures instead of attributing them to this work.

### 2. Build the pure overview model with TDD

Add failing tests covering:

- Zoom progress is `0` above `0.56`, `1` below `0.46`, and monotonic between them.
- More text/media/blocks increases density.
- Higher edge degree increases density without exceeding `1`.
- Very large cards are logarithmically capped.
- Embedding groups are intersected with current-board IDs only.
- Embedding orphans remain ungrouped.
- Fallback grouping joins explicit edges and shared tags only when embedding groups are unavailable.
- Projection preserves React Flow node centers under translation and zoom.
- Grid spacing remains `18px` at 1,000 cards and increases/caps for larger boards.
- Hit testing selects the strongest grouped field and ignores weak/ungrouped background.

Run the new unit file and verify failure, implement `densityOverviewModel.ts`, then rerun until green.

### 3. Implement the Canvas renderer

Add renderer tests around deterministic grid buffers rather than pixel snapshots. Verify:

- Base dots remain low luminance.
- Radial intensity is strongest at the center and decreases toward the boundary.
- Only the active cluster receives color.
- Light/dark themes change neutral tones without changing group identity.
- Overlapping fields cap intensity and select a deterministic dominant group.

Implement typed-array grid accumulation and one-pass drawing. Keep all drawing inputs explicit so the renderer can be profiled without mounting React.

### 4. Integrate the live React Flow layer

Add `DensityOverviewLayer` as a child of `ReactFlow` so it can read the immediate internal transform rather than the existing 100 ms throttled library-store transform.

In `ReactFlowCanvas`:

- Derive overview progress from the live zoom.
- Set `data-density-overview` and `--density-overview-progress` on the canvas root.
- Fade normal nodes, edges, background, alignment controls, and transient connection UI using the CSS variable.
- When overview progress reaches the interaction threshold, disable node dragging, selection, lasso, connection creation, pane-edit actions, and editing activation while leaving pan/zoom enabled.
- Pass `nodes`, `visibleEdges`, and a `focusCard(nodeId)` callback to the layer.
- Preserve current behavior exactly when progress is `0`.

Add reduced-motion behavior: keep the opacity transition short or immediate, but never disable zoom/pan functionality.

### 5. Add hover, pin, drawer, and connectors

Implement a single interaction state machine:

```text
inactive → transitioning → overview-idle → hover-preview → pinned
```

Transitions must explicitly cover viewport movement, pointer leave, blank click, `Escape`, drawer scroll, preview-card click, and zooming back above the threshold.

Add component tests for:

- Hover preview is not scroll-interactive.
- Click pins and enables scroll.
- Blank click, `Escape`, and zoom change dismiss.
- Drawer includes only current-board cards in the active cluster.
- Cards are ordered by canvas position.
- Preview click invokes the focus callback with the correct node.
- Connector opacity approaches zero at top/bottom fade boundaries.
- Existing right-panel store actions are never called.

### 6. Add end-to-end behavior coverage

Create a deterministic board fixture with at least two spatially separated groups, one high-density hub, and one orphan.

Verify:

- Zooming below `0.56` reveals the density canvas without a mode switch.
- At full overview, normal cards cannot be dragged or edited.
- Panning and wheel zoom still work.
- Hovering one group colors all of its separated fields and no other group.
- Clicking pins the correct drawer cards and renders one connector per visible card.
- Scrolling the drawer fades both cards and matching connectors.
- Clicking a preview returns to near view and focuses the source card.
- `Escape`, blank click, and zoom gesture close the drawer.
- Orphan fields remain visible but do not open a drawer.
- Light and dark themes both keep the inactive overview grayscale.

### 7. Extend performance coverage

For both 1,000 and 5,000 seeded cards:

- Enter and leave the distant view.
- Pan while the distant view is active.
- Assert no uncaught console errors.
- Assert the overlay canvas remains mounted and has a non-zero backing size.
- Record render duration and chosen grid spacing through test-only data attributes.
- Require the 1,000-card overview redraw to stay below `100 ms` in CI.
- For 5,000 cards, require adaptive spacing above `18px` and continued interaction without timeout; do not require fixed visual resolution.

### 8. Final verification and scope audit

Run targeted checks first:

```powershell
pnpm vitest run src/components/canvas/densityOverview/densityOverviewModel.test.ts src/components/canvas/densityOverview/DensityOverviewDrawer.test.tsx
pnpm playwright test tests/e2e/canvas-density-overview.spec.ts tests/e2e/canvas-performance.spec.ts
pnpm typecheck
pnpm lint
pnpm build
node scripts/check-bundle-budget.mjs
```

Then run the full unit suite:

```powershell
pnpm test:unit
```

Before any commit, run:

```text
detect_changes({ scope: "all", repo: "base" })
```

Confirm only the expected canvas overview symbols and flows are affected. Preserve the user's existing unrelated dirty files and stage only the files listed in this plan.

## Acceptance criteria

- Zoom alone controls the transition; no toolbar toggle or persisted mode is added.
- Card field centers stay spatially aligned while zooming and panning.
- Density visibly increases with both content richness and graph centrality.
- The active semantic cluster colors synchronously across separated board positions.
- The drawer contains only active-board cards and does not disturb the existing right panel.
- Drawer cards and elbow connectors fade together at the vertical boundaries.
- Preview click returns to the source card in near view.
- Ungrouped cards remain visible without pretending to be semantic clusters.
- Normal canvas behavior is unchanged above zoom `0.56`.
- Targeted unit/E2E checks, typecheck, lint, build, bundle budget, and full unit suite pass.
- GitNexus impact is reviewed before symbol edits and `detect_changes` is reviewed before commit.

## Explicit non-goals

- No new topography/terrain view.
- No cross-board or full-library cluster drawer.
- No manual cluster editing, naming, or recoloring.
- No persistence of pinned groups or overview UI state.
- No modification of embeddings, clustering algorithms, or model-download UX.
- No replacement of the current React Flow canvas.
