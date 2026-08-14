import { fileToDataUrl } from '../utils/fileUtils'
import { dataUrlToBytes, storeMediaDataUrl } from './mediaStore'
import type { StoredWorkspaceMedia } from './mediaTypes'

const INLINE_DATA_URL_LIMIT = 128 * 1024

export function shouldStoreAsWorkspaceMedia(dataUrl: string) {
  return dataUrl.startsWith('data:image/') && dataUrl.length > INLINE_DATA_URL_LIMIT
}

export function getImageMimeType(dataUrl: string) {
  const match = /^data:([^;,]+)[;,]/.exec(dataUrl)
  return match?.[1] ?? 'application/octet-stream'
}

function getMediaStore() {
  if (typeof window === 'undefined') return null
  return window.electronAPI?.media ?? null
}

function inlineMedia(url: string, file: Pick<File, 'name' | 'size' | 'type'>): StoredWorkspaceMedia {
  const kind = file.type.startsWith('video/') ? 'video' : 'image'
  return {
    assetId: `inline-${file.size}`,
    kind,
    mimeType: file.type || getImageMimeType(url),
    name: file.name,
    size: file.size,
    url,
    variants: [],
  }
}

export async function storeMediaFileForWorkspace(
  workspacePath: string | null,
  file: File,
): Promise<StoredWorkspaceMedia> {
  const mediaStore = getMediaStore()
  if (workspacePath && mediaStore) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const asset = await mediaStore.store(workspacePath, {
      bytes,
      mimeType: file.type,
      name: file.name,
    })
    if (asset.kind !== 'video') return asset

    const { captureVideoPoster } = await import('./videoPoster')
    const poster = await captureVideoPoster(file)
    if (!poster) return asset
    asset.width = poster.width
    asset.height = poster.height
    asset.durationMs = poster.durationMs
    if (poster.blob) {
      try {
        const posterAsset = await mediaStore.store(workspacePath, {
          bytes: new Uint8Array(await poster.blob.arrayBuffer()),
          mimeType: poster.blob.type || 'image/webp',
          name: `${file.name}.poster.webp`,
        })
        asset.posterUrl = posterAsset.url
      } catch {
        // Playback remains usable when poster persistence fails.
      }
    }
    return asset
  }

  const url = await fileToDataUrl(file)
  if (!workspacePath || !shouldStoreAsWorkspaceMedia(url)) return inlineMedia(url, file)

  const result = await storeMediaDataUrl(workspacePath, url, file.type || getImageMimeType(url))
  return {
    assetId: result.file.id,
    kind: 'image',
    mimeType: result.file.mimeType,
    name: file.name,
    size: result.file.size,
    url: result.url,
    width: result.file.width,
    height: result.file.height,
    variants: [],
  }
}

export async function storeImageDataUrlForWorkspace(
  workspacePath: string,
  dataUrl: string,
): Promise<StoredWorkspaceMedia> {
  const mimeType = getImageMimeType(dataUrl)
  const bytes = dataUrlToBytes(dataUrl)
  const mediaStore = getMediaStore()
  if (mediaStore) {
    return mediaStore.store(workspacePath, {
      bytes,
      mimeType,
      name: `pasted.${mimeType.split('/')[1] || 'bin'}`,
    })
  }

  const result = await storeMediaDataUrl(workspacePath, dataUrl, mimeType)
  return {
    assetId: result.file.id,
    kind: 'image',
    mimeType,
    name: result.file.fileName,
    size: result.file.size,
    url: result.url,
    variants: [],
  }
}

export async function storeImageFileForWorkspace(workspacePath: string | null, file: File): Promise<string> {
  return (await storeMediaFileForWorkspace(workspacePath, file)).url
}
