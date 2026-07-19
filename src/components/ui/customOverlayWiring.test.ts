import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(`${process.cwd()}/${path}`, 'utf8')

describe('custom overlay wiring', () => {
  it.each([
    'src/components/canvas/card/SummaryFormatMenu.tsx',
    'src/components/canvas/card/BoardSubmenu.tsx',
    'src/components/canvas/AlignmentToolbar.tsx',
    'src/components/editor/ImageToolbar.tsx',
    'src/components/canvas/FrameNode.tsx',
  ])('%s keeps its portal while adopting shared overlay motion', (path) => {
    const source = read(path)
    expect(source).toContain('createPortal')
    expect(source).toContain('ui-floating-content')
    expect(source).not.toMatch(/zIndex:\s*(?:9999|10000)/)
  })

  it('keeps command behavior and placement seams intact', () => {
    expect(read('src/components/canvas/card/SummaryFormatMenu.tsx')).toContain('handleSelect(opt.format)')
    expect(read('src/components/canvas/card/BoardSubmenu.tsx')).toContain('onSelect(board.id)')
    expect(read('src/components/canvas/AlignmentToolbar.tsx')).toContain('handleClick(item.mode)')
    expect(read('src/components/canvas/FrameNode.tsx')).toContain('handleLayoutChange(option.value)')
  })

  it.each([
    'src/components/canvas/ConnectionPreview.tsx',
    'src/components/editor/image-toolbar/CropOverlay.tsx',
    'src/components/canvas/card/SummaryBubble.tsx',
    'src/components/canvas/TextAnnotationNode.tsx',
  ])('%s uses semantic overlay layers instead of extreme numeric values', (path) => {
    expect(read(path)).not.toMatch(/zIndex:\s*(?:9999|10000|99999)/)
  })
})
