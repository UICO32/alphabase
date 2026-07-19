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
