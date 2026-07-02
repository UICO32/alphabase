import { getImageMimeType, shouldStoreAsWorkspaceMedia } from './imagePipeline'
import { storeMediaDataUrl } from './mediaStore'

type StoreInlineImage = (dataUrl: string, mimeType: string) => Promise<string>

export async function migrateInlineImagesInContent(content: string, storeInlineImage: StoreInlineImage) {
  let blocks: unknown
  try {
    blocks = JSON.parse(content)
  } catch {
    return { changed: false, content }
  }

  if (!Array.isArray(blocks)) {
    return { changed: false, content }
  }

  let changed = false
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue
    const props = (block as { props?: Record<string, unknown> }).props
    if (!props) continue
    const url = props?.url
    if (typeof url !== 'string' || !shouldStoreAsWorkspaceMedia(url)) continue
    props.url = await storeInlineImage(url, getImageMimeType(url))
    changed = true
  }

  return {
    changed,
    content: changed ? JSON.stringify(blocks) : content,
  }
}

export async function migrateInlineImagesForWorkspace(workspacePath: string, content: string) {
  return migrateInlineImagesInContent(content, async (dataUrl, mimeType) => {
    const result = await storeMediaDataUrl(workspacePath, dataUrl, mimeType)
    return result.url
  })
}
