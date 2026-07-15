# Backup, Panel, Card Preview, and Editor Fixes Design

**Date:** 2026-07-15

**Status:** User-approved design

## Purpose

Resolve the reported reliability and interaction problems in settings data transfer, the left board menu, the right panel, card-library previews, and card text editing. The work is delivered as one coordinated reliability initiative with four independently testable implementation phases.

## Confirmed Product Decisions

- Import, export, automatic backup, and recent-backup recovery use one folder-based backup format.
- A complete backup contains cards, boards, trash, media, and workspace metadata.
- Import replaces the current workspace after first creating a safety backup.
- Export writes to a fixed default location and does not ask the user to choose a destination.
- The recent-backup list supports restore and export actions.
- Board context-menu icons remain, but use normalized Lucide icons and the same styling as the board overflow menu.
- Right-panel content and background resize together in real time.
- Channel refresh is manual, bypasses the cache, and refreshes only the current view.
- Channel controls remain horizontal and scroll when space is insufficient.
- Card-library titles appear only when content contains an explicit title block.
- An empty or whitespace-only editor block makes the first Command/Ctrl+A select the whole card.
- Text selection uses an adaptive light-blue theme color.

## Scope and Delivery Boundaries

The initiative contains four phases:

1. Unified backup management.
2. Left and right panel interaction fixes.
3. Card-library preview semantics.
4. Card editor selection behavior and selection color.

Each phase must be independently testable and suitable for a coherent commit. Unrelated refactoring, new backup destinations, backup cloud sync, backup merging, and archive compression are outside scope.

## 1. Unified Backup Management

### 1.1 Backup folder format

New automatic and exported backups use this structure:

```text
<timestamp>/
├── backup-manifest.json
├── _metadata.json
├── cards/
├── boards/
├── trash/
└── media/
```

`backup-manifest.json` is the format contract. It contains:

- format version;
- creation timestamp;
- application identifier;
- card count;
- board count;
- trash-item count;
- media-file count.

The manifest is descriptive and supports validation; the workspace data remains in the existing directories and `_metadata.json`.

### 1.2 Automatic backups

Automatic backups remain under `<workspace>/.backups/<timestamp>/`. Creation copies all five workspace data areas: `cards`, `boards`, `trash`, `media`, and `_metadata.json`. A missing optional directory is represented by an empty directory in a new backup so the format remains predictable.

Retention continues to prune the oldest automatic backups according to the existing limit. Exported backups are outside `.backups` and are never removed by automatic retention.

### 1.3 Export behavior

Export creates a fresh backup from the current workspace; it does not merely copy an arbitrary existing automatic backup.

The default location is the operating system Downloads directory:

```text
<Downloads>/Abase Backups/<timestamp>/
```

The user is not shown a destination picker. A successful export reports the final path and offers an action to open that directory. Repeated exports cannot overwrite an existing backup; timestamp collision handling must choose a unique folder name or return a clear failure.

Because the renderer's workspace file guard intentionally blocks writes outside the active workspace, destination resolution and copying are exposed through a narrowly scoped Electron capability. The renderer requests "export current backup" rather than receiving unrestricted filesystem authority.

### 1.4 External import

Import opens a directory picker because the user must identify the external backup folder. Selecting individual card JSON files is no longer supported.

Before any write, import validates:

- the selected path is a directory;
- the folder has a supported manifest or a recognizable legacy structure;
- required JSON files parse successfully;
- board manifest references are structurally valid;
- manifest counts match the folder contents when a manifest is present;
- paths do not escape the selected backup root;
- filenames accepted for restoration satisfy the existing workspace safety rules.

The confirmation UI shows creation time, format status, card count, board count, trash count, and media count. A validation failure names the missing or invalid part instead of showing a generic format error.

### 1.5 Replacement and recovery safety

After confirmation, import and recent-backup restore follow the same transaction-like workflow:

1. Flush pending workspace writes.
2. Create a complete automatic safety backup of the current workspace.
3. Stage and validate the selected backup.
4. Replace `cards`, `boards`, `trash`, `media`, and `_metadata.json` as one coordinated operation.
5. Audit the result and reload the workspace stores from disk.
6. Report success only after the reloaded data passes consistency checks.

If staging or validation fails, the current workspace is untouched. If replacement fails after mutation begins, the operation reports a recovery-specific error and preserves the safety-backup path for rollback.

### 1.6 Recent backups

The settings page lists recent automatic backups newest first. Each row shows:

- creation date and time;
- card count;
- board count;
- media count when known;
- current-format or legacy status.

Actions are:

- **Restore:** validate, confirm, create a safety backup, replace, and reload.
- **Export:** copy that backup to the fixed Downloads backup directory without a destination picker.

Legacy backups without `backup-manifest.json` remain restorable when their `cards`, `boards`, and `trash` structure is valid. They are labeled as legacy and warn that media and metadata may be incomplete. Restoring a legacy backup does not pretend missing media can be recovered.

## 2. Panel Interaction Fixes

### 2.1 Board context menu

The board right-click menu and its three-dot overflow menu share one menu-item definition and one visual treatment.

- Use the project surface, border, radius, shadow, hover, focus, and destructive-action tokens.
- Remove the anomalous black outline and any native-looking icon treatment.
- Normalize Lucide icon size and alignment.
- Preserve rename, delete, duplicate, and open-in-file-manager behavior.
- Preserve keyboard focus and menu dismissal behavior from the underlying menu primitive.

The right-click and three-dot entry points must not drift into separate visual systems again.

### 2.2 Right-panel resizing

The current width value drives both the visible panel and the workspace chrome aperture. The chrome aperture currently animates its right inset while the panel width changes immediately, producing the observed lag.

During pointer drag:

- mark the application as actively resizing the right panel;
- update the clamped width at most once per animation frame;
- apply that same width to the panel and chrome surface in the same render;
- disable chrome inset transitions and panel transform transitions;
- prevent text selection and use the column-resize cursor.

On pointer release or cancellation:

- commit the final width;
- remove listeners and scheduled frames;
- restore transition behavior, cursor, and user selection;
- retain the existing minimum and maximum width constraints.

### 2.3 Channel controls and refresh

Platform tabs, action tabs such as Hot and Ranking, search, and refresh remain in horizontal control rows. Text uses `white-space: nowrap`; controls do not collapse into vertical glyphs. When the available width is insufficient, the controls use a contained horizontal overflow region rather than wrapping.

A refresh action is visible in the channel header. It bypasses the five-minute in-memory cache for the currently selected platform and action. When the current action is search, it repeats the current non-empty query. Manual refresh retains the existing results while loading and shows an in-place busy state. A failed refresh leaves the previous results visible and presents the error without poisoning the cached success value.

Ordinary tab switching may continue to use the existing cache. Refresh invalidates or replaces only the active cache entry.

## 3. Card-Library Preview Semantics

### 3.1 Explicit-title rule

A card has a displayable preview title only when its structured content contains a non-empty heading block. A populated `card.title` field alone is not sufficient because existing import and conversion paths may derive that field from ordinary body text.

This keeps clipped cards and intentionally titled cards working while preventing a one-sentence paragraph from being promoted into a title.

### 3.2 Preview rendering

- If there is no explicit heading, omit the title element entirely and begin with body content.
- Never render placeholder labels such as "Untitled" or "New card" in the preview.
- If an explicit heading is displayed as the title, remove the corresponding heading block from the body preview.
- Do not remove later headings or body paragraphs that happen to contain the same text; removal is structural, not global string replacement.
- Preserve image extraction, relative time, relatedness score, drag behavior, and sanitization.
- A genuinely empty card may show the existing empty-content affordance, but it must not gain a fake title.

Title derivation and body filtering live in focused preview utilities so canvas previews and library previews can reuse the same semantics where appropriate.

## 4. Card Editor Selection Behavior

### 4.1 Command/Ctrl+A

The editor keeps its two-stage selection model for non-empty text blocks:

1. First Command/Ctrl+A selects the current text block.
2. Second consecutive Command/Ctrl+A selects all text blocks in the card.

For a current block with no visible text, including an empty string, whitespace, or line breaks, the first Command/Ctrl+A selects all text blocks in the card immediately.

The staged-selection state resets after a click or any non-Command/Ctrl+A key. The shortcut behaves consistently for Command on macOS and Ctrl on Windows/Linux. Annotation editors remain outside this card-specific behavior.

### 4.2 Selection color

Editable card text uses a semantic selection-background token:

- light theme: pale blue;
- dark theme: low-saturation translucent light blue;
- selected text remains readable in both themes.

The selector is scoped to the editable card editor. It must not alter read-only previews, Electron webviews, native inputs, or unrelated application surfaces.

## Error Handling

- Backup errors identify the failed stage: selection, validation, safety backup, staging, replacement, reload, or export.
- No success message appears before disk writes and workspace reload complete.
- Export failures include the intended default destination.
- Channel refresh failures retain the prior visible data.
- Resize cleanup runs for pointer-up and pointer-cancel paths.
- Preview parsing fails closed: malformed content produces no title and a safe body fallback.

## Testing Strategy

### Backup tests

- Unit-test manifest construction and validation.
- Unit-test complete copy sets including media and metadata.
- Verify legacy backup recognition and warnings.
- Verify safety backup occurs before replacement.
- Verify invalid external folders never mutate the workspace.
- Verify export uses the default Downloads destination and produces a unique folder.
- Verify recent-backup restore and export share the same validation and copy paths.

### Panel tests

- Verify both board menu entry points render the same actions and normalized classes.
- Verify destructive styling is limited to delete.
- Verify resize state disables transitions, clamps width, updates on animation frames, and cleans up.
- Add an interaction or visual regression check proving the panel and chrome boundary share the same width during drag.
- Verify channel labels do not wrap and overflow horizontally.
- Verify refresh bypasses only the active cache entry and preserves old results during loading or failure.

### Preview tests

- Paragraph-only card: no title, paragraph shown once.
- Empty card: no title placeholder.
- Heading plus paragraph: heading shown once as title, paragraph shown in body.
- Heading-only card: title shown once, no duplicate body.
- Derived `card.title` plus paragraph-only content: no title.
- Malformed content: safe fallback without duplicate or unsafe HTML.

### Editor tests

- Empty, whitespace-only, and line-break-only block: first shortcut selects the card.
- Non-empty block: first shortcut selects the block and second selects the card.
- Click and unrelated key reset staged selection.
- Command and Ctrl modifier variants behave consistently.
- Theme-level CSS tests verify the scoped light-blue selection token.

## Acceptance Criteria

- A user can export a complete backup without choosing a destination and can find its reported path in Downloads.
- A user can select a valid backup folder, see a useful summary, and restore it only after a safety backup is created.
- Recent backups can be restored or exported from settings.
- Restored cards retain local media when the source backup contains media.
- Board right-click and overflow menus share the intended application styling.
- Right-panel content, background, and canvas aperture move together while resizing.
- Channel labels remain horizontal, and manual refresh obtains fresh data for the active view.
- Paragraph-only cards show their body once without a fake title.
- Command/Ctrl+A selects the whole card immediately from an empty block.
- Selected card text uses the approved adaptive pale-blue background.

