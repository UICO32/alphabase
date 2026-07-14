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
