import { describe, expect, it } from 'vitest'
import { buildCardPreviewSemantics } from './previewSemantics'

function blocks(...items: object[]) {
  return JSON.stringify(items)
}

function heading(text: string) {
  return { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text }] }
}

function paragraph(text: string) {
  return { type: 'paragraph', content: [{ type: 'text', text }] }
}

describe('buildCardPreviewSemantics', () => {
  it('keeps a paragraph-only card in the body without promoting it to a title', () => {
    const preview = buildCardPreviewSemantics({
      content: blocks(paragraph('A single sentence.')),
      title: 'A single sentence.',
      previewHTML: '<p>A single sentence.</p>',
    })

    expect(preview.title).toBeNull()
    expect(preview.bodyHTML).toContain('A single sentence.')
    expect(preview.bodyHTML.match(/A single sentence\./g)).toHaveLength(1)
  })

  it('does not invent a title or body for an empty card', () => {
    const preview = buildCardPreviewSemantics({
      content: blocks(),
      title: 'New card',
      previewHTML: '',
    })

    expect(preview).toEqual({ title: null, bodyHTML: '' })
  })

  it('shows the first explicit heading once and preserves paragraph text with the same value', () => {
    const preview = buildCardPreviewSemantics({
      content: blocks(heading('Shared text'), paragraph('Shared text')),
      previewHTML: '<h2>Shared text</h2><p>Shared text</p>',
    })

    expect(preview.title).toBe('Shared text')
    expect(preview.bodyHTML).not.toContain('<h2')
    expect(preview.bodyHTML).toContain('<p>Shared text</p>')
    expect(preview.bodyHTML.match(/Shared text/g)).toHaveLength(1)
  })

  it('removes the displayed heading from a heading-only body', () => {
    const preview = buildCardPreviewSemantics({
      content: blocks(heading('Only heading')),
      previewHTML: '<h2>Only heading</h2>',
    })

    expect(preview.title).toBe('Only heading')
    expect(preview.bodyHTML).toBe('')
  })

  it('ignores a derived card.title when structured content has no heading', () => {
    const preview = buildCardPreviewSemantics({
      content: blocks(paragraph('Body copy')),
      title: 'Derived body copy',
      previewHTML: '<p>Body copy</p>',
    })

    expect(preview.title).toBeNull()
    expect(preview.bodyHTML).toContain('Body copy')
  })

  it('fails closed for malformed content and sanitizes the body fallback', () => {
    const preview = buildCardPreviewSemantics({
      content: '{not valid json',
      title: 'Derived fallback',
      previewHTML: '<p>Safe fallback</p><script>window.evil = true</script>',
    })

    expect(preview.title).toBeNull()
    expect(preview.bodyHTML).toContain('Safe fallback')
    expect(preview.bodyHTML).not.toContain('script')
    expect(preview.bodyHTML).not.toContain('window.evil')
  })

  it('removes only the corresponding native BlockNote heading wrapper', () => {
    const preview = buildCardPreviewSemantics({
      content: blocks(heading('First'), heading('Later')),
      previewHTML: [
        '<div class="bn-block-outer"><div class="bn-block-content" data-content-type="heading"><div class="bn-inline-content">First</div></div></div>',
        '<div class="bn-block-outer"><div class="bn-block-content" data-content-type="heading"><div class="bn-inline-content">Later</div></div></div>',
      ].join(''),
    })

    expect(preview.title).toBe('First')
    expect(preview.bodyHTML).not.toContain('First')
    expect(preview.bodyHTML).toContain('Later')
    expect(preview.bodyHTML.match(/bn-block-outer/g)).toHaveLength(1)
  })
})
