import type { StoredWorkspaceMedia } from './mediaTypes'

export interface PersistedMediaNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
  width?: number
  height?: number
}

type StoreInlineMedia = (dataUrl: string) => Promise<StoredWorkspaceMedia>

export function hasInlineMediaNodes(nodes: PersistedMediaNode[]) {
  return nodes.some((node) => node.type === 'media'
    && typeof node.data.url === 'string'
    && node.data.url.startsWith('data:image/'))
}

export async function migrateInlineMediaNodes(
  nodes: PersistedMediaNode[],
  store: StoreInlineMedia,
) {
  let changed = false
  const migrated = [] as PersistedMediaNode[]

  for (const node of nodes) {
    const url = node.data.url
    if (node.type !== 'media' || typeof url !== 'string' || !url.startsWith('data:image/')) {
      migrated.push(node)
      continue
    }

    const asset = await store(url)
    const displayWidth = asset.width ? Math.min(asset.width, 800) : node.width
    const displayHeight = asset.width && asset.height && displayWidth
      ? Math.max(1, Math.round(displayWidth * asset.height / asset.width))
      : node.height
    migrated.push({
      ...node,
      width: displayWidth,
      height: displayHeight,
      data: {
        ...node.data,
        url: asset.url,
        type: asset.kind,
        name: asset.name,
        assetId: asset.assetId,
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
        durationMs: asset.durationMs,
        posterUrl: asset.posterUrl,
        variants: asset.variants,
      },
    })
    changed = true
  }

  return { changed, nodes: changed ? migrated : nodes }
}
