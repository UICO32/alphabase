import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(`${process.cwd()}/src/components/canvas/card/CardActionBar.tsx`, 'utf8')

describe('CardActionBar collapsed title contract', () => {
  it('renders the collapsed title beside an always-visible expand control', () => {
    expect(source).toContain('collapsedTitle: string')
    expect(source).toContain('data-testid="collapsed-card-title"')
    expect(source).toContain('opacity: collapsed ? 1 : (showIcons ? 1 : 0)')
  })

  it('does not mount hidden action controls for idle expanded cards', () => {
    expect(source).toContain('{showSummary')
    expect(source).toContain('{collapsed || showIcons')
    expect(source).toContain('{showIcons')
  })
})
