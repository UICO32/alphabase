import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const canvasSource = readFileSync(`${process.cwd()}/src/components/canvas/ReactFlowCanvas.tsx`, 'utf8')

describe('canvas viewport entry regression contract', () => {
  it('restores a board viewport and fits only when no viewport was saved', () => {
    expect(canvasSource).toContain('instance.setViewport(request.viewport')
    expect(canvasSource).toContain('instance.fitView({ duration: 0, padding: 0.2 })')
    expect(canvasSource).toContain('const saveViewport = useBoardSync({ nodes, edges, viewportRef: canvasViewportRef })')
    expect(canvasSource).toContain('saveViewport(viewport)')
    expect(canvasSource).not.toContain('initialFitDoneRef')
  })
})
