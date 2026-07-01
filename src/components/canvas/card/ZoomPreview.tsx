import { memo, useMemo } from 'react'
import { useCardStore } from '../../../stores/cardStore'
import { useLibraryStore } from '../../../stores/libraryStore'
import { extractTitleFromJSON, extractFirstTextFromHTML } from '../utils/cardPreview'
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
  const isVisible = useLibraryStore(s => s.isZoomPreviewVisible)
  const title = useMemo(() => extractTitleFromJSON(content), [content])

  const preview = useMemo(() => {
    const html = previewHTML || useCardStore.getState().getPreviewHTML(cardId) || ''
    return extractFirstTextFromHTML(html)
  }, [previewHTML, cardId])

  // zoom > 0.55: 用户在近距离查看卡片细节，不需要覆盖层。
  // 卸载 DOM 节省每张卡 2 个 absolute div 的合成层开销（100 卡 = 200 图层）。
  // 阈值略高于 CSS fade-out 点（0.5），确保退出时 opacity≈0，无视觉闪烁。
  if (!isVisible) return null

  if (!title && !preview) return null

  return (
    <>
      {/* Background cover: near-instant switch at zoom=0.5 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 'clamp(0, calc((0.5 - var(--rf-zoom, 1)) * 1000), 1)',
          transition: 'opacity 0.2s ease',
          backgroundColor: 'inherit',
          pointerEvents: 'none',
          zIndex: 5,
          borderRadius: 'inherit',
        }}
      />
      {/* Text layer: same opacity as cover */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          opacity: 'clamp(0, calc((0.5 - var(--rf-zoom, 1)) * 1000), 1)',
          transition: 'opacity 0.2s ease',
          pointerEvents: 'none',
          zIndex: 6,
          contain: 'layout style paint',
          borderRadius: 'inherit',
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
                opacity: 'calc(0.55 * clamp(0, calc((var(--rf-zoom, 1) - 0.25) * 1000), 1))',
                transition: 'opacity 0.15s ease',
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
