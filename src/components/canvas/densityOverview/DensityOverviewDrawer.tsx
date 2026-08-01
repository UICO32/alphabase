import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import type { DensityOverviewGroup, ProjectedDensityCard } from './densityOverviewModel'
import { getClusterColor } from './densityOverviewRenderer'

interface ConnectorPath {
  cardId: string
  path: string
  sourceX: number
  sourceY: number
  endX: number
  endY: number
  opacity: number
}

interface DensityOverviewDrawerProps {
  group: DensityOverviewGroup | null
  cards: ProjectedDensityCard[]
  pinned: boolean
  activeCardId: string | null
  onActiveCardChange: (cardId: string | null) => void
  onFocusCard: (nodeId: string) => void
}

function previewHTML(card: ProjectedDensityCard): string {
  const source = card.card.previewHTML || card.card.content || ''
  return DOMPurify.sanitize(source, {
    ALLOWED_URI_REGEXP: /^(?:(?:hepta-media|https?|mailto|tel|data):|[^a-zA-Z]|[^a-zA-Z]javascript:)/i,
    ADD_URI_SAFE_ATTR: ['type'],
  }).replace(/<img[^>]*>/gi, '')
}

export function DensityOverviewDrawer({
  group,
  cards,
  pinned,
  activeCardId,
  onActiveCardChange,
  onFocusCard,
}: DensityOverviewDrawerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef(new Map<string, HTMLButtonElement>())
  const [layoutRevision, setLayoutRevision] = useState(0)

  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => a.center.y - b.center.y || a.center.x - b.center.x),
    [cards],
  )

  useLayoutEffect(() => {
    const root = rootRef.current
    const scroll = scrollRef.current
    if (!root || !scroll || !group) return
    const refresh = () => setLayoutRevision(revision => revision + 1)
    const observer = new ResizeObserver(refresh)
    observer.observe(root)
    observer.observe(scroll)
    for (const element of cardRefs.current.values()) observer.observe(element)
    window.addEventListener('resize', refresh)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', refresh)
    }
  }, [group, sortedCards])

  const connectorPaths = useMemo<ConnectorPath[]>(() => {
    const root = rootRef.current
    const scroll = scrollRef.current
    if (!root || !scroll || !group) return []
    const rootRect = root.getBoundingClientRect()
    const viewport = scroll.getBoundingClientRect()
    return sortedCards.flatMap((card, index) => {
      const element = cardRefs.current.get(card.cardId)
      if (!element) return []
      const rect = element.getBoundingClientRect()
      if (rect.bottom < viewport.top || rect.top > viewport.bottom) return []
      const center = (rect.top + rect.bottom) / 2
      const topFade = Math.max(0, Math.min(1, (center - viewport.top) / 76))
      const bottomFade = Math.max(0, Math.min(1, (viewport.bottom - center) / 76))
      const endX = rect.left - rootRect.left - 5
      const endY = center - rootRect.top
      const bendX = endX - 42 - index * 6
      return [{
        cardId: card.cardId,
        path: `M ${card.screenX.toFixed(1)} ${card.screenY.toFixed(1)} L ${bendX.toFixed(1)} ${endY.toFixed(1)} L ${endX.toFixed(1)} ${endY.toFixed(1)}`,
        sourceX: card.screenX,
        sourceY: card.screenY,
        endX,
        endY,
        opacity: topFade * bottomFade,
      }]
    })
  }, [group, layoutRevision, sortedCards])

  const handleScroll = useCallback(() => setLayoutRevision(revision => revision + 1), [])
  if (!group) return null

  const [red, green, blue] = getClusterColor(group.id)
  const color = `rgb(${red}, ${green}, ${blue})`

  return (
    <div ref={rootRef} className="density-overview-drawer-root">
      <svg className="density-overview-connectors" aria-hidden="true">
        {connectorPaths.map(connector => {
          const active = activeCardId === connector.cardId
          const opacity = connector.opacity * (active ? 1 : 0.5)
          return (
            <g key={connector.cardId} opacity={opacity}>
              <path d={connector.path} stroke={color} strokeWidth={active ? 1.8 : 1.15} />
              <circle cx={connector.sourceX} cy={connector.sourceY} r={active ? 3.2 : 2.2} fill={color} />
              <circle cx={connector.endX} cy={connector.endY} r="2.2" fill={color} />
            </g>
          )
        })}
      </svg>
      <aside
        className={`density-overview-drawer ${pinned ? 'is-pinned' : 'is-preview'}`}
        aria-label={`${group.label} semantic cluster`}
        style={{ '--density-group-color': color } as React.CSSProperties}
      >
        <header className="density-overview-drawer-header">
          <span>{group.source === 'embedding' ? 'SEMANTIC CLUSTER' : 'RELATED CLUSTER'}</span>
          <strong>{group.label || 'Related cards'}</strong>
          <small>{pinned ? 'PINNED · SCROLL ENABLED' : 'HOVER PREVIEW · CLICK TO PIN'}</small>
        </header>
        <div ref={scrollRef} className="density-overview-drawer-scroll" onScroll={handleScroll}>
          {sortedCards.map((card, index) => (
            <button
              key={card.cardId}
              ref={(element) => {
                if (element) cardRefs.current.set(card.cardId, element)
                else cardRefs.current.delete(card.cardId)
              }}
              type="button"
              className="density-overview-preview-card"
              onMouseEnter={() => onActiveCardChange(card.cardId)}
              onMouseLeave={() => onActiveCardChange(null)}
              onFocus={() => onActiveCardChange(card.cardId)}
              onBlur={() => onActiveCardChange(null)}
              onClick={() => onFocusCard(card.nodeId)}
            >
              <span className="density-overview-preview-meta">
                <span>CARD {String(index + 1).padStart(2, '0')}</span>
                <span>{card.edgeDegree} LINKS · {Math.round(card.density * 100)} DENSITY</span>
              </span>
              <strong>{card.card.title || 'Untitled card'}</strong>
              <span
                className="density-overview-preview-content"
                dangerouslySetInnerHTML={{ __html: previewHTML(card) || 'No preview content' }}
              />
              {(card.card.tags?.length ?? 0) > 0 && (
                <span className="density-overview-preview-tags">
                  {card.card.tags!.slice(0, 4).map(tag => <span key={tag}>#{tag}</span>)}
                </span>
              )}
              {card.similarity !== null && (
                <span className="density-overview-preview-similarity">
                  {Math.round(card.similarity * 100)}% semantic affinity
                </span>
              )}
            </button>
          ))}
        </div>
      </aside>
    </div>
  )
}
