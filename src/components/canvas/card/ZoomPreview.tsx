import { memo, useMemo } from 'react'
import { useCardStore } from '../../../stores/cardStore'
import { useLibraryStore } from '../../../stores/libraryStore'
import { extractTitleFromJSON, extractPreviewTextFromHTML } from '../utils/cardPreview'
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
  const isVisible = useLibraryStore(state => state.isZoomPreviewVisible)

  return isVisible
    ? <VisibleZoomPreview cardId={cardId} content={content} previewHTML={previewHTML} />
    : null
})

const VisibleZoomPreview = memo(function VisibleZoomPreview({
  cardId,
  content,
  previewHTML,
}: ZoomPreviewProps) {
  const title = useMemo(() => extractTitleFromJSON(content), [content])

  const preview = useMemo(() => {
    const html = previewHTML || useCardStore.getState().getPreviewHTML(cardId) || ''
    return extractPreviewTextFromHTML(html)
  }, [previewHTML, cardId])

  if (!title && !preview) return null

  return (
    <div
      aria-hidden="true"
      className="zoom-preview"
      data-title={title}
      data-preview={preview}
    />
  )
})
