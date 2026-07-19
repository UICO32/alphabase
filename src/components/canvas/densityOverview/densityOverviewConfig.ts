export const DEFAULT_DENSITY_OVERVIEW_ZOOM_THRESHOLD = 0.25
export const MIN_DENSITY_OVERVIEW_ZOOM_THRESHOLD = 0.15
export const MAX_DENSITY_OVERVIEW_ZOOM_THRESHOLD = 0.6
export const DENSITY_OVERVIEW_TRANSITION_WIDTH = 0.05

export function clampDensityOverviewZoomThreshold(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_DENSITY_OVERVIEW_ZOOM_THRESHOLD
  return Math.min(MAX_DENSITY_OVERVIEW_ZOOM_THRESHOLD, Math.max(MIN_DENSITY_OVERVIEW_ZOOM_THRESHOLD, value))
}

export function getDensityOverviewFullZoom(entryZoom = DEFAULT_DENSITY_OVERVIEW_ZOOM_THRESHOLD): number {
  return Math.max(0.1, clampDensityOverviewZoomThreshold(entryZoom) - DENSITY_OVERVIEW_TRANSITION_WIDTH)
}
