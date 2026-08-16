# Scalable Canvas Media Pipeline Implementation Plan

## Goal

Allow one board to contain large numbers of high-resolution images and local videos without embedding media bytes in board JSON, decoding full-resolution files unnecessarily, or keeping inactive video players mounted. Preserve original files for full-quality viewing, copying, and export while using viewport-aware derived assets for normal canvas rendering.

This plan extends the existing React Flow canvas. It does not replace the canvas engine.

## Current-state findings

- `ReactFlowCanvas` already enables `onlyRenderVisibleElements`; basic offscreen node culling exists.
- Canvas paste and drop currently convert every image to a data URL and store it directly in `MediaNodeData`.
- `serializeBoardData` copies `node.data` into the board snapshot, so canvas image bytes enter board JSON and participate in change detection, persistence, and reload.
- Card-editor images larger than 128 KB use the workspace `media/` directory, but canvas media bypasses that pipeline.
- The delayed inline-image migration scans card content only; it does not migrate media nodes in board snapshots.
- `MediaNode` preloads each image through `new Image()` to discover natural size, then renders another `<img>` using the same original URL.
- `MediaNodeData` declares `image`, `video`, and `embed`, but the component only completes its loading path for images.
- The `hepta-media` protocol reads the entire file into a `Buffer` and only declares image MIME types. It does not implement byte ranges required for reliable video seeking.
- The clipper path downsizes many remote images to 1200 px, while direct paste preserves full data URLs. Storage and quality behavior are inconsistent.
- Workspace backup already includes `media/`, but there is no reference-aware media garbage collection.

## Locked product and architecture decisions

- Keep React Flow and the existing node, frame, edge, selection, project, and board-persistence systems.
- Store every newly imported image or video as a workspace media asset; never write new media data URLs into card or board JSON.
- Preserve the original file byte-for-byte. Canvas thumbnails are derived cache artifacts, not replacements for originals.
- Use content hashes as asset identities so duplicate imports reuse one original and one set of variants.
- Render images at a resolution derived from their on-screen size, current zoom, and device pixel ratio.
- Render videos as posters by default. Mount a real `<video>` only when the user starts playback.
- Support local MP4 and WebM in the first release. Do not add transcoding or bundle FFmpeg in this phase.
- Keep legacy `data:`, remote HTTP(S), and current `hepta-media` URLs readable during migration.
- Run migration only after creating a safety backup. Migration must be resumable and idempotent.
- Treat media deletion conservatively: orphaned files enter a recoverable quarantine before permanent removal.
- Keep originals available for copy, open-original, export, and high-zoom inspection regardless of the current display variant.

## Target asset model

Create a versioned media index at `media/index.json` and store files below the same workspace media root:

```text
media/
  index.json
  originals/<asset-id>.<ext>
  variants/<asset-id>/w512.webp
  variants/<asset-id>/w1024.webp
  variants/<asset-id>/w2048.webp
  posters/<asset-id>.webp
  quarantine/<timestamp>/<relative-original-path>
```

`asset-id` is a lowercase SHA-256 digest of the original bytes. The index record is intentionally independent of boards and cards:

```ts
interface MediaAssetRecord {
  id: string
  kind: 'image' | 'video'
  mimeType: string
  originalName: string
  originalPath: string
  byteSize: number
  width: number
  height: number
  durationMs?: number
  createdAt: number
  variants?: Array<{
    key: 'w512' | 'w1024' | 'w2048'
    path: string
    width: number
    height: number
    byteSize: number
    mimeType: 'image/webp'
  }>
  posterPath?: string
}
```

Canvas nodes store references and presentation state only:

```ts
interface MediaNodeData {
  assetId?: string
  type: 'image' | 'video' | 'embed'
  name?: string
  width?: number
  height?: number
  url?: string // legacy compatibility only
}
```

New card image blocks continue to expose a URL-shaped value to BlockNote, but the URL resolves to the asset ID rather than containing media bytes. The media index is the authoritative source for MIME type, dimensions, variants, and original path.

## URL and protocol contract

Use an opaque asset URL that does not expose arbitrary filesystem paths:

```text
hepta-media://asset/<asset-id>?variant=w1024
hepta-media://asset/<asset-id>?variant=poster
hepta-media://asset/<asset-id>?variant=original
```

- The Electron main process validates the asset ID and variant against `media/index.json`.
- Legacy filename/workspace-query URLs remain supported by a separate compatibility branch.
- Register `hepta-media` as a privileged standard, secure, stream-capable scheme before `app.whenReady()`.
- Support `GET` and `HEAD`.
- For video and original-file requests, parse `Range` and return `206`, `Content-Range`, `Accept-Ranges`, `Content-Length`, and the correct MIME type.
- Stream file ranges with `createReadStream`; do not call `readFile` for media responses.
- Reject traversal, unknown asset IDs, unsupported variants, malformed ranges, and files outside the active/authorized workspace.

## Implementation sequence

### Phase 0: Establish baselines and safety fixtures

**Create:**

- `tests/fixtures/media/` with small deterministic PNG, JPEG, WebP, MP4, and WebM fixtures.
- `tests/e2e/canvas-media-performance.spec.ts` with a test-only board/media seeding entry point.

**Modify:**

- `src/utils/api.ts` for non-production media-board seeding only.
- Existing Electron security tests to cover the new protocol contract.

**Tasks:**

- [ ] Record current board JSON size after pasting 1, 10, and 100 representative images.
- [ ] Record current mounted media-node count while most nodes are offscreen.
- [ ] Record current image load latency and renderer/main-process memory for a representative 4K image board.
- [ ] Add failing tests proving canvas paste currently persists a data URL and video URLs do not complete loading.
- [ ] Add a failing protocol test proving a range request cannot currently seek through a local MP4.
- [ ] Run `pnpm typecheck`, focused unit tests, `tests/e2e/media-paste.spec.ts`, `tests/e2e/canvas-performance.spec.ts`, and the new media baseline before implementation.
- [ ] Document pre-existing failures separately; do not repair unrelated dirty-worktree changes as part of this project.

### Phase 1: Build the media asset domain

**Create:**

- `src/media/mediaAssetTypes.ts`
- `src/media/mediaAssetUrl.ts`
- `src/media/mediaAssetUrl.test.ts`
- `electron/media/mediaIndex.ts`
- `electron/media/mediaIndex.test.ts`
- `electron/media/importMedia.ts`
- `electron/media/importMedia.test.ts`
- `electron/media/mediaPaths.ts`
- `electron/media/mediaPaths.test.ts`

**Modify:**

- `electron/preload.ts`
- `src/types/electron-api.d.ts`
- `src/platform/electronCapabilities.ts`
- `src/platform/electronCapabilities.test.ts`

**Tasks:**

- [ ] Define versioned `MediaAssetRecord`, import result, variant, migration, and error contracts.
- [ ] Add strict path and asset-ID validation before any file operation.
- [ ] Import local disk-backed files by path where Electron exposes a safe file path; use bounded binary chunks for clipboard/blob fallbacks instead of base64.
- [ ] Hash originals incrementally, deduplicate by SHA-256, copy through a temporary file, fsync/close, then atomically rename into `originals/`.
- [ ] Update `media/index.json` atomically through write-temp-and-rename; recover from a stale temp file without discarding the last valid index.
- [ ] Return asset metadata and an opaque asset URL to the renderer.
- [ ] Limit imports and derived-image work to a small bounded queue so dropping many files does not block the renderer or saturate disk/CPU.
- [ ] Add cancellation and stage-specific errors: validation, hashing, copy, metadata, index write, and variant generation.
- [ ] Preserve the existing media APIs until all call sites and legacy data are migrated.

**Phase gate:** importing the same image twice produces one original asset and two usable references; no base64 string crosses into the returned node/card data.

### Phase 2: Unify canvas and card import paths

**Modify:**

- `src/media/imagePipeline.ts`
- `src/media/mediaStore.ts`
- `src/hooks/useCanvasPaste.ts`
- `src/hooks/useDropHandler.ts`
- `src/components/editor/BlockNoteEditor.tsx`
- `src/components/editor/ImageRowBlock.tsx`
- `src/types/card.ts`
- Focused media-paste and editor tests.

**Tasks:**

- [ ] Replace `fileToDataUrl` use in canvas paste/drop with the media import capability.
- [ ] Route BlockNote upload, image rows, canvas paste, and canvas drop through the same asset importer.
- [ ] Insert a temporary local preview while import is in progress, then replace it with the persistent asset reference without changing node position or selection.
- [ ] Preserve multi-file drop order and current staggered placement.
- [ ] Store dimensions returned by the importer so node sizing never requires a second full-image preload.
- [ ] Report per-file failures without discarding successful files from the same drop.
- [ ] Ensure undo removes the node/card reference but does not synchronously delete a potentially shared asset.
- [ ] Reject unsupported video/image formats with a clear toast and no partial node.

**Phase gate:** every new image imported through canvas or card UI is represented by an asset ID, and `serializeBoardData` contains no new `data:image/...` payload.

### Phase 3: Migrate existing inline media safely

**Create:**

- `src/media/migrateWorkspaceMedia.ts`
- `src/media/migrateWorkspaceMedia.test.ts`
- A migration journal type/file under the workspace metadata area.

**Modify:**

- `src/hooks/useWorkspaceDataLoader.ts`
- `src/sync/boardSnapshot.ts` only if normalization is required at the serialization boundary.
- Backup summary/UI to report migration safety-backup failures.

**Tasks:**

- [ ] Scan card BlockNote JSON and every board snapshot for `data:image/...` values.
- [ ] Include canvas `media` nodes; do not repeat the current card-only migration gap.
- [ ] Create a filesystem safety backup before the first mutation.
- [ ] Import assets sequentially or with low concurrency, update references only after each asset is durable, and persist journal progress after each card/board.
- [ ] Make reruns safe after interruption, crash, duplicate files, or a partially completed previous migration.
- [ ] Preserve legacy URLs when import fails and surface a non-destructive migration report.
- [ ] Keep remote HTTP(S) URLs unchanged in this phase.
- [ ] Remove the old delayed card-only migration after the workspace migration has equivalent test coverage.
- [ ] Do not delete legacy flat media files during migration.

**Phase gate:** reopening a migrated workspace produces the same visible cards/boards, no successfully migrated data URLs remain, and restoring the safety backup returns the exact pre-migration workspace.

### Phase 4: Generate and resolve image LOD variants

**Create:**

- `electron/media/generateImageVariants.ts`
- `electron/media/generateImageVariants.test.ts`
- `src/media/selectMediaVariant.ts`
- `src/media/selectMediaVariant.test.ts`
- `src/hooks/useResolvedMediaAsset.ts`

**Modify:**

- `src/components/canvas/MediaNode.tsx`
- `src/components/editor/ImageRowBlock.tsx`
- `src/media/resolveMediaUrl.ts`

**Tasks:**

- [ ] Generate 512, 1024, and 2048 px WebP variants with `sharp`, never enlarging the original.
- [ ] Preserve alpha and orientation; retain the original format and bytes separately.
- [ ] Calculate target pixels from rendered node width × effective zoom × DPR.
- [ ] Select the smallest variant meeting target pixels; use the original only when no variant is sufficient or the operation explicitly requests full quality.
- [ ] Add hysteresis and a short settle delay so wheel zoom does not thrash between adjacent variants.
- [ ] Keep the previous image visible while the next variant loads, then swap after decode.
- [ ] Remove the `new Image()` natural-size preload from `MediaNode`; use indexed dimensions.
- [ ] Keep `loading="lazy"`, `decoding="async"`, low fetch priority, and React Flow visibility culling.
- [ ] Copy/open/export actions must resolve `variant=original`.
- [ ] If variant generation fails, render the original and record a repairable asset state rather than breaking the node.

**Phase gate:** a 4000 px original displayed at roughly 400 CSS pixels does not request or decode the original during normal canvas viewing, while copy/export returns the original-quality file.

### Phase 5: Add poster-first local video nodes

**Create:**

- `electron/media/mediaProtocol.ts`
- `electron/media/mediaProtocol.test.ts`
- `src/components/canvas/VideoMedia.tsx`
- `src/components/canvas/VideoMedia.test.tsx`
- `src/stores/mediaPlaybackStore.ts`
- `src/stores/mediaPlaybackStore.test.ts`

**Modify:**

- `electron/main.ts`
- `src/components/canvas/MediaNode.tsx`
- `src/hooks/useCanvasPaste.ts`
- `src/hooks/useDropHandler.ts`
- `src/types/card.ts`

**Tasks:**

- [ ] Register the privileged scheme before Electron readiness and move protocol logic out of `electron/main.ts`.
- [ ] Implement standards-correct `GET`, `HEAD`, and single-range `206` responses using streams.
- [ ] Return correct MP4/WebM MIME, range, length, cache, and error headers.
- [ ] Extract width, height, duration, and a representative poster after import. Use browser media decoding for the first release; if poster capture fails, retain a deterministic placeholder and keep playback available.
- [ ] Display only the poster until the user presses play.
- [ ] Keep at most one actively playing canvas video by default; starting another pauses the previous one.
- [ ] Pause on board switch, node deletion, app backgrounding, and visibility loss.
- [ ] Unmount the `<video>` after playback stops and the node leaves the viewport; retain current time only for the active session, not in board persistence.
- [ ] Preserve aspect ratio during resize and provide accessible play/pause controls.
- [ ] Test initial playback, seeking, end-of-file ranges, malformed ranges, board switching, and offscreen unmounting.
- [ ] Do not transcode codecs in this release; unsupported codec errors must be explicit.

**Phase gate:** a local MP4 can start, seek, pause, leave the viewport, return, and reopen after app restart without reading the entire file into the Electron main-process heap.

### Phase 6: Reference tracking, backup, and conservative cleanup

**Create:**

- `electron/media/collectMediaReferences.ts`
- `electron/media/collectMediaReferences.test.ts`
- `electron/media/mediaGarbageCollection.ts`
- `electron/media/mediaGarbageCollection.test.ts`

**Modify:**

- `electron/backupService.ts`
- `electron/backupService.test.ts`
- `src/stores/backupStore.ts`
- Backup settings UI only where status/warnings are required.

**Tasks:**

- [ ] Extend backup copy/validation from the current flat `media/` assumption to the versioned recursive media layout.
- [ ] Include `index.json`, originals, variants, and posters; exclude temporary import files and quarantine unless explicitly creating a full recovery backup.
- [ ] Validate that every referenced asset has a valid index record and original file.
- [ ] Scan boards, cards, trash, and migration journals before declaring an asset orphaned.
- [ ] Move orphans into timestamped quarantine; never permanently delete them in the same run that first detects them.
- [ ] Permanently delete only expired quarantine entries after a successful newer backup and a second reference scan.
- [ ] Provide repair behavior for missing derived variants and warnings for missing originals.
- [ ] Verify restore remains transactional and legacy backups without the new media index remain importable.

**Phase gate:** shared assets survive deletion of one reference, orphan candidates are recoverable, and backup/restore preserves playable videos and original-quality images.

### Phase 7: Performance hardening and release gate

**Modify:**

- `tests/e2e/canvas-media-performance.spec.ts`
- `tests/e2e/canvas-performance.spec.ts`
- Bundle/native packaging checks if the media worker changes packaged dependencies.

**Automated scenarios:**

- [ ] 1,000 media-node metadata records with most nodes offscreen.
- [ ] At least 50 distinct high-resolution image files visible across repeated pan/zoom paths.
- [ ] 100 video nodes represented by posters with zero players before interaction and one player during playback.
- [ ] Repeated board switch/reload with no data URL reintroduced into board snapshots.
- [ ] Duplicate import, interrupted migration, missing variant repair, missing original warning, backup, and restore.
- [ ] Protocol traversal, unauthorized workspace, unsupported type, malformed range, and oversized import rejection.

**Release thresholds:**

- Board JSON containing 1,000 media nodes stays below 3 MB and contains no media base64 payloads.
- Offscreen media nodes do not keep image or video elements mounted beyond React Flow's visible set plus intentional interaction exceptions.
- Normal canvas view never mounts more than one playing video.
- A variant request is no smaller than the required screen-pixel target and no larger than the next available tier.
- No full-file `readFile` remains on the video-serving path.
- Existing card, frame, connection, selection, resize, copy, board-switch, backup, and restore tests remain green.
- Production packaging successfully loads `sharp` and plays fixture media in the packaged Electron app.
- Manual Windows profiling records renderer memory, main-process memory, dropped frames, and time-to-first-visible-media for the agreed stress board; do not claim capacity without this measurement.

## Recommended commit boundaries

1. `test: add scalable media baselines`
2. `feat: add workspace media asset domain`
3. `refactor: unify card and canvas media imports`
4. `feat: migrate inline workspace media`
5. `perf: add zoom-aware image variants`
6. `feat: add streamed local video nodes`
7. `feat: add media backup and garbage collection`
8. `test: verify large media boards and packaged runtime`

Each commit must remain independently type-safe and keep legacy media readable. Do not combine unrelated current worktree changes into these commits.

## Verification commands

Run focused checks after each phase, then the full gate before release:

```powershell
pnpm vitest run src/media electron/media
pnpm playwright test tests/e2e/media-paste.spec.ts tests/e2e/canvas-media-performance.spec.ts tests/e2e/canvas-performance.spec.ts
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm build
pnpm electron:build
node scripts/check-bundle-budget.mjs
git diff --check
```

Run the packaged smoke test separately after `pnpm electron:pack`; a successful web build does not prove native `sharp`, custom protocol streaming, or video playback works in the packaged runtime.

## Rollout and rollback

- Introduce the new importer behind a workspace media feature flag until import, reload, and backup tests pass.
- Enable new imports before automatic migration; this stops further data-URL growth while leaving old workspaces readable.
- Offer migration after a successful safety backup, with progress and a resumable journal.
- Keep legacy URL parsing and flat-file protocol resolution for at least one full release after migration ships.
- If image LOD causes visual regressions, switch resolution to `original` without reverting the asset migration.
- If video streaming is unstable in packaged Electron, keep poster nodes and disable playback while preserving imported originals.
- Rollback must never require rewriting migrated files back into base64. Restore the safety backup only when the user explicitly chooses full workspace rollback.

## Acceptance criteria

- New canvas/card image imports and supported videos are durable workspace assets, not JSON-embedded bytes.
- Existing inline images migrate without visual, positional, sizing, or backup loss.
- Original images remain available at full quality.
- Normal canvas rendering uses an appropriate lower-resolution variant when possible.
- Video nodes are poster-first, seekable, and streamed with bounded main-process memory.
- Large offscreen media collections do not create proportional DOM media elements.
- Duplicate assets do not duplicate originals or variants.
- Deleting one of several references does not delete the shared asset.
- Backups and restores include the complete versioned media asset set.
- Stress results are measured in the packaged Windows app before the feature is described as supporting large media boards.

## Explicit non-goals

- No replacement of React Flow with tldraw, Excalidraw, PixiJS, or another canvas engine.
- No cloud object storage, collaboration upload service, CDN, or cross-device asset synchronization.
- No video transcoding, adaptive bitrate streaming, timeline editing, audio waveform, or subtitle system.
- No arbitrary web embeds in the media asset pipeline.
- No removal of legacy media compatibility in the first release.
- No permanent deletion of newly detected orphan assets without quarantine and a newer verified backup.
