import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const rightPanelSource = readFileSync(resolve(here, 'RightPanel.tsx'), 'utf8')
const lazyEntrySource = readFileSync(resolve(here, 'lazyAgentReachPanel.tsx'), 'utf8')

describe('right panel lazy wiring', () => {
  it('keeps the channels implementation out of the eager right-panel graph', () => {
    expect(rightPanelSource).not.toContain("from './AgentReachPanel'")
    expect(rightPanelSource).toContain('<LazyAgentReachPanel />')
    expect(lazyEntrySource).toContain("import('./AgentReachPanel')")
  })

  it('preloads the channels chunk from pointer and keyboard intent', () => {
    expect(rightPanelSource).toContain('onPointerEnter={preloadAgentReachPanel}')
    expect(rightPanelSource).toContain('onFocus={preloadAgentReachPanel}')
  })

  it('does not render channel content while the panel is collapsed', () => {
    expect(rightPanelSource).toMatch(/rightPanelActiveTab === 'channels'[\s\S]*?!rightPanelCollapsed/)
  })
})
