import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const cardContentSource = readFileSync(resolve(here, '../canvas/card/CardContent.tsx'), 'utf8')
const rightPanelSource = readFileSync(resolve(here, 'RightPanel.tsx'), 'utf8')
const dialogSource = readFileSync(resolve(here, 'CardEditDialog.tsx'), 'utf8')

describe('editor entry wiring', () => {
  it('uses the shared entry surface at all three entry points', () => {
    expect(cardContentSource).toContain('<CardEditorEntry')
    expect(rightPanelSource).toContain('<CardEditorEntry')
    expect(dialogSource).toContain('<CardEditorEntry')
  })

  it('does not keep duplicate lazy editors or blank editor fallbacks', () => {
    expect(dialogSource).not.toMatch(/\blazy\s*\(/)
    expect(dialogSource).not.toContain('fallback={null}')
    expect(rightPanelSource).not.toContain('<LazyCardBlockNoteEditor')
    expect(rightPanelSource).not.toContain('key={editingCardId} className="h-full animate-fadeIn"')
  })
})
