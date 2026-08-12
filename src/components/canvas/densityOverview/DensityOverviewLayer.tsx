import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore as useReactFlowStore, useStoreApi, type Edge, type Node, type Viewport } from '@xyflow/react'
import { useStore as useZustandStore } from 'zustand'
import { useCardStore } from '../../../stores/cardStore'
import { embeddingStore } from '../../../stores/embeddingStore'
import {
  buildDensityOverviewModel,
  getAdaptiveGridSpacing,
  hitTestDensityGroup,
  projectDensityCard,
  type DensityOverviewModel,
  type ProjectedDensityCard,
  type DensitySourceCard,
  type ViewportTransform,
} from './densityOverviewModel'
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
  progress: number
  progressRef: { current: number }
  viewportRef: { current: Viewport | null }
  frameSchedulerRef: { current: (() => void) | null }
  isDarkMode: boolean
  onFocusNode: (nodeId: string) => void
}

interface DensityFrameOptions {
  canvas: HTMLCanvasElement
  root: HTMLDivElement
  model: DensityOverviewModel
  viewport: ViewportTransform
  size: { width: number; height: number }
  progress: number
  activeGroupId: string | null
  isDarkMode: boolean
}

function drawDensityFrame({
  canvas,
  root,
  model,
  viewport,
  size,
  progress,
  activeGroupId,
  isDarkMode,
}: DensityFrameOptions): ProjectedDensityCard[] {
  if (progress <= 0) {
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    delete root.dataset.gridSpacing
    delete root.dataset.renderMs
    return []
  }
  if (size.width <= 0 || size.height <= 0) return []

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const pixelWidth = Math.round(size.width * dpr)
  const pixelHeight = Math.round(size.height * dpr)
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
  }

  const context = canvas.getContext('2d')
  if (!context) return []
  context.setTransform(dpr, 0, 0, dpr, 0, 0)

  const projectedCards = model.cards.map(card => projectDensityCard(card, viewport))
  const spacing = getAdaptiveGridSpacing(model.cards.length)
  const visibleCards = projectedCards.filter(card => (
    card.screenX + card.radius >= -spacing
    && card.screenX - card.radius <= size.width + spacing
    && card.screenY + card.radius >= -spacing
    && card.screenY - card.radius <= size.height + spacing
  ))
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
  root.dataset.progress = progress.toFixed(3)
  return projectedCards
}

export function DensityOverviewLayer({
  nodes,
  edges,
  progress,
  progressRef,
  viewportRef,
  frameSchedulerRef,
  isDarkMode,
  onFocusNode,
}: DensityOverviewLayerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodeLookup = useReactFlowStore(state => state.nodeLookup)
  const storeApi = useStoreApi()
  const clusterResult = useZustandStore(embeddingStore, state => state.clusterResult)
  // 在组件内部订阅卡片，避免父级 ReactFlowCanvas 常驻订阅全量 cards
  //（否则编辑时每次内容落盘都会触发画布整树重渲染）。
  const cards = useZustandStore(useCardStore, state => state.cards)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [hoverGroupId, setHoverGroupId] = useState<string | null>(null)
  const [pinnedGroupId, setPinnedGroupId] = useState<string | null>(null)
  const [activeCardId, setActiveCardId] = useState<string | null>(null)
  const [moving, setMoving] = useState(false)
  const movementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  const projectedCardsRef = useRef<ProjectedDensityCard[]>([])
  const projectionRevisionRef = useRef(0)
  const [projectionRevision, setProjectionRevision] = useState(0)

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
  const activeGroupId = pinnedGroupId ?? (moving ? null : hoverGroupId)
  const activeGroup = activeGroupId ? model.groupById.get(activeGroupId) ?? null : null
  const modelRef = useRef(model)
  const sizeRef = useRef(size)
  const activeGroupIdRef = useRef(activeGroupId)
  const isDarkModeRef = useRef(isDarkMode)
  const pinnedGroupIdRef = useRef(pinnedGroupId)
  modelRef.current = model
  sizeRef.current = size
  activeGroupIdRef.current = activeGroupId
  isDarkModeRef.current = isDarkMode
  pinnedGroupIdRef.current = pinnedGroupId

  const renderFrameRef = useRef<() => void>(() => undefined)
  const renderFrameIdRef = useRef<number | null>(null)
  const scheduleFrame = useCallback(() => {
    if (renderFrameIdRef.current !== null) return
    renderFrameIdRef.current = requestAnimationFrame(() => {
      renderFrameIdRef.current = null
      renderFrameRef.current()
    })
  }, [])

  renderFrameRef.current = () => {
    const canvas = canvasRef.current
    const root = rootRef.current
    if (!canvas || !root) return
    projectedCardsRef.current = drawDensityFrame({
      canvas,
      root,
      model: modelRef.current,
      viewport: (() => {
        const visualViewport = viewportRef.current
        if (visualViewport) return visualViewport
        const [x, y, zoom] = storeApi.getState().transform
        return { x, y, zoom }
      })(),
      size: sizeRef.current,
      progress: progressRef.current,
      activeGroupId: activeGroupIdRef.current,
      isDarkMode: isDarkModeRef.current,
    })
  }

  useEffect(() => {
    frameSchedulerRef.current = scheduleFrame
    return () => {
      if (frameSchedulerRef.current === scheduleFrame) frameSchedulerRef.current = null
    }
  }, [frameSchedulerRef, scheduleFrame])

  const activeCards = useMemo(
    () => activeGroup
      ? projectedCardsRef.current.filter(card => card.groupId === activeGroup.id)
      : [],
    [activeGroup, model, projectionRevision],
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
    let previous = storeApi.getState().transform
    const handleStoreChange = () => {
      const next = storeApi.getState().transform
      if (previous[0] === next[0] && previous[1] === next[1] && previous[2] === next[2]) return
      const zoomChanged = previous[2] !== next[2]
      previous = next
      scheduleFrame()
      setMoving(true)
      setHoverGroupId(null)
      if (zoomChanged) setPinnedGroupId(null)
      if (pinnedGroupIdRef.current !== null) {
        projectionRevisionRef.current += 1
        setProjectionRevision(projectionRevisionRef.current)
      }
      if (movementTimerRef.current) clearTimeout(movementTimerRef.current)
      movementTimerRef.current = setTimeout(() => {
        setMoving(false)
        const pointer = pointerRef.current
        if (pointer) setHoverGroupId(hitTestDensityGroup(projectedCardsRef.current, pointer))
      }, 120)
    }

    const unsubscribe = storeApi.subscribe(handleStoreChange)
    scheduleFrame()
    return () => {
      unsubscribe()
      if (renderFrameIdRef.current !== null) cancelAnimationFrame(renderFrameIdRef.current)
      if (movementTimerRef.current) clearTimeout(movementTimerRef.current)
    }
  }, [scheduleFrame, storeApi])

  useEffect(() => {
    scheduleFrame()
  }, [activeGroupId, isDarkMode, model, progress, scheduleFrame, size])

  useEffect(() => {
    if (progress >= 0.72) return
    setHoverGroupId(null)
    setPinnedGroupId(null)
    setActiveCardId(null)
  }, [progress])

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
      setHoverGroupId(hitTestDensityGroup(projectedCardsRef.current, point))
    }
    const handlePointerLeave = () => {
      pointerRef.current = null
      if (!pinnedGroupId) setHoverGroupId(null)
    }
    const handleClick = (event: Event) => {
      if ((event.target as Element | null)?.closest('.density-overview-drawer')) return
      const groupId = hitTestDensityGroup(projectedCardsRef.current, pointFromEvent(event as MouseEvent))
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
  }, [moving, pinnedGroupId, progress])

  return (
    <div
      ref={rootRef}
      className="density-overview-layer"
      data-testid="density-overview-layer"
      data-progress={progressRef.current.toFixed(3)}
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
