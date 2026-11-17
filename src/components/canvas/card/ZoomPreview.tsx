import { memo, useMemo, type CSSProperties } from 'react'
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
  // 已提交的缩放级别（不是每帧 transform）：只在平移/缩放结束时变化。
  // 预览文字用 --rf-inv-zoom 做逆向缩放，变量写在预览元素自己身上，
  // 避免写到画布根后每次缩放都让整棵卡片树重算样式。
  const zoom = useLibraryStore(state => state.zoom)
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
      style={{ '--rf-inv-zoom': String(1 / zoom) } as CSSProperties}
      data-title={title}
      data-preview={preview}
    />
  )
})
