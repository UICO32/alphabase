import { memo, useState, useMemo } from 'react'
import { useCard } from '../../../stores/cardStore'
import { useLibraryStore } from '../../../stores/libraryStore'
import { useIsDarkMode } from '../../../hooks/useIsDarkMode'

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
  const isDarkMode = useIsDarkMode()
  const [isHovered, setIsHovered] = useState(false)
  const openKanbanEditDialog = useLibraryStore((s) => s.openKanbanEditDialog)

  const title = useMemo(() => {
    if (!card) return ''
    return card.title || extractTitle(card.content)
  }, [card])

  const images = useMemo(() => {
    if (!card?.previewHTML) return []
    return extractImages(card.previewHTML)
  }, [card?.previewHTML])

  const preview = useMemo(() => {
    if (!card?.previewHTML) return ''
    return extractFirstText(card.previewHTML)
  }, [card?.previewHTML])

  if (!card) return null

  const imageCount = images.length

  const cardBg = isDarkMode ? '#2a2a2e' : '#FFFFFF'
  const titleColor = isDarkMode ? '#e5e5e5' : '#1A1A1A'
  const previewColor = isDarkMode ? '#999' : '#6B6B6B'
  const borderColor = isHovered
    ? (isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)')
    : (isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)')
  const shadowDefault = isDarkMode ? '0 1px 3px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.04)'
  const shadowHover = isDarkMode ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.06)'

  const imageGridStyle = (() => {
    if (imageCount === 1) return { gridTemplateColumns: '1fr', height: 140 }
    if (imageCount === 2) return { gridTemplateColumns: '1fr 1fr', height: 120 }
    if (imageCount === 3) return { gridTemplateColumns: '1.2fr 0.8fr', gridTemplateRows: '1fr 1fr', height: 140 }
    return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', height: 140 }
  })()

  return (
    <div
      style={{
        width: width ?? '100%',
        height: height ?? 'auto',
        background: cardBg,
        borderRadius: 14,
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
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        {imageCount > 0 && (
          <div
            style={{
              display: 'grid',
              gap: 2,
              borderRadius: 12,
              overflow: 'hidden',
              ...imageGridStyle,
            }}
          >
            {images.slice(0, 4).map((src, i) => (
              <div
                key={i}
                style={{
                  overflow: 'hidden',
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
              </div>
            ))}
            {imageCount > 4 && (
              <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '50%',
                height: '50%',
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 16,
                fontWeight: 600,
                borderRadius: 12,
              }}>
                +{imageCount - 4}
              </div>
            )}
          </div>
        )}

        <div style={{ padding: '12px 14px 12px' }}>
          {title && (
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.4,
                color: titleColor,
                marginBottom: 4,
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