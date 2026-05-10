import { useViewport } from '@xyflow/react'
import { useLibraryStore } from '../../utils/libraryStore'

const DOT_SPACING = 40
const DOT_RADIUS = 1.2
const BLOCK_SIZE = DOT_SPACING * 4

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

export function DotPatternBackground() {
  const { x, y, zoom } = useViewport()
  const isDarkMode = useLibraryStore((s) => s.isDarkMode)

  const dotColor = isDarkMode ? '#ffffff' : '#18181b'
  const baseAlpha = isDarkMode ? 0.10 : 0.18

  const otherOpacity = smoothstep(0.25, 0.75, zoom) * baseAlpha
  const cornerOpacity = baseAlpha

  const ox = ((x % BLOCK_SIZE) + BLOCK_SIZE) % BLOCK_SIZE
  const oy = ((y % BLOCK_SIZE) + BLOCK_SIZE) % BLOCK_SIZE

  const SP = DOT_SPACING

  return (
    <svg className="react-flow__background">
      <defs>
        <pattern
          id="hepta-dot-pattern"
          x={ox}
          y={oy}
          width={BLOCK_SIZE}
          height={BLOCK_SIZE}
          patternUnits="userSpaceOnUse"
        >
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2, 3].map((c) => {
              const isCorner = (r === 0 || r === 3) && (c === 0 || c === 3)
              return (
                <circle
                  key={`${r}-${c}`}
                  cx={c * SP}
                  cy={r * SP}
                  r={DOT_RADIUS}
                  fill={dotColor}
                  opacity={isCorner ? cornerOpacity : otherOpacity}
                />
              )
            }),
          )}
        </pattern>
      </defs>
      <rect x={0} y={0} width="100%" height="100%" fill="url(#hepta-dot-pattern)" />
    </svg>
  )
}
