import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_DENSITY_OVERVIEW_ZOOM_THRESHOLD,
  MAX_DENSITY_OVERVIEW_ZOOM_THRESHOLD,
  MIN_DENSITY_OVERVIEW_ZOOM_THRESHOLD,
} from '../components/canvas/densityOverview/densityOverviewConfig'
import { useLibraryStore } from './libraryStore'

describe('libraryStore density overview preference', () => {
  beforeEach(() => {
    useLibraryStore.persist.clearStorage()
    useLibraryStore.setState({
      densityOverviewZoomThreshold: DEFAULT_DENSITY_OVERVIEW_ZOOM_THRESHOLD,
    })
  })

  it('defaults to a 25% entry threshold', () => {
    expect(useLibraryStore.getState().densityOverviewZoomThreshold).toBe(0.25)
  })

  it('updates and clamps the persisted threshold to the supported zoom range', () => {
    useLibraryStore.getState().setDensityOverviewZoomThreshold(0.4)
    expect(useLibraryStore.getState().densityOverviewZoomThreshold).toBe(0.4)

    useLibraryStore.getState().setDensityOverviewZoomThreshold(0)
    expect(useLibraryStore.getState().densityOverviewZoomThreshold).toBe(MIN_DENSITY_OVERVIEW_ZOOM_THRESHOLD)

    useLibraryStore.getState().setDensityOverviewZoomThreshold(1)
    expect(useLibraryStore.getState().densityOverviewZoomThreshold).toBe(MAX_DENSITY_OVERVIEW_ZOOM_THRESHOLD)
  })
})

describe('libraryStore related sort lifecycle', () => {
  beforeEach(() => {
    useLibraryStore.setState({ sortBy: 'updatedAt', sortBeforeRelated: 'updatedAt', relatedSourceCardId: null })
  })

  it('restores the ordinary sort that was active before relevance', () => {
    useLibraryStore.getState().setSortBy('title')
    useLibraryStore.getState().activateRelatedSort()
    expect(useLibraryStore.getState().sortBy).toBe('related')

    useLibraryStore.getState().exitRelatedSort()
    expect(useLibraryStore.getState().sortBy).toBe('title')
  })

  it('does not overwrite the saved ordinary sort while relevance is active', () => {
    useLibraryStore.getState().setSortBy('createdAt')
    useLibraryStore.getState().activateRelatedSort()
    useLibraryStore.getState().activateRelatedSort()
    useLibraryStore.getState().exitRelatedSort()

    expect(useLibraryStore.getState().sortBy).toBe('createdAt')
  })

  it('keeps an explicit AI source separate from the currently edited card', () => {
    useLibraryStore.getState().activateRelatedSort('card-ai-source')

    expect(useLibraryStore.getState()).toMatchObject({
      sortBy: 'related',
      relatedSourceCardId: 'card-ai-source',
    })

    useLibraryStore.getState().exitRelatedSort()
    expect(useLibraryStore.getState().relatedSourceCardId).toBeNull()
  })

  it('uses the current selection when relevance is activated without an explicit source', () => {
    useLibraryStore.getState().activateRelatedSort()
    expect(useLibraryStore.getState().relatedSourceCardId).toBeNull()
  })
})
