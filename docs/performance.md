# Performance Notes

## Goals

- Canvas opens quickly enough that board rendering wins over background work.
- Drag, zoom, selection, and editing remain responsive with hundreds of cards.
- Image-heavy cards do not block the main thread during paste or save.

## Current Hot Paths

- `src/components/canvas/ReactFlowCanvas.tsx`: ReactFlow orchestration, selection, connection, board sync bridge.
- `src/components/canvas/CardNode.tsx`: per-card render, editor activation, resize, frame behavior.
- `src/hooks/useCanvasDrag.ts`: drag snapping, frame entry/exit, kanban layout updates.
- `src/hooks/useBoardSync.ts`: board snapshot persistence bridge.
- `src/utils/fileUtils.ts`: image compression and data URL generation.

## Rules

- Continuous pointer and zoom updates should prefer refs, CSS variables, or external stores with coarse selectors.
- Do not subscribe every card to continuously changing values unless the value changes only at thresholds.
- Board persistence should be operation-driven where possible, not a full snapshot on every transient change.
- Expensive card preview, embedding, backup, and metadata work must run after board readiness.
- Image processing should move toward media files and worker/main-process compression rather than base64 in card JSON.

## Next Architecture Split

- Extract `CanvasPersistenceBridge` from `ReactFlowCanvas`.
- Extract `CanvasSelectionLayer` and `CanvasConnectionLayer`.
- Introduce a board model module with `nodesById`, `edgesById`, and explicit patch operations.
- Introduce a media pipeline that stores image files under workspace media storage.

## Round Two Changes

- Canvas interactions now have a pure spatial index for local candidate lookup.
- Connection proximity and lasso selection should avoid scanning every node on every pointer move.
- Drag snapping should query nearby candidates before running precise snap math.
- Board sync has a dirty boundary that can evolve into patch-based persistence without changing disk snapshots.

## Remaining Work

- Move from conservative dirty checks to explicit board patches per operation.
- Keep a long-lived spatial index updated by node changes instead of rebuilding from all nodes.
- Move image compression and storage out of card JSON into a workspace media pipeline.
- Split `ReactFlowCanvas` into focused layers after hot-path behavior is stable.

## Round Three Media Pipeline

- Large pasted images should be stored under workspace media storage instead of embedded as base64 in card JSON.
- Card content should reference media with `hepta-media://<mediaId>/<fileName>`.
- Existing inline `data:` images remain readable and are migrated during idle time.
- Board readiness must not wait for image migration, embedding, backup, or preview generation.

## Media Rules

- Keep small images inline only as a fallback.
- Do not call `canvas.toDataURL()` in interaction-critical paths when a worker or main-process path is available.
- Prefer object URLs or workspace media URLs for display.
- Keep media writes workspace-scoped through Electron's registered workspace path.
