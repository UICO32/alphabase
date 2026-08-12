import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useStore, type Viewport } from '@xyflow/react'

export type GridPattern = 'cross' | 'dot' | 'circle' | 'triangle'

const BASE_GAP = 25
const MAX_OPACITY = 1

const gridSteps = [
  { min: -1,   mid: 0.15, step: 27 },
  { min: 0.05, mid: 0.375, step: 9 },
  { min: 0.15, mid: 1,    step: 3 },
  { min: 0.7,  mid: 4,    step: 1 },
]

function modulate(value: number, rangeA: number[], rangeB: number[]) {
  const [fromLow, fromHigh] = rangeA
  const [v0, v1] = rangeB
  return v0 + ((value - fromLow) / (fromHigh - fromLow)) * (v1 - v0)
}

function stepOpacity(z: number, min: number, mid: number) {
  if (z < min) return 0
  if (z >= mid) return 1
  return modulate(z, [min, mid], [0, 1])
}

function PatternShape({ pattern, color, cx, cy, size: _size }: {
  pattern: GridPattern
  color: string
  cx: number
  cy: number
  size: number
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

export function AdaptiveBackground({
  color,
  pattern = 'cross',
  visualViewportRef,
  frameSchedulerRef,
}: AdaptiveBackgroundProps) {
  const transform = useStore((s) => s.transform)
  const patternId = 'hepta-grid-pattern'
  const svgRef = useRef<SVGSVGElement>(null)
  const patternRefs = useRef<Array<SVGPatternElement | null>>([])
  const shapeRefs = useRef<Array<SVGGElement | null>>([])

  const [tx, ty, z] = transform

  const renderViewport = useCallback((viewport: Viewport) => {
    const svg = svgRef.current
    if (!svg) return

    gridSteps.forEach((gs, index) => {
      const patternElement = patternRefs.current[index]
      const shapeElement = shapeRefs.current[index]
      if (!patternElement || !shapeElement) return

      const opacity = stepOpacity(viewport.zoom, gs.min, gs.mid) * MAX_OPACITY
      const scaledGap = gs.step * BASE_GAP * viewport.zoom
      const scaledOffset = scaledGap / 2

      patternElement.setAttribute('x', String(viewport.x % scaledGap))
      patternElement.setAttribute('y', String(viewport.y % scaledGap))
      patternElement.setAttribute('width', String(scaledGap))
      patternElement.setAttribute('height', String(scaledGap))
      patternElement.setAttribute('patternTransform', `translate(-${scaledOffset},-${scaledOffset})`)
      shapeElement.setAttribute('transform', `translate(${scaledOffset},${scaledOffset})`)
      shapeElement.setAttribute('opacity', String(opacity))
    })
  }, [])

  useEffect(() => {
    renderViewport(visualViewportRef?.current ?? { x: tx, y: ty, zoom: z })
  }, [renderViewport, tx, ty, z, visualViewportRef])

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
      {gridSteps.map((gs, index) => (
        <pattern
          key={`${patternId}-grid-${index}`}
          ref={(element) => { patternRefs.current[index] = element }}
          id={`${patternId}-grid-${index}`}
          x="0"
          y="0"
          width={BASE_GAP * gs.step * z}
          height={BASE_GAP * gs.step * z}
          patternUnits="userSpaceOnUse"
          patternTransform={`translate(-${BASE_GAP * gs.step * z / 2},-${BASE_GAP * gs.step * z / 2})`}
        >
          <g
            ref={(element) => { shapeRefs.current[index] = element }}
            transform={`translate(${BASE_GAP * gs.step * z / 2},${BASE_GAP * gs.step * z / 2})`}
            opacity={stepOpacity(z, gs.min, gs.mid) * MAX_OPACITY}
          >
            <PatternShape
              pattern={pattern}
              color={color}
              cx={0}
              cy={0}
              size={BASE_GAP * gs.step * z}
            />
          </g>
        </pattern>
      ))}
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
}
