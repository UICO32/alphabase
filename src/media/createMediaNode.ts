import type { Node } from '@xyflow/react'
import type { MediaNodeData } from '../types/card'
import { generateId } from '../utils/fileUtils'
import type { StoredWorkspaceMedia } from './mediaTypes'

function getInitialSize(asset: StoredWorkspaceMedia) {
  if (!asset.width || !asset.height) return { width: 320, height: 220 }
  const width = Math.min(asset.width, 800)
  return { width, height: Math.max(1, Math.round(width * asset.height / asset.width)) }
}

export function createMediaNode(asset: StoredWorkspaceMedia, position: { x: number; y: number }): Node<MediaNodeData> {
  const size = getInitialSize(asset)
  return {
    id: generateId('media'),
    type: 'media',
    position,
    data: {
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
    width: size.width,
    height: size.height,
  }
}
