import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStoreApi, type Viewport } from '@xyflow/react'

export type GridPattern = 'cross' | 'dot' | 'circle' | 'triangle'

const BASE_GAP = 25

const gridSteps = [
  { min: -1,   mid: 0.15, step: 27 },
  { min: 0.05, mid: 0.375, step: 9 },
  { min: 0.15, mid: 1,    step: 3 },
  { min: 0.7,  mid: 4,    step: 1 },
]

function stepOpacity(z: number, min: number, mid: number) {
  if (z < min) return 0
  if (z >= mid) return 1
  return (z - min) / (mid - min)
}

/** 每层网格在给定缩放下的间距/半格偏移/透明度。 */
function getGridLayers(zoom: number) {
  return gridSteps.map((gs) => {
    const gap = gs.step * BASE_GAP * zoom
    return { gap, offset: gap / 2, opacity: stepOpacity(zoom, gs.min, gs.mid) }
  })
}

function PatternShape({ pattern, color, cx, cy }: {
  pattern: GridPattern
  color: string
  cx: number
  cy: number
}) {
  switch (pattern) {
    case 'cross': {
      const arm = 6
      const w = 0.25
      return (
        <g>
          <rect x={cx - arm / 2} y={cy - w / 2} width={arm} height={w} fill={color} />
          <rect x={cx - w / 2} y={cy - arm / 2} width={w} height={arm} fill={color} />
        </g>
      )
    }
    case 'dot':
      return <rect x={cx - 0.5} y={cy - 0.5} width={1} height={1} fill={color} />
    case 'circle':
      return <circle cx={cx} cy={cy} r={1} fill={color} />
    case 'triangle': {
      const r = 1.5
      const h = r * Math.sqrt(3)
      const top = cy - h * 2 / 3
      const bottom = cy + h / 3
      return (
        <polygon
          points={`${cx},${top} ${cx - r},${bottom} ${cx + r},${bottom}`}
          fill={color}
        />
      )
    }
  }
}

interface AdaptiveBackgroundProps {
  color: string
  pattern?: GridPattern
  visualViewportRef?: { current: Viewport | null }
  frameSchedulerRef?: { current: (() => void) | null }
}

const patternId = 'hepta-grid-pattern'

/**
 * 只做绘制的网格层。
 *
 * 这里不订阅 React Flow 的 transform：平移/缩放的每一帧由画布通过 frameSchedulerRef
 * 调 renderViewport 直接改 SVG 属性。React 只在 color/pattern 变化时重渲染，
 * 避免视口每帧变化都带着整棵 SVG 树重渲染。
 */
export const AdaptiveBackground = memo(function AdaptiveBackground({
  color,
  pattern = 'cross',
  visualViewportRef,
  frameSchedulerRef,
}: AdaptiveBackgroundProps) {
  // 不订阅 transform，只在挂载时读一次首帧需要的视口。
  const store = useStoreApi()
  const [initialViewport] = useState<Viewport>(() => {
    const [x, y, zoom] = store.getState().transform
    return { x, y, zoom }
  })
  const initialLayers = useMemo(() => getGridLayers(initialViewport.zoom), [initialViewport.zoom])
  const svgRef = useRef<SVGSVGElement>(null)
  const patternRefs = useRef<Array<SVGPatternElement | null>>([])
  const shapeRefs = useRef<Array<SVGGElement | null>>([])

  const renderViewport = useCallback((viewport: Viewport) => {
    const svg = svgRef.current
    if (!svg) return

    getGridLayers(viewport.zoom).forEach((layer, index) => {
      const patternElement = patternRefs.current[index]
      const shapeElement = shapeRefs.current[index]
      if (!patternElement || !shapeElement) return

      patternElement.setAttribute('x', String(viewport.x % layer.gap))
      patternElement.setAttribute('y', String(viewport.y % layer.gap))
      patternElement.setAttribute('width', String(layer.gap))
      patternElement.setAttribute('height', String(layer.gap))
      patternElement.setAttribute('patternTransform', `translate(-${layer.offset},-${layer.offset})`)
      shapeElement.setAttribute('transform', `translate(${layer.offset},${layer.offset})`)
      shapeElement.setAttribute('opacity', String(layer.opacity))
    })
  }, [])

  useEffect(() => {
    renderViewport(visualViewportRef?.current ?? initialViewport)
  }, [renderViewport, initialViewport, visualViewportRef])

  useEffect(() => {
    if (!frameSchedulerRef) return
    const renderVisualViewport = () => {
      const viewport = visualViewportRef?.current
      if (viewport) renderViewport(viewport)
    }
    frameSchedulerRef.current = renderVisualViewport
    return () => {
      if (frameSchedulerRef.current === renderVisualViewport) frameSchedulerRef.current = null
    }
  }, [frameSchedulerRef, renderViewport, visualViewportRef])

  const containerStyle = useMemo(() => ({
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none' as const,
    zIndex: -1,
  }), [])

  return (
    <svg ref={svgRef} className="react-flow__background" style={containerStyle}>
      {gridSteps.map((_gs, index) => {
        const layer = initialLayers[index]
        return (
          <pattern
            key={`${patternId}-grid-${index}`}
            ref={(element) => { patternRefs.current[index] = element }}
            id={`${patternId}-grid-${index}`}
            x={String(initialViewport.x % layer.gap)}
            y={String(initialViewport.y % layer.gap)}
            width={layer.gap}
            height={layer.gap}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(-${layer.offset},-${layer.offset})`}
          >
            <g
              ref={(element) => { shapeRefs.current[index] = element }}
              transform={`translate(${layer.offset},${layer.offset})`}
              opacity={layer.opacity}
            >
              <PatternShape
                pattern={pattern}
                color={color}
                cx={0}
                cy={0}
              />
            </g>
          </pattern>
        )
      })}
      {gridSteps.map((_gs, index) => (
        <rect
          key={`${patternId}-grid-${index}-rect`}
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill={`url(#${patternId}-grid-${index})`}
        />
      ))}
    </svg>
  )
})
