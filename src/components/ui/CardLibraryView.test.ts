// @vitest-environment jsdom

import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CardLibraryView } from './CardLibraryView'

const cardLibrarySource = readFileSync(`${process.cwd()}/src/components/ui/CardLibraryView.tsx`, 'utf8')

const cardState = {
  cards: {},
  getPreviewHTML: vi.fn(() => ''),
  ensurePreviewHTMLBatch: vi.fn(),
}
const libraryState = {
  sortBy: 'updatedAt',
  setSortBy: vi.fn(),
  searchMode: 'keyword',
  setSearchMode: vi.fn(),
  tagFilter: null,
  setTagFilter: vi.fn(),
}

vi.mock('../../stores/cardStore', () => ({
  useCardStore: Object.assign(
    (selector: (state: typeof cardState) => unknown) => selector(cardState),
    { getState: () => cardState },
  ),
}))
vi.mock('../../stores/boardStore', () => ({
  useBoardStore: (selector: (state: { activeBoardId: null }) => unknown) => selector({ activeBoardId: null }),
}))
vi.mock('../../stores/canvasPresenceStore', () => ({
  useCanvasPresenceStore: (selector: (state: { boardId: null; cardIds: Set<string> }) => unknown) =>
    selector({ boardId: null, cardIds: new Set<string>() }),
}))
vi.mock('../../stores/libraryStore', () => ({
  useLibraryStore: (selector: (state: typeof libraryState) => unknown) => selector(libraryState),
}))
vi.mock('../../stores/viewStore', () => ({
  useViewStore: (selector: (state: { editingCardId: null }) => unknown) => selector({ editingCardId: null }),
}))
vi.mock('../../stores/embeddingStore', () => ({
  useEmbeddingStore: () => ({
    indexed: true,
    searching: false,
    searchScores: {},
    searchRelated: vi.fn(),
    searchByText: vi.fn(),
    clearResults: vi.fn(),
  }),
}))
vi.mock('../../stores/tagStore', () => ({
  useTagStore: (selector: (state: { tags: Record<string, never>; getTagsSortedByUsage: () => unknown[] }) => unknown) =>
    selector({
      tags: {},
      getTagsSortedByUsage: () => [{ name: 'design', count: 1, flomoSynced: false }],
    }),
}))
vi.mock('../../sync/flomoSync', () => ({
  useFlomoSyncStore: (selector: (state: { syncing: boolean; accessToken: string; sync: () => void }) => unknown) =>
    selector({ syncing: false, accessToken: 'token', sync: vi.fn() }),
}))
vi.mock('../../stores/eventBus', () => ({ emit: vi.fn() }))
vi.mock('./CardEditDialog', () => ({ CardEditDialog: () => null }))
vi.mock('./SharedUI', () => ({ EmptyState: () => createElement('div', null, 'empty') }))
vi.mock('./CardLibraryRelevanceButton', () => ({
  CardLibraryRelevanceButton: () => createElement('button', { type: 'button' }, '相关性'),
}))
vi.mock('@floating-ui/react', () => ({
  useFloating: () => ({
    refs: { setReference: vi.fn(), setFloating: vi.fn() },
    context: {},
    floatingStyles: {},
  }),
  useClick: () => ({}),
  useDismiss: () => ({}),
  useInteractions: () => ({ getReferenceProps: () => ({}), getFloatingProps: () => ({}) }),
  offset: vi.fn(),
  flip: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CardLibraryView layout', () => {
  it('clips card scrolling below the header and omits the related-result information row', () => {
    expect(cardLibrarySource).not.toContain('bg-[var(--surface-panel-solid)]')
    expect(cardLibrarySource).not.toContain('按相关性排序 ·')
    expect(cardLibrarySource).toContain("onActivate={sortBy === 'related' ? exitRelatedSort : activateRelatedSort}")

    render(createElement(CardLibraryView, { compact: true }))
    const root = screen.getByTestId('card-library-scroll-root')
    const header = screen.getByTestId('card-library-header')
    expect(header.className).toContain('shrink-0')
    expect(root.className).toContain('min-h-0')
    expect(root.className).toContain('overflow-y-auto')
    expect(root.contains(header)).toBe(false)
    expect(header.nextElementSibling).toBe(root)
  })

  it('keeps the three library controls in one horizontal scroll track and Flomo outside it', () => {
    render(createElement(CardLibraryView, { compact: true }))

    const track = screen.getByTestId('card-library-control-track')
    expect(track.className).toContain('flex-nowrap')
    expect(track.className).toContain('overflow-x-auto')
    expect(track.className).toContain('min-w-0')
    expect(within(track).getByRole('button', { name: '最近修改' })).toBeTruthy()
    expect(within(track).getByRole('button', { name: '全部标签' })).toBeTruthy()
    expect(within(track).getByRole('button', { name: '相关性' })).toBeTruthy()
    expect(within(track).queryByRole('button', { name: '同步 Flomo' })).toBeNull()
    const syncButton = screen.getByRole('button', { name: '同步 Flomo' })
    expect(syncButton).toBeTruthy()
    expect(syncButton.textContent).toBe('')
    expect(syncButton.className).toContain('shrink-0')
  })

  it('uses hysteresis and stable positioned geometry for the compact header', () => {
    let frame: FrameRequestCallback | undefined
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      frame = callback
      return 1
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    render(createElement(CardLibraryView, { compact: true }))

    const root = screen.getByTestId('card-library-scroll-root')
    const header = screen.getByTestId('card-library-header')
    expect(header.dataset.compact).toBe('false')
    expect(header.className).toContain('relative')
    expect(header.className).toContain('h-[92px]')
    expect(screen.getByTestId('card-library-search').className).toContain('top-12')

    Object.defineProperty(root, 'scrollTop', { configurable: true, value: 41 })
    fireEvent.scroll(root)
    act(() => frame?.(0))

    expect(header.dataset.compact).toBe('true')
    expect(header.className).toContain('h-[52px]')
    expect(screen.getByTestId('card-library-search').className).toContain('left-[72px]')

    Object.defineProperty(root, 'scrollTop', { configurable: true, value: 20 })
    fireEvent.scroll(root)
    act(() => frame?.(0))
    expect(header.dataset.compact).toBe('true')

    Object.defineProperty(root, 'scrollTop', { configurable: true, value: 8 })
    fireEvent.scroll(root)
    act(() => frame?.(0))
    expect(header.dataset.compact).toBe('false')
  })
})
