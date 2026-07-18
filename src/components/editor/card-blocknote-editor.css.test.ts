import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const cssPath = resolve(here, 'card-blocknote-editor.css')
const css = readFileSync(cssPath, 'utf8')

/**
 * Regression guard for the card-preview dropcursor hiding rule.
 *
 * The original implementation used an invalid CSS selector
 * (`.prosemirror-dropcursor-*`, a wildcard class name) which browsers
 * silently ignore, leaving the drag-drop cursor visible inside read-only
 * card previews. The fix uses valid attribute selectors. This test
 * ensures the rule stays valid and scoped to `.card-preview-native`.
 */
describe('card-blocknote-editor.css dropcursor rule', () => {
  it('hides dropcursor elements via valid attribute selectors', () => {
    // Must NOT contain the invalid wildcard class selector.
    expect(css).not.toContain('.prosemirror-dropcursor-*')

    // Must use the valid prefix-attribute selectors, scoped to card previews.
    expect(css).toContain('.card-preview-native [class^="prosemirror-dropcursor-"]')
    expect(css).toContain('.card-preview-native [class*=" prosemirror-dropcursor-"]')
  })

  it('applies display:none to the dropcursor rule', () => {
    // Locate the rule block and confirm it hides the matched elements.
    const ruleIndex = css.indexOf('prosemirror-dropcursor-')
    expect(ruleIndex).toBeGreaterThan(-1)

    // Find the declaration block that follows the selector group.
    const blockStart = css.indexOf('{', ruleIndex)
    const blockEnd = css.indexOf('}', blockStart)
    const block = css.slice(blockStart, blockEnd + 1)
    expect(block).toContain('display: none')
  })
})

describe('card editor selection theme', () => {
  it('defines adaptive semantic selection colors', () => {
    expect(css).toMatch(/\.card-blocknote-editor--editable:not\(\.annotation-editor\)\s*\{[^}]*--card-editor-selection-bg:\s*#[0-9a-f]{6}/is)
    expect(css).toMatch(/\[data-theme=["']dark["']\]\s+\.card-blocknote-editor--editable:not\(\.annotation-editor\)\s*\{/is)
    expect(css).toMatch(/--card-editor-selection-bg:\s*rgba\([^)]*\)/i)
  })

  it('scopes selection styling to editable card editor content', () => {
    expect(css).toMatch(/\.card-blocknote-editor--editable:not\(\.annotation-editor\)\s+\.ProseMirror\s+::selection\s*\{[^}]*background(?:-color)?:\s*var\(--card-editor-selection-bg\)/is)
    expect(css).not.toMatch(/\.card-blocknote-editor--editable\s+\.ProseMirror\s+::selection/is)
    const selectionSelectors = Array.from(css.matchAll(/([^{}]+)::selection\s*\{/g), (match) => match[1].trim())
    expect(selectionSelectors).toEqual([
      '.card-blocknote-editor--editable:not(.annotation-editor) .ProseMirror',
    ])
  })
})

describe('card editor entry transition', () => {
  it('layers a non-interactive preview under an atomic editor reveal', () => {
    expect(css).toMatch(/\.card-editor-entry\s*\{[^}]*position:\s*relative/is)
    expect(css).toMatch(/\.card-editor-entry__preview\s*\{[^}]*position:\s*absolute[^}]*pointer-events:\s*none/is)
    expect(css).toMatch(/\.card-editor-entry__editor\s*\{[^}]*opacity:\s*0[^}]*pointer-events:\s*none/is)
    expect(css).toMatch(/data-editor-entry-phase=["']interactive["'][^}]*\.card-editor-entry__editor[^}]*opacity:\s*1/is)
    expect(css).not.toMatch(/\.card-editor-entry__editor\s*\{[^}]*transition:/is)
  })

  it('does not animate the editor swap or any layout property', () => {
    expect(css).not.toMatch(/card-editor-entry[^}]*transition:/is)
  })
})
