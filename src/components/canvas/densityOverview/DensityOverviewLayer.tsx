import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore as useReactFlowStore, type Edge, type Node } from '@xyflow/react'
import { useStore as useZustandStore } from 'zustand'
import type { GlobalCard } from '../../../stores/cardStore'
import { embeddingStore } from '../../../stores/embeddingStore'
import {
  buildDensityOverviewModel,
  getAdaptiveGridSpacing,
  hitTestDensityGroup,
  projectDensityCard,
  type DensitySourceCard,
} from './densityOverviewModel'
import { getDensityOverviewFullZoom } from './densityOverviewConfig'
import {
  buildDensityGrid,
  DARK_DENSITY_THEME,
  drawDensityOverview,
  LIGHT_DENSITY_THEME,
} from './densityOverviewRenderer'
import { DensityOverviewDrawer } from './DensityOverviewDrawer'
import './density-overview.css'

interface DensityOverviewLayerProps {
  nodes: Node[]
  edges: Edge[]
  cards: Record<string, GlobalCard>
  progress: number
  zoomThreshold: number
  isDarkMode: boolean
  onFocusNode: (nodeId: string) => void
}

export function DensityOverviewLayer({
  nodes,
  edges,
  cards,
  progress,
  zoomThreshold,
  isDarkMode,
  onFocusNode,
}: DensityOverviewLayerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const transform = useReactFlowStore(state => state.transform)
  const nodeLookup = useReactFlowStore(state => state.nodeLookup)
  const clusterResult = useZustandStore(embeddingStore, state => state.clusterResult)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [hoverGroupId, setHoverGroupId] = useState<string | null>(null)
  const [pinnedGroupId, setPinnedGroupId] = useState<string | null>(null)
  const [activeCardId, setActiveCardId] = useState<string | null>(null)
  const [moving, setMoving] = useState(false)
  const movementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousTransformRef = useRef(transform)
  const pointerRef = useRef<{ x: number; y: number } | null>(null)

  const sourceCards = useMemo<DensitySourceCard[]>(() => nodes.flatMap((node) => {
    if (node.type !== 'card') return []
    const cardId = (node.data as Record<string, unknown>)?.cardId
    if (typeof cardId !== 'string' || !cards[cardId]) return []
    const internalNode = nodeLookup.get(node.id)
    const absolute = internalNode?.internals.positionAbsolute ?? node.position
    const data = node.data as Record<string, unknown>
    const width = Number(data.width ?? node.measured?.width ?? 280)
    const height = Number(data.height ?? node.measured?.height ?? 200)
    return [{ nodeId: node.id, cardId, x: absolute.x, y: absolute.y, width, height, card: cards[cardId] }]
  }), [cards, nodeLookup, nodes])

  const model = useMemo(
    () => buildDensityOverviewModel(sourceCards, edges.map(edge => ({ source: edge.source, target: edge.target })), clusterResult),
    [clusterResult, edges, sourceCards],
  )
  const viewport = useMemo(() => ({ x: transform[0], y: transform[1], zoom: transform[2] }), [transform])
  const fullZoom = getDensityOverviewFullZoom(zoomThreshold)
  const projectedCards = useMemo(
    () => model.cards.map(card => projectDensityCard(card, viewport, fullZoom)),
    [fullZoom, model.cards, viewport],
  )
  const projectedCardsRef = useRef(projectedCards)
  projectedCardsRef.current = projectedCards
  const activeGroupId = pinnedGroupId ?? (moving ? null : hoverGroupId)
  const activeGroup = activeGroupId ? model.groupById.get(activeGroupId) ?? null : null
  const activeCards = useMemo(
    () => activeGroup ? projectedCards.filter(card => card.groupId === activeGroup.id) : [],
    [activeGroup, projectedCards],
  )

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const previous = previousTransformRef.current
    previousTransformRef.current = transform
    const changed = previous[0] !== transform[0] || previous[1] !== transform[1] || previous[2] !== transform[2]
    if (!changed) return
    setMoving(true)
    setHoverGroupId(null)
    if (previous[2] !== transform[2]) setPinnedGroupId(null)
    if (movementTimerRef.current) clearTimeout(movementTimerRef.current)
    movementTimerRef.current = setTimeout(() => {
      setMoving(false)
      const pointer = pointerRef.current
      if (pointer) setHoverGroupId(hitTestDensityGroup(projectedCardsRef.current, pointer))
    }, 120)
    return () => {
      if (movementTimerRef.current) clearTimeout(movementTimerRef.current)
    }
  }, [transform])

  useEffect(() => {
    if (progress >= 0.72) return
    setHoverGroupId(null)
    setPinnedGroupId(null)
    setActiveCardId(null)
  }, [progress])

  useEffect(() => {
    const canvas = canvasRef.current
    const root = rootRef.current
    if (!canvas || !root) return
    if (progress <= 0) {
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      delete root.dataset.gridSpacing
      delete root.dataset.renderMs
      return
    }
    if (size.width <= 0 || size.height <= 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const pixelWidth = Math.round(size.width * dpr)
    const pixelHeight = Math.round(size.height * dpr)
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth
      canvas.height = pixelHeight
    }
    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    const spacing = getAdaptiveGridSpacing(model.cards.length)
    const visibleCards = projectedCards.filter(card => (
      card.screenX + card.radius >= -spacing
      && card.screenX - card.radius <= size.width + spacing
      && card.screenY + card.radius >= -spacing
      && card.screenY - card.radius <= size.height + spacing
    ))
    const frame = requestAnimationFrame(() => {
      const start = performance.now()
      const grid = buildDensityGrid(visibleCards, size.width, size.height, spacing)
      drawDensityOverview(
        context,
        grid,
        size.width,
        size.height,
        progress,
        activeGroupId,
        isDarkMode ? DARK_DENSITY_THEME : LIGHT_DENSITY_THEME,
      )
      root.dataset.gridSpacing = spacing.toFixed(1)
      root.dataset.renderMs = (performance.now() - start).toFixed(2)
    })
    return () => cancelAnimationFrame(frame)
  }, [activeGroupId, isDarkMode, model.cards.length, progress, projectedCards, size])

  useEffect(() => {
    const layer = rootRef.current
    const reactFlowRoot = layer?.closest('.react-flow')
    if (!layer || !reactFlowRoot || progress < 0.72) return

    const pointFromEvent = (event: PointerEvent | MouseEvent) => {
      const rect = layer.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }
    const handlePointerMove = (event: Event) => {
      const point = pointFromEvent(event as PointerEvent)
      pointerRef.current = point
      if (pinnedGroupId || moving) return
      setHoverGroupId(hitTestDensityGroup(projectedCards, point))
    }
    const handlePointerLeave = () => {
      pointerRef.current = null
      if (!pinnedGroupId) setHoverGroupId(null)
    }
    const handleClick = (event: Event) => {
      if ((event.target as Element | null)?.closest('.density-overview-drawer')) return
      const groupId = hitTestDensityGroup(projectedCards, pointFromEvent(event as MouseEvent))
      setPinnedGroupId(groupId)
      setHoverGroupId(groupId)
      setActiveCardId(null)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setPinnedGroupId(null)
      setHoverGroupId(null)
      setActiveCardId(null)
    }
    const handleWheel = () => setPinnedGroupId(null)

    reactFlowRoot.addEventListener('pointermove', handlePointerMove)
    reactFlowRoot.addEventListener('pointerleave', handlePointerLeave)
    reactFlowRoot.addEventListener('click', handleClick)
    reactFlowRoot.addEventListener('wheel', handleWheel, { capture: true })
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      reactFlowRoot.removeEventListener('pointermove', handlePointerMove)
      reactFlowRoot.removeEventListener('pointerleave', handlePointerLeave)
      reactFlowRoot.removeEventListener('click', handleClick)
      reactFlowRoot.removeEventListener('wheel', handleWheel, { capture: true })
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [moving, pinnedGroupId, progress, projectedCards])

  return (
    <div
      ref={rootRef}
      className="density-overview-layer"
      data-testid="density-overview-layer"
      data-progress={progress.toFixed(3)}
      data-card-count={model.cards.length}
      data-group-count={model.groups.length}
      aria-hidden={progress <= 0}
    >
      <canvas ref={canvasRef} className="density-overview-canvas" />
      <DensityOverviewDrawer
        group={activeGroup}
        cards={activeCards}
        pinned={pinnedGroupId !== null}
        activeCardId={activeCardId}
        onActiveCardChange={setActiveCardId}
        onFocusCard={(nodeId) => {
          setPinnedGroupId(null)
          setHoverGroupId(null)
          onFocusNode(nodeId)
        }}
      />
    </div>
  )
}
