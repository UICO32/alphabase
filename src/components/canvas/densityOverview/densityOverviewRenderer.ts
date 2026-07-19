import type { ProjectedDensityCard } from './densityOverviewModel'

export interface DensityGrid {
  columns: number
  rows: number
  spacing: number
  offsetX: number
  offsetY: number
  intensity: Float32Array
  dominantGroup: Int32Array
  groupIds: string[]
}

export interface DensityRenderTheme {
  background: string
  base: [number, number, number]
  peak: [number, number, number]
}

export const DARK_DENSITY_THEME: DensityRenderTheme = {
  background: '#090a0c',
  base: [86, 89, 94],
  peak: [232, 231, 226],
}

export const LIGHT_DENSITY_THEME: DensityRenderTheme = {
  background: '#eeece7',
  base: [164, 161, 154],
  peak: [48, 49, 51],
}

const CLUSTER_PALETTE: Array<[number, number, number]> = [
  [74, 134, 255],
  [236, 92, 129],
  [39, 177, 129],
  [221, 146, 45],
  [143, 103, 232],
  [39, 163, 190],
]

function hashString(value: string): number {
  let hash = 2166136261
  for (const char of value) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function getClusterColor(groupId: string): [number, number, number] {
  return CLUSTER_PALETTE[hashString(groupId) % CLUSTER_PALETTE.length]
}

export function buildDensityGrid(
  cards: ProjectedDensityCard[],
  width: number,
  height: number,
  spacing: number,
): DensityGrid {
  const columns = Math.max(1, Math.ceil(width / spacing) + 1)
  const rows = Math.max(1, Math.ceil(height / spacing) + 1)
  const cellCount = columns * rows
  const intensity = new Float32Array(cellCount)
  const dominance = new Float32Array(cellCount)
  const dominantGroup = new Int32Array(cellCount)
  dominantGroup.fill(-1)
  const groupIds = [...new Set(cards.flatMap(card => card.groupId ? [card.groupId] : []))]
  const groupIndex = new Map(groupIds.map((id, index) => [id, index]))
  const offsetX = spacing / 2
  const offsetY = spacing / 2

  for (const card of cards) {
    if (card.radius <= 0) continue
    const left = Math.max(0, Math.floor((card.screenX - card.radius - offsetX) / spacing))
    const right = Math.min(columns - 1, Math.ceil((card.screenX + card.radius - offsetX) / spacing))
    const top = Math.max(0, Math.floor((card.screenY - card.radius - offsetY) / spacing))
    const bottom = Math.min(rows - 1, Math.ceil((card.screenY + card.radius - offsetY) / spacing))
    if (right < 0 || bottom < 0 || left >= columns || top >= rows) continue

    const sigma = card.radius * 0.42
    const group = card.groupId ? groupIndex.get(card.groupId) ?? -1 : -1
    for (let row = top; row <= bottom; row += 1) {
      const y = offsetY + row * spacing
      for (let column = left; column <= right; column += 1) {
        const x = offsetX + column * spacing
        const dx = x - card.screenX
        const dy = y - card.screenY
        const distanceSquared = dx * dx + dy * dy
        if (distanceSquared > card.radius * card.radius) continue
        const strength = Math.exp(-distanceSquared / (2 * sigma * sigma)) * (0.68 + 0.32 * card.density)
        const index = row * columns + column
        intensity[index] = Math.min(1.35, intensity[index] + strength)
        if (group >= 0 && strength > dominance[index]) {
          dominance[index] = strength
          dominantGroup[index] = group
        }
      }
    }
  }

  return { columns, rows, spacing, offsetX, offsetY, intensity, dominantGroup, groupIds }
}

function mix(from: number, to: number, amount: number): number {
  return Math.round(from + (to - from) * amount)
}

export function drawDensityOverview(
  context: CanvasRenderingContext2D,
  grid: DensityGrid,
  width: number,
  height: number,
  progress: number,
  activeGroupId: string | null,
  theme: DensityRenderTheme,
): void {
  context.clearRect(0, 0, width, height)
  context.save()
  context.globalAlpha = progress
  context.fillStyle = theme.background
  context.fillRect(0, 0, width, height)

  const activeGroupIndex = activeGroupId ? grid.groupIds.indexOf(activeGroupId) : -1
  const activeColor = activeGroupId ? getClusterColor(activeGroupId) : null
  for (let row = 0; row < grid.rows; row += 1) {
    const y = grid.offsetY + row * grid.spacing
    if (y > height) break
    for (let column = 0; column < grid.columns; column += 1) {
      const x = grid.offsetX + column * grid.spacing
      if (x > width) break
      const index = row * grid.columns + column
      const strength = grid.intensity[index]
      const normalized = 1 - Math.exp(-1.55 * strength)
      const isActive = activeGroupIndex >= 0 && grid.dominantGroup[index] === activeGroupIndex && strength > 0.05
      const target = isActive && activeColor ? activeColor : theme.peak
      const colorAmount = 0.16 + normalized * 0.84
      const red = mix(theme.base[0], target[0], colorAmount)
      const green = mix(theme.base[1], target[1], colorAmount)
      const blue = mix(theme.base[2], target[2], colorAmount)
      const radius = 1.05 + normalized * 6.4
      const alpha = 0.26 + normalized * 0.7
      context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(3)})`
      context.beginPath()
      context.arc(x, y, radius, 0, Math.PI * 2)
      context.fill()
    }
  }

  const vignette = context.createRadialGradient(
    width * 0.5, height * 0.46, Math.min(width, height) * 0.18,
    width * 0.5, height * 0.5, Math.max(width, height) * 0.72,
  )
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, theme === DARK_DENSITY_THEME ? 'rgba(0,0,0,0.38)' : 'rgba(80,70,55,0.08)')
  context.fillStyle = vignette
  context.fillRect(0, 0, width, height)
  context.restore()
}
