import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/canvas/card/MoreActionsMenu.tsx`,
  'utf8',
)

describe('MoreActionsMenu contract', () => {
  it('uses the shared dropdown foundation for all common actions', () => {
    expect(source).toContain('<DropdownMenuContent')
    expect(source).toContain('选择颜色')
    expect(source).toContain('移动到画板')
    expect(source).toContain('移出白板')
    expect(source).toContain('className="text-destructive focus:text-destructive"')
  })

  it('keeps color choices keyboard-selectable and exposes the current color', () => {
    expect(source).toContain('onSelect={() => onColorChange(cardColor)}')
    expect(source).toContain('aria-label={`卡片颜色：${COLOR_LABELS[cardColor]}`}')
    expect(source).toContain('<Check aria-label="当前颜色" />')
  })

  it('uses an opaque component-local surface', () => {
    expect(source).toContain("backgroundColor: isDarkMode ? '#242426' : '#FFFFFF'")
  })
})
