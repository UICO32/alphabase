# Card Library Relevance Control and Progressive Loading Design

**Date:** 2026-07-16

**Status:** User-approved design

## Purpose

Improve the card-library interaction in two focused ways:

1. Promote relevance sorting from an item inside the sort menu to a directly selectable control beside the existing sort and tag-filter controls.
2. Replace the blank initial card-library loading state with a progressive skeleton-to-content transition.

The change preserves the existing card list, search, tag filtering, and relevance computation. It does not introduce a separate related-cards view or a new right-panel top-level tab.

## Confirmed Product Decisions

- The relevance control belongs inside the card library.
- It is visually and behaviorally parallel to the existing sort and tag-filter controls.
- It is not a right-panel tab and does not create a second card-list mode.
- The relevance item is removed from the ordinary sort dropdown.
- Selecting relevance reuses the current search, filtering, scoring, and card rendering pipeline.
- Relevance uses the currently selected or edited card as its reference card.
- Progressive loading runs only on the first card-library load while its code or initial content is not ready.
- Search, tag, ordinary-sort, and relevance changes update the list directly and do not replay the full skeleton sequence.

## 1. Relevance as a Peer Control

### 1.1 Placement and visual hierarchy

The compact card-library toolbar keeps its existing controls and adds a standalone relevance control at the same hierarchy as sort and tag filtering:

```text
[ ordinary sort ] [ tag filter ] [ relevance ]
```

The exact wrapping or compact spacing follows the current narrow right-panel behavior. The new control uses the same height, radius, typography, icon scale, hover treatment, focus treatment, and disabled treatment as its neighboring toolbar controls.

This control is selectable rather than menu-opening. Its selected state must remain visually apparent without relying on color alone.

### 1.2 State behavior

The existing `sortBy: 'related'` state remains the single source of truth for relevance mode. No parallel Boolean state is introduced.

- Clicking the relevance control sets `sortBy` to `related`.
- Choosing an ordinary sort option sets `sortBy` to that option and clears the relevance control's selected state naturally.
- Clicking an already selected relevance control is idempotent; it does not clear the card list or fall back to an arbitrary sort.
- The ordinary sort control continues to expose only `updatedAt`, `createdAt`, and `title`.
- The ordinary sort control may continue showing the last selected ordinary-sort label while relevance is active, but it must not appear selected. Choosing any ordinary sort exits relevance mode.

This preserves the current data pipeline: search text and tag filters narrow the same card collection, then relevance scores determine the ordering of eligible cards.

### 1.3 Reference-card and index states

Relevance requires both a current reference card and a ready embedding index.

- When no card is selected or edited, the relevance control is disabled and exposes a concise explanation such as “请先选择一张卡片”.
- While the embedding index is unavailable or still preparing, the control is disabled and exposes an indexing explanation.
- When the reference card changes while relevance is selected, the existing related-search operation reruns for the new card.
- If relevance was requested before indexing completed, the existing pending-selection behavior may activate it once both the index and reference card are available.
- Relevance-search failures retain a stable card-library surface and must not leave the toolbar in a misleading busy state.

## 2. Progressive Card-Library Loading

### 2.1 Trigger boundary

The progressive sequence is limited to the initial card-library entry when either of these layers is not ready:

- the lazily loaded card-library component bundle;
- the card collection's initial load or hydration state, when that state is available to the renderer.

The sequence does not replay for:

- ordinary sort changes;
- relevance selection;
- tag-filter changes;
- search input or search-mode changes;
- returning to a previously mounted card library whose initial data is already ready.

### 2.2 Skeleton presentation

The right panel displays a lightweight card-library shell instead of a blank Suspense fallback. The shell includes:

- a compact toolbar skeleton aligned with the real controls;
- several card skeletons matching the approximate width, radius, padding, and vertical rhythm of real library cards;
- varied but deterministic text-line lengths so the placeholders resemble the content structure without causing visual noise;
- a restrained shimmer or opacity pulse that respects the application's theme tokens.

Skeleton geometry should be stable enough that the real content does not cause a large layout jump.

### 2.3 Content reveal

When content becomes ready:

1. The skeleton softens and fades out over a short duration.
2. Real cards fade in with a small upward translation.
3. Visible cards use a capped stagger so large libraries do not produce long-running animation queues.
4. The toolbar appears with the content surface rather than arriving substantially earlier or later.

The animation is decorative, not a delay mechanism. If data is already ready, content should render promptly; the implementation must not impose an artificial minimum loading time solely to show the skeleton.

### 2.4 Motion accessibility and performance

- Under `prefers-reduced-motion: reduce`, remove shimmer, translation, and stagger; use an immediate or minimal-opacity transition.
- Animate opacity and transform only; avoid layout-affecting properties.
- Limit animated items to the initially visible or first capped group of cards.
- Do not remount card editors, regenerate previews, or restart embedding work solely to drive the animation.

## Architecture and Component Boundaries

The implementation should keep the responsibilities focused:

- `RightPanel` owns the lazy-loading boundary and renders a card-library-specific skeleton fallback instead of `null`.
- `CardLibraryView` owns toolbar composition and continues to own the shared search/filter/sort pipeline.
- A small relevance-control component or focused toolbar fragment renders selection, disabled state, tooltip, and activation behavior.
- A small card-library skeleton component owns placeholder geometry and contains no data-loading logic.
- Styling uses existing theme tokens and shared control classes where possible; new animation classes remain scoped to the card library.

Do not create a `RelatedCardsView`, duplicate card-list filtering, or add a separate relevance store.

## Error and Empty States

- No reference card: relevance is disabled with an explanatory label or tooltip; the ordinary card list remains visible.
- Index not ready: relevance is disabled with an indexing explanation; existing cards remain visible.
- Related search returns no scored cards: use the existing list behavior or a focused empty result message without replacing the entire card library navigation.
- Initial data load fails: stop the animated skeleton and expose the project's existing error or empty-state path rather than leaving permanent placeholders.
- Malformed card preview content continues to use the existing safe preview fallback.

## Testing Strategy

### Relevance control

- The ordinary sort menu contains recent modification, creation time, and title, but not relevance.
- The relevance control is rendered beside the ordinary sort and tag-filter controls.
- Activating relevance sets `sortBy` to `related` and shows the selected state.
- Choosing an ordinary sort after relevance exits relevance mode.
- Existing search text and tag filtering still constrain the relevance-sorted card set.
- The control is disabled without a reference card.
- The control is disabled while the embedding index is unavailable.
- Changing the reference card reruns related search without creating a second list implementation.

### Progressive loading

- The lazy card-library boundary renders a skeleton rather than a blank panel.
- Skeleton structure approximates the real toolbar and card geometry.
- Initial real cards receive the capped reveal treatment when the library first becomes ready.
- Sort, tag, search, and relevance changes do not remount the full skeleton.
- Reduced-motion mode suppresses shimmer, translation, and stagger.
- Animation styles use opacity and transform rather than layout properties.

## Acceptance Criteria

- Users can activate relevance directly from a control beside ordinary sort and tag filtering.
- Relevance no longer appears inside the ordinary sort menu.
- The same card list, search, tag filtering, preview, drag, and edit behaviors continue to work while relevance is selected.
- Relevance clearly communicates why it is unavailable when there is no reference card or index.
- Opening the card library for the first time no longer shows an unexplained blank surface while its bundle or initial data is loading.
- The transition from skeletons to real cards is restrained, performant, theme-compatible, and reduced-motion safe.
- Subsequent search, filter, and sorting interactions remain immediate and do not replay the initial loading sequence.

## Out of Scope

- A new right-panel top-level tab.
- A nested “all cards / related cards” view switch.
- A separate related-card search, filter, or sort pipeline.
- Changes to the relevance algorithm or embedding model.
- Infinite scrolling, pagination, or virtualized card rendering.
- A broad redesign of the card library or right panel.
