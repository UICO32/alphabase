import { describe, expect, it } from 'vitest'
import type { ProjectedDensityCard } from './densityOverviewModel'
import { buildDensityGrid, getClusterColor } from './densityOverviewRenderer'

function projected(overrides: Partial<ProjectedDensityCard> = {}): ProjectedDensityCard {
  return {
    nodeId: 'node-a', cardId: 'a', x: 0, y: 0, width: 280, height: 200,
    card: { id: 'a', content: 'a', color: 'white', createdAt: 1 },
    center: { x: 140, y: 100 }, density: 1, textChars: 1, blockCount: 1,
    mediaCount: 0, tagCount: 0, edgeDegree: 0, groupId: 'group-a', similarity: 0.9,
    screenX: 99, screenY: 99, radius: 80,
    ...overrides,
  }
}

describe('density overview renderer model', () => {
  it('accumulates a radial field with a stronger center than edge', () => {
    const grid = buildDensityGrid([projected()], 200, 200, 18)
    const centerColumn = Math.round((99 - grid.offsetX) / grid.spacing)
    const centerRow = Math.round((99 - grid.offsetY) / grid.spacing)
    const center = grid.intensity[centerRow * grid.columns + centerColumn]
    const edge = grid.intensity[centerRow * grid.columns + Math.max(0, centerColumn - 4)]
    expect(center).toBeGreaterThan(edge)
    expect(edge).toBeGreaterThan(0)
  })

  it('keeps ungrouped fields visible without assigning a dominant group', () => {
    const grid = buildDensityGrid([projected({ groupId: null })], 200, 200, 18)
    expect(Math.max(...grid.intensity)).toBeGreaterThan(0)
    expect([...grid.dominantGroup].every(value => value === -1)).toBe(true)
  })

  it('caps overlapping intensity and deterministically tracks the strongest group', () => {
    const grid = buildDensityGrid([
      projected({ groupId: 'weaker', density: 0.2 }),
      projected({ nodeId: 'node-b', cardId: 'b', groupId: 'stronger', density: 1 }),
      projected({ nodeId: 'node-c', cardId: 'c', groupId: 'stronger', density: 1 }),
    ], 200, 200, 18)
    const max = Math.max(...grid.intensity)
    const maxIndex = [...grid.intensity].indexOf(max)
    expect(max).toBeCloseTo(1.35, 5)
    expect(grid.groupIds[grid.dominantGroup[maxIndex]]).toBe('stronger')
  })

  it('assigns stable colors by group id', () => {
    expect(getClusterColor('cluster-a')).toEqual(getClusterColor('cluster-a'))
    expect(getClusterColor('cluster-a')).not.toEqual(getClusterColor('cluster-c'))
  })
})
