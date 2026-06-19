import { memo, useState, useMemo } from 'react'
import { useCard, useCardStore } from '../../../stores/cardStore'
import { useViewStore } from '../../../stores/viewStore'

interface MiniCardProps {
  cardId: string
  width?: number
  height?: number
}

function extractTitle(content: string): string {
  try {
    const blocks = JSON.parse(content)
    for (const block of blocks) {
      if (block.type === 'heading' && block.content?.length > 0) {
        return block.content.map((c: { text?: string }) => c.text || '').join('')
      }
    }
    return ''
  } catch {
    return ''
  }
}

function extractImages(html: string): string[] {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const imgs = doc.querySelectorAll('img')
    return Array.from(imgs).map((img) => img.src).filter(Boolean)
  } catch {
    return []
  }
}

function extractFirstText(html: string): string {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    // Native BlockNote structure
    const nativeBlocks = doc.querySelectorAll('.bn-block-content')
    if (nativeBlocks.length > 0) {
      for (const block of nativeBlocks) {
        const contentType = (block as HTMLElement).dataset.contentType
        if (contentType === 'heading') continue
        const inline = block.querySelector('.bn-inline-content')
        const text = (inline || block).textContent?.trim() || ''
        if (text) return text
      }
      return ''
    }
    // Legacy HTML fallback
    const allBlocks = doc.body.children
    for (let i = 0; i < allBlocks.length; i++) {
      const el = allBlocks[i] as HTMLElement
      if (el.matches('h1, h2, h3')) continue
      const text = el.textContent?.trim() || ''
      if (text) return text
    }
    return ''
  } catch {
    return ''
  }
}

export const MiniCard = memo(function MiniCard({ cardId, width, height }: MiniCardProps) {
  const card = useCard(cardId)
  const [isHovered, setIsHovered] = useState(false)
  const openKanbanEditDialog = useViewStore((s) => s.openKanbanEditDialog)

  const title = useMemo(() => {
    if (!card) return ''
    return card.title || extractTitle(card.content)
  }, [card])

  const images = useMemo(() => {
    if (!card) return []
    const html = card.previewHTML || useCardStore.getState().getPreviewHTML(cardId) || ''
    if (!html) return []
    return extractImages(html)
  }, [card, cardId])

  const preview = useMemo(() => {
    if (!card) return ''
    const html = card.previewHTML || useCardStore.getState().getPreviewHTML(cardId) || ''
    if (!html) return ''
    return extractFirstText(html)
  }, [card, cardId])

  if (!card) return null

  const imageCount = images.length

  const cardBg = 'var(--surface-card)'
  const titleColor = 'var(--fg-primary)'
  const previewColor = 'var(--fg-secondary)'
  const borderColor = isHovered ? 'var(--line-hover)' : 'var(--line-default)'
  const shadowDefault = 'var(--shadow-sm)'
  const shadowHover = 'var(--shadow-md)'

  const imageGridStyle = (() => {
    if (imageCount === 1) return { gridTemplateColumns: '1fr' }
    if (imageCount === 2) return { gridTemplateColumns: '1fr 1fr' }
    if (imageCount === 3) return { gridTemplateColumns: '1.2fr 0.8fr', gridTemplateRows: '1fr 1fr' }
    return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }
  })()

  return (
    <div
      style={{
        width: width ?? '100%',
        minHeight: height ?? 60,
        height: 'auto',
        background: cardBg,
        borderRadius: 10,
        padding: 2,
        boxShadow: isHovered ? shadowHover : shadowDefault,
        cursor: 'grab',
        transition: 'transform 0.25s cubic-bezier(0.25,0.1,0.25,1), box-shadow 0.25s cubic-bezier(0.25,0.1,0.25,1), border-color 0.2s',
        transform: isHovered ? 'translateY(-2px)' : 'none',
        overflow: 'hidden',
        position: 'relative',
        border: `1px solid ${borderColor}`,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={(e) => {
        e.stopPropagation()
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        openKanbanEditDialog(cardId, rect)
      }}
    >
      <div style={{
        background: cardBg,
        borderRadius: 8,
        overflow: 'hidden',
        padding: '8px 10px 0',
      }}>
        {imageCount > 0 && (
          <div
            style={{
              display: 'grid',
              gap: 2,
              borderRadius: 6,
              overflow: 'hidden',
              position: 'relative',
              ...imageGridStyle,
            }}
          >
            {images.slice(0, 4).map((src, i) => (
              <div
                key={i}
                style={{
                  overflow: 'hidden',
                  position: 'relative',
                  ...(imageCount === 3 && i === 0 ? { gridRow: '1 / -1' } : {}),
                  ...(imageCount === 1 ? { aspectRatio: '16/9' } : { aspectRatio: '4/3' }),
                }}
              >
                <img
                  src={src}
                  alt=""
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    transition: 'transform 0.4s cubic-bezier(0.25,0.1,0.25,1)',
                    transform: isHovered ? 'scale(1.03)' : 'none',
                  }}
                  loading="lazy"
                />
                {imageCount > 4 && i === 3 && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                  }}>
                    +{imageCount - 4}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ padding: imageCount > 0 ? '8px 0 10px' : '10px 0' }}>
          {title && (
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                lineHeight: 1.4,
                color: titleColor,
                marginBottom: preview ? 3 : 0,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {title}
            </div>
          )}
          {preview && (
            <div
              style={{
                fontSize: 12,
                lineHeight: 1.5,
                color: previewColor,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {preview}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})