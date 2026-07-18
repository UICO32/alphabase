import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(here, 'CardEditorEntry.tsx'), 'utf8')

describe('CardEditorEntry wiring', () => {
  it('keeps the real preview visible until the shared lazy editor is ready', () => {
    expect(source).toContain("import { LazyCardBlockNoteEditor } from './cardEditorLoader'")
    expect(source).toContain('data-editor-entry-phase={effectivePhase}')
    expect(source).toContain('card-preview-native')
    expect(source).toContain('onReady={handleReady}')
  })

  it('uses an animation frame for an atomic preview-to-editor swap', () => {
    expect(source).toContain('requestAnimationFrame')
    expect(source).toContain("dispatch({ type: 'interactive', entryKey: readyKey })")
    expect(source).not.toContain('onTransitionEnd')
    expect(source).not.toContain('setTimeout')
  })
})
