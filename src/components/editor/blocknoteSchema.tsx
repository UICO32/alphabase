import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs, filterSuggestionItems } from '@blocknote/core'
import { createReactBlockSpec, createReactInlineContentSpec } from '@blocknote/react'
import { ImageRowBlock } from './ImageRowBlock'

// ─── imageRow block spec (restored from commit 10712b0) ───

const ImageRowBlockSpec = createReactBlockSpec(
  {
    type: 'imageRow' as const,
    propSchema: {
      textAlignment: { default: 'left' as const, values: ['left', 'center', 'right', 'justify'] as const },
      backgroundColor: { default: 'default' as const },
      urlsJson: { default: '[]' },
      captionsJson: { default: '[]' },
    },
    content: 'none' as const,
  },
  {
    render: ({ block, editor }) => {
      const urls: string[] = JSON.parse((block.props.urlsJson as string) || '[]')
      const captions: string[] = JSON.parse((block.props.captionsJson as string) || '[]')
      return (
        <ImageRowBlock
          urls={urls}
          captions={captions}
          editor={editor as any}
          blockId={block.id}
          editable={editor.isEditable}
          onUpdate={(newUrls: string[], newCaptions: string[]) => {
            editor.updateBlock(block.id, {
              type: 'imageRow' as any,
              props: { urlsJson: JSON.stringify(newUrls), captionsJson: JSON.stringify(newCaptions) } as any,
            })
          }}
        />
      )
    },
    toExternalHTML: ({ block }) => {
      const urls: string[] = JSON.parse((block.props.urlsJson as string) || '[]')
      const captions: string[] = JSON.parse((block.props.captionsJson as string) || '[]')
      if (urls.length === 0) return <div />
      return (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          {urls.map((url, i) => (
            <div key={i} style={{ flex: 1, minWidth: 0 }}>
              <img src={url} alt="" style={{ width: '100%', height: 'auto', borderRadius: '6px', display: 'block' }} />
              {captions[i] && <p style={{ fontSize: '0.75em', opacity: 0.6, margin: '2px 0 0 0', textAlign: 'center' }}>{captions[i]}</p>}
            </div>
          ))}
        </div>
      )
    },
    parse: (el: HTMLElement) => {
      if (el.tagName === 'DIV' && el.style.display === 'flex') {
        const imgs = el.querySelectorAll('img')
        if (imgs.length > 1) {
          return {
            urlsJson: JSON.stringify(Array.from(imgs).map((img) => img.getAttribute('src') || '')),
            captionsJson: JSON.stringify(Array.from(el.querySelectorAll('p')).map((p) => p.textContent || '')),
          }
        }
      }
      return undefined
    },
  },
)

// ─── cardReference inline content spec ───

export const cardReferenceSpec = createReactInlineContentSpec(
  {
    type: 'cardReference' as const,
    propSchema: {
      cardId: { default: '' },
    },
    content: 'styled' as const,
  },
  {
    render: ({ inlineContent, contentRef }) => (
      <span
        data-card-id={inlineContent.props.cardId as string}
        ref={contentRef}
        style={{
          backgroundColor: 'var(--card-ref-bg, rgba(59,130,246,0.1))',
          borderRadius: '3px',
          padding: '0 3px',
          cursor: 'pointer',
          textDecoration: 'none',
          color: 'var(--card-ref-color, #3b82f6)',
          fontWeight: 500,
        }}
      />
    ),
  },
)

// ─── tag inline content spec ───

export const tagSpec = createReactInlineContentSpec(
  {
    type: 'tag' as const,
    propSchema: {
      tagName: { default: '' },
    },
    content: 'styled' as const,
  },
  {
    render: ({ inlineContent, contentRef }) => (
      <span
        data-tag-name={inlineContent.props.tagName as string}
        ref={contentRef}
        style={{
          backgroundColor: 'var(--tag-bg, rgba(139,92,246,0.1))',
          borderRadius: '3px',
          padding: '0 3px',
          cursor: 'pointer',
          textDecoration: 'none',
          color: 'var(--tag-color, #8b5cf6)',
          fontWeight: 500,
        }}
      />
    ),
  },
)

// ─── Schema ───

export const cardSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    imageRow: ImageRowBlockSpec,
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    cardReference: cardReferenceSpec,
    tag: tagSpec,
  },
})

export { filterSuggestionItems }
