import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(`${process.cwd()}/src/components/ui/CardEditDialog.tsx`, 'utf8')

describe('CardEditDialog shell', () => {
  it('uses the shared viewport-safe Dialog foundation', () => {
    expect(source).toContain('<Dialog open')
    expect(source).toContain('<DialogContent')
    expect(source).toContain('showCloseButton={false}')
    expect(source).not.toContain('z-[60]')
  })

  it('preserves snapshot, delete, color, and editor entry behavior', () => {
    expect(source).toContain('recordSnapshot(cardId, content)')
    expect(source).toContain('softDeleteCard(cardId)')
    expect(source).toContain('handleColorChange(color)')
    expect(source).toContain('<CardEditorEntry')
  })

  it('uses transform-only source morph and restores focus', () => {
    expect(source).toContain('transformOrigin')
    expect(source).toContain("translate: 'none'")
    expect(source).toContain('onCloseAutoFocus')
    expect(source).not.toContain('top: `${sourceRect.top}px`')
    expect(source).not.toContain('width: `${sourceRect.width}px`')
  })
})
