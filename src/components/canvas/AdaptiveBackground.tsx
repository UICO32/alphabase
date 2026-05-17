import { useMemo } from 'react'
import { useStore } from '@xyflow/react'

const CROSS_SIZE = 6
const CROSS_WIDTH = 0.2
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

export function AdaptiveBackground({ color }: { color: string }) {
  const transform = useStore((s) => s.transform)
  const patternId = 'hepta-grid-pattern'

  const [tx, ty, z] = transform

  const layers = useMemo(() => {
    return gridSteps
      .map((gs, i) => {
        const opacity = stepOpacity(z, gs.min, gs.mid) * MAX_OPACITY
        if (opacity <= 0) return null
        // 与原生 Background 一致：scaledGap = gap * zoom
        const scaledGap = gs.step * BASE_GAP * z
        // 偏移：直接用 transform[0]/[1] 取模，不需要乘 z
        const x = tx % scaledGap
        const y = ty % scaledGap
        // patternTransform 偏移：与原生 Background 一致
        const scaledOffset = scaledGap / 2
        return { id: `${patternId}-grid-${i}`, scaledGap, x, y, scaledOffset, opacity }
      })
      .filter(Boolean) as { id: string; scaledGap: number; x: number; y: number; scaledOffset: number; opacity: number }[]
  }, [tx, ty, z, patternId])

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
    <svg className="react-flow__background" style={containerStyle}>
      {layers.map((layer) => (
        <pattern
          key={layer.id}
          id={layer.id}
          x={layer.x}
          y={layer.y}
          width={layer.scaledGap}
          height={layer.scaledGap}
          patternUnits="userSpaceOnUse"
          patternTransform={`translate(-${layer.scaledOffset},-${layer.scaledOffset})`}
        >
          <g opacity={layer.opacity}>
            {/* 横线 */}
            <rect
              x={layer.scaledGap / 2 - CROSS_SIZE / 2}
              y={layer.scaledGap / 2 - CROSS_WIDTH / 2}
              width={CROSS_SIZE}
              height={CROSS_WIDTH}
              fill={color}
            />
            {/* 竖线 */}
            <rect
              x={layer.scaledGap / 2 - CROSS_WIDTH / 2}
              y={layer.scaledGap / 2 - CROSS_SIZE / 2}
              width={CROSS_WIDTH}
              height={CROSS_SIZE}
              fill={color}
            />
          </g>
        </pattern>
      ))}
      {layers.map((layer) => (
        <rect
          key={`${layer.id}-rect`}
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill={`url(#${layer.id})`}
        />
      ))}
    </svg>
  )
}