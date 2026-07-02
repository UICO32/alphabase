import { exists, mkdir, writeFile } from '../utils/workspace/fs'
import { formatMediaUrl } from './mediaUrl'
import type { StoreMediaResult, StoredMediaFile } from './mediaTypes'

function normalizeWorkspacePath(workspacePath: string) {
  return workspacePath.replace(/\\/g, '/').replace(/\/+$/, '')
}

export function mimeToExtension(mimeType: string) {
  const normalized = mimeType.toLowerCase()
  if (normalized === 'image/png') return 'png'
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'jpg'
  if (normalized === 'image/webp') return 'webp'
  if (normalized === 'image/gif') return 'gif'
  if (normalized === 'image/svg+xml') return 'svg'
  if (normalized === 'image/avif') return 'avif'
  if (normalized === 'image/bmp') return 'bmp'
  return 'bin'
}

export function getMediaFileName(mediaId: string, mimeType: string) {
  return `${mediaId}.${mimeToExtension(mimeType)}`
}

export function getMediaPath(workspacePath: string, fileName: string) {
  return `${normalizeWorkspacePath(workspacePath)}/media/${fileName}`
}

export function createMediaId() {
  return `media-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export async function ensureMediaDir(workspacePath: string) {
  const dir = `${normalizeWorkspacePath(workspacePath)}/media`
  if (!(await exists(dir))) {
    await mkdir(dir)
  }
  return dir
}

export async function storeMediaDataUrl(workspacePath: string, dataUrl: string, mimeType: string): Promise<StoreMediaResult> {
  const normalizedMimeType = mimeType || 'application/octet-stream'
  const mediaId = createMediaId()
  const fileName = getMediaFileName(mediaId, normalizedMimeType)

  await ensureMediaDir(workspacePath)
  await writeFile(getMediaPath(workspacePath, fileName), dataUrl)

  const file: StoredMediaFile = {
    id: mediaId,
    fileName,
    mimeType: normalizedMimeType,
    size: dataUrl.length,
    createdAt: Date.now(),
  }

  return {
    ref: { mediaId, name: fileName },
    url: formatMediaUrl(mediaId, fileName),
    file,
  }
}
