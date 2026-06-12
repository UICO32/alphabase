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
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        opacity: 'clamp(0, calc((0.5 - var(--rf-zoom, 1)) * 10), 1)',
        pointerEvents: 'none',
        zIndex: 5,
        contain: 'layout style paint',
        backgroundColor: 'inherit',
}}
    >
      <div
        style={{
          padding: 'calc(6px * var(--rf-inv-zoom, 1)) calc(8px * var(--rf-inv-zoom, 1))',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          height: '100%',
        }}
      >
        {title && (
          <div
            style={{
              fontSize: 'min(calc(18px * var(--rf-inv-zoom, 1)), 36px)',
              fontWeight: 600,
              lineHeight: 1.3,
              minHeight: 'min(calc(23.4px * var(--rf-inv-zoom, 1)), 46.8px)',
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
              fontSize: 'min(calc(13px * var(--rf-inv-zoom, 1)), 26px)',
              lineHeight: 1.4,
              minHeight: 'min(calc(18.2px * var(--rf-inv-zoom, 1)), 36.4px)',
              textAlign: 'center',
              opacity: 'clamp(0, calc((0.25 - var(--rf-zoom, 1)) * 20), 0.55)',
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
  )
})
