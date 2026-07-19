import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(`${process.cwd()}/src/components/canvas/ReactFlowCanvas.tsx`, 'utf8')

describe('ReactFlowCanvas related-sort exit', () => {
  it('exits related sorting when blank canvas is clicked', () => {
    expect(source).toContain('useLibraryStore.getState().exitRelatedSort()')
  })
})
