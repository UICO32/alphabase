import { memo, useMemo } from 'react'
import { useCardStore } from '../../../stores/cardStore'
import { extractTitleFromJSON, extractFirstTextFromHTML } from '../../../utils/cardPreview'
import './zoomPreview.css'

interface ZoomPreviewProps {
  cardId: string
  content: string
  previewHTML?: string
}

export const ZoomPreview = memo(function ZoomPreview({
  cardId,
  content,
  previewHTML,
}: ZoomPreviewProps) {
  const title = useMemo(() => extractTitleFromJSON(content), [content])

  const preview = useMemo(() => {
    const html = previewHTML || useCardStore.getState().getPreviewHTML(cardId) || ''
    return extractFirstTextFromHTML(html)
  }, [previewHTML, cardId])

  if (!title && !preview) return null

  return (
    <>
      {/* Background cover: near-instant switch at zoom=0.5 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 'clamp(0, calc((0.5 - var(--rf-zoom, 1)) * 1000), 1)',
          backgroundColor: 'inherit',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />
      {/* Text layer: same opacity as cover */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          opacity: 'clamp(0, calc((0.5 - var(--rf-zoom, 1)) * 1000), 1)',
          pointerEvents: 'none',
          zIndex: 6,
          contain: 'layout style paint',
        }}
      >
        <div
          style={{
            padding: 'calc(8px * var(--rf-inv-zoom, 1)) calc(10px * var(--rf-inv-zoom, 1))',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            height: '100%',
          }}
        >
          {title && (
            <div
              style={{
                fontSize: 'min(calc(20px * var(--rf-inv-zoom, 1)), 72px)',
                fontWeight: 600,
                lineHeight: 1.3,
                minHeight: 'min(calc(26px * var(--rf-inv-zoom, 1)), 93.6px)',
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginBottom: preview ? 'calc(4px * var(--rf-inv-zoom, 1))' : 0,
              }}
            >
              {title}
            </div>
          )}
          {preview && (
            <div
              style={{
                fontSize: 'min(calc(14px * var(--rf-inv-zoom, 1)), 30px)',
                lineHeight: 1.4,
                minHeight: 'min(calc(19.6px * var(--rf-inv-zoom, 1)), 42px)',
                textAlign: 'center',
                opacity: 'clamp(0, calc((var(--rf-zoom, 1) - 0.25) * 2.2), 0.55)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {preview}
            </div>
          )}
        </div>
      </div>
    </>
  )
})
