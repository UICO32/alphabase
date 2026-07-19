import type { ClusterResult } from '../../../stores/embeddingStore'
import type { GlobalCard } from '../../../stores/cardStore'
import {
  DEFAULT_DENSITY_OVERVIEW_ZOOM_THRESHOLD,
  getDensityOverviewFullZoom,
} from './densityOverviewConfig'

export const OVERVIEW_INTERACTION_PROGRESS = 0.72

export interface DensitySourceCard {
  nodeId: string
  cardId: string
  x: number
  y: number
  width: number
  height: number
  card: GlobalCard
}

export interface DensitySourceEdge {
  source: string
  target: string
}

export interface DensityOverviewCard extends DensitySourceCard {
  center: { x: number; y: number }
  density: number
  textChars: number
  blockCount: number
  mediaCount: number
  tagCount: number
  edgeDegree: number
  groupId: string | null
  similarity: number | null
}

export interface DensityOverviewGroup {
  id: string
  label: string
  cardIds: string[]
  cohesion: number | null
  source: 'embedding' | 'fallback'
}

export interface DensityOverviewModel {
  cards: DensityOverviewCard[]
  groups: DensityOverviewGroup[]
  groupById: Map<string, DensityOverviewGroup>
}

export interface ViewportTransform {
  x: number
  y: number
  zoom: number
}

export interface ProjectedDensityCard extends DensityOverviewCard {
  screenX: number
  screenY: number
  radius: number
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

export function getDensityOverviewProgress(
  zoom: number,
  entryZoom = DEFAULT_DENSITY_OVERVIEW_ZOOM_THRESHOLD,
): number {
  const fullZoom = getDensityOverviewFullZoom(entryZoom)
  if (zoom >= entryZoom) return 0
  if (zoom <= fullZoom) return 1
  const t = clamp01((entryZoom - zoom) / (entryZoom - fullZoom))
  return t * t * (3 - 2 * t)
}

export function getAdaptiveGridSpacing(cardCount: number): number {
  if (cardCount <= 1000) return 18
  return Math.min(32, 18 * Math.sqrt(cardCount / 1000))
}

function collectContentStats(value: unknown, stats: { text: string[]; blocks: number; media: number }): void {
  if (typeof value === 'string') {
    stats.text.push(value)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectContentStats(item, stats)
    return
  }
  if (!value || typeof value !== 'object') return

  const record = value as Record<string, unknown>
  if (typeof record.type === 'string') {
    stats.blocks += 1
    if (/image|video|audio|file|attachment|embed/i.test(record.type)) stats.media += 1
  }
  for (const [key, item] of Object.entries(record)) {
    if (key === 'id' || key === 'color' || key === 'props') continue
    collectContentStats(item, stats)
  }
}

export function extractCardDensityStats(card: Pick<GlobalCard, 'content' | 'title' | 'tags'>): {
  textChars: number
  blockCount: number
  mediaCount: number
  tagCount: number
} {
  const stats = { text: [] as string[], blocks: 0, media: 0 }
  const content = card.content || ''
  try {
    collectContentStats(JSON.parse(content), stats)
  } catch {
    stats.text.push(content)
  }

  const plainText = `${card.title || ''} ${stats.text.join(' ')}`
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/[\s\p{P}\p{S}]+/gu, '')
  const markupMedia = content.match(/<(img|video|audio|iframe)\b|!\[[^\]]*\]\([^)]*\)|\b(hepta-media|https?):\/\/\S+\.(png|jpe?g|gif|webp|mp4|mp3|pdf)\b/gi)?.length ?? 0

  return {
    textChars: plainText.length,
    blockCount: Math.max(stats.blocks, content.trim() ? 1 : 0),
    mediaCount: stats.media + markupMedia,
    tagCount: card.tags?.length ?? 0,
  }
}

export function calculateInformationDensity(
  stats: { textChars: number; blockCount: number; mediaCount: number; tagCount: number },
  edgeDegree: number,
): number {
  const content = clamp01(Math.log1p(stats.textChars) / Math.log1p(8000))
  const structure = clamp01(
    0.55 * Math.log1p(stats.blockCount) / Math.log1p(80)
    + 0.30 * Math.log1p(stats.mediaCount) / Math.log1p(12)
    + 0.15 * Math.log1p(stats.tagCount) / Math.log1p(10),
  )
  const centrality = clamp01(Math.log1p(edgeDegree) / Math.log1p(12))
  return clamp01(0.58 * content + 0.17 * structure + 0.25 * centrality)
}

class DisjointSet {
  private readonly parent = new Map<string, string>()

  add(id: string) {
    if (!this.parent.has(id)) this.parent.set(id, id)
  }

  find(id: string): string {
    const parent = this.parent.get(id)
    if (!parent || parent === id) return id
    const root = this.find(parent)
    this.parent.set(id, root)
    return root
  }

  union(a: string, b: string) {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA !== rootB) this.parent.set(rootB, rootA)
  }
}

function stableGroupId(cardIds: string[]): string {
  let hash = 2166136261
  for (const char of [...cardIds].sort().join('|')) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return `fallback-${(hash >>> 0).toString(36)}`
}

function buildFallbackGroups(
  cards: DensitySourceCard[],
  edges: DensitySourceEdge[],
): DensityOverviewGroup[] {
  const byNodeId = new Map(cards.map(card => [card.nodeId, card]))
  const set = new DisjointSet()
  for (const card of cards) set.add(card.cardId)

  for (const edge of edges) {
    const source = byNodeId.get(edge.source)
    const target = byNodeId.get(edge.target)
    if (source && target) set.union(source.cardId, target.cardId)
  }

  const cardsByTag = new Map<string, string[]>()
  for (const card of cards) {
    for (const tag of card.card.tags ?? []) {
      if (typeof tag !== 'string') continue
      const normalized = tag.trim().toLocaleLowerCase()
      if (!normalized) continue
      const ids = cardsByTag.get(normalized) ?? []
      ids.push(card.cardId)
      cardsByTag.set(normalized, ids)
    }
  }
  for (const ids of cardsByTag.values()) {
    for (let index = 1; index < ids.length; index += 1) set.union(ids[0], ids[index])
  }

  const components = new Map<string, DensitySourceCard[]>()
  for (const card of cards) {
    const root = set.find(card.cardId)
    const members = components.get(root) ?? []
    members.push(card)
    components.set(root, members)
  }

  return [...components.values()]
    .filter(members => members.length >= 2)
    .map((members) => {
      const tagCounts = new Map<string, number>()
      for (const member of members) {
        for (const tag of member.card.tags ?? []) {
          if (typeof tag !== 'string') continue
          const normalized = tag.trim()
          if (!normalized) continue
          tagCounts.set(normalized, (tagCounts.get(normalized) ?? 0) + 1)
        }
      }
      const label = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
        ?? members[0].card.title
        ?? 'Related cards'
      const cardIds = members.map(member => member.cardId)
      return { id: stableGroupId(cardIds), label, cardIds, cohesion: null, source: 'fallback' as const }
    })
}

export function buildDensityOverviewModel(
  sourceCards: DensitySourceCard[],
  edges: DensitySourceEdge[],
  clusterResult: ClusterResult | null,
): DensityOverviewModel {
  const boardCardIds = new Set(sourceCards.map(card => card.cardId))
  const embeddingGroups: DensityOverviewGroup[] = (clusterResult?.clusters ?? [])
    .map(cluster => ({
      id: cluster.id,
      label: cluster.label,
      cardIds: cluster.cardIds.filter(cardId => boardCardIds.has(cardId)),
      cohesion: cluster.cohesion,
      source: 'embedding' as const,
    }))
    .filter(group => group.cardIds.length >= 2)
  const groups = clusterResult !== null ? embeddingGroups : buildFallbackGroups(sourceCards, edges)
  const groupById = new Map(groups.map(group => [group.id, group]))
  const membership = new Map<string, { groupId: string; similarity: number | null }>()

  for (const group of groups) {
    const source = clusterResult?.clusters.find(cluster => cluster.id === group.id)
    for (const cardId of group.cardIds) {
      membership.set(cardId, { groupId: group.id, similarity: source?.cardSimilarities[cardId] ?? null })
    }
  }

  const degreeByNodeId = new Map<string, number>()
  const nodeIds = new Set(sourceCards.map(card => card.nodeId))
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue
    degreeByNodeId.set(edge.source, (degreeByNodeId.get(edge.source) ?? 0) + 1)
    degreeByNodeId.set(edge.target, (degreeByNodeId.get(edge.target) ?? 0) + 1)
  }

  const cards = sourceCards.map((sourceCard) => {
    const stats = extractCardDensityStats(sourceCard.card)
    const edgeDegree = degreeByNodeId.get(sourceCard.nodeId) ?? 0
    const member = membership.get(sourceCard.cardId)
    return {
      ...sourceCard,
      center: { x: sourceCard.x + sourceCard.width / 2, y: sourceCard.y + sourceCard.height / 2 },
      ...stats,
      edgeDegree,
      density: calculateInformationDensity(stats, edgeDegree),
      groupId: member?.groupId ?? null,
      similarity: member?.similarity ?? null,
    }
  })

  return { cards, groups, groupById }
}

export function projectDensityCard(
  card: DensityOverviewCard,
  viewport: ViewportTransform,
  referenceZoom = getDensityOverviewFullZoom(),
): ProjectedDensityCard {
  return {
    ...card,
    screenX: card.center.x * viewport.zoom + viewport.x,
    screenY: card.center.y * viewport.zoom + viewport.y,
    radius: (64 + 126 * card.density) * (viewport.zoom / referenceZoom),
  }
}

export function hitTestDensityGroup(
  cards: ProjectedDensityCard[],
  point: { x: number; y: number },
): string | null {
  let bestGroup: string | null = null
  let bestStrength = 0
  for (const card of cards) {
    if (!card.groupId || card.radius <= 0) continue
    const distance = Math.hypot(point.x - card.screenX, point.y - card.screenY)
    if (distance > card.radius) continue
    const sigma = card.radius * 0.42
    const strength = Math.exp(-(distance * distance) / (2 * sigma * sigma)) * (0.68 + 0.32 * card.density)
    if (strength > bestStrength) {
      bestStrength = strength
      bestGroup = card.groupId
    }
  }
  return bestStrength >= 0.08 ? bestGroup : null
}
