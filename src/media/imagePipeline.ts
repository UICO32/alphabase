import { fileToDataUrl } from '../utils/fileUtils'
import { storeMediaDataUrl } from './mediaStore'

const INLINE_DATA_URL_LIMIT = 128 * 1024

export function shouldStoreAsWorkspaceMedia(dataUrl: string) {
  return dataUrl.startsWith('data:image/') && dataUrl.length > INLINE_DATA_URL_LIMIT
}

export function getImageMimeType(dataUrl: string) {
  const match = /^data:([^;,]+)[;,]/.exec(dataUrl)
  return match?.[1] ?? 'application/octet-stream'
}

export async function storeImageFileForWorkspace(workspacePath: string | null, file: File): Promise<string> {
  const dataUrl = await fileToDataUrl(file)
  if (!workspacePath || !shouldStoreAsWorkspaceMedia(dataUrl)) {
    return dataUrl
  }

  const result = await storeMediaDataUrl(workspacePath, dataUrl, file.type || getImageMimeType(dataUrl))
  return result.url
}
