import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const zoomPreviewSource = readFileSync(
  `${process.cwd()}/src/components/canvas/card/ZoomPreview.tsx`,
  'utf8',
)
const canvasSource = readFileSync(
  `${process.cwd()}/src/components/canvas/ReactFlowCanvas.tsx`,
  'utf8',
)

describe('ZoomPreview mount contract', () => {
  it('mounts the expensive preview body only while the zoom preview is visible', () => {
    expect(zoomPreviewSource).toContain('state => state.isZoomPreviewVisible')
    expect(zoomPreviewSource).toContain('? <VisibleZoomPreview')
  })

  it('keeps card previews unmounted after density overview fully takes over', () => {
    expect(canvasSource).toContain('viewport.zoom <= previewZoomThreshold && overviewProgress < 1')
    expect(canvasSource).toContain('zoom <= previewZoomThreshold && overviewProgress < 1')
  })
})
