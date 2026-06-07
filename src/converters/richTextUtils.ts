export const SAVE_DEBOUNCE_MS = 400

// Deprecated: import directly from '../utils/fileUtils' instead
export { fileToDataUrl, isImageFile } from '../utils/fileUtils'

export function isReadableImageUrl(url: string) {
  return url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')
}

export async function readClipboardImageFiles() {
  if (typeof navigator === 'undefined' || typeof navigator.clipboard?.read !== 'function') {
    return []
  }

  try {
    const clipboardItems = await navigator.clipboard.read()
    const files: File[] = []

    for (const item of clipboardItems) {
      for (const type of item.types) {
        if (!type.startsWith('image/')) continue
        const blob = await item.getType(type)
        const extension = type.split('/')[1] || 'png'
        files.push(new File([blob], `pasted-image.${extension}`, { type: blob.type || type }))
      }
    }

    return files
  } catch {
    return []
  }
}

export function parseContentToBlocks(content: string): unknown[] | undefined {
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed) && parsed.length > 0) {
      migrateLinkStyles(parsed)
      return parsed
    }
  } catch {
    const text = content.trim()
    if (text) {
      return [{ type: 'paragraph', content: [{ type: 'text', text }] }]
    }
  }
  return undefined
}

function migrateLinkStyles(blocks: unknown[]) {
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue
    const record = block as Record<string, unknown>
    if (Array.isArray(record.content)) {
      record.content = migrateInlineContent(record.content)
    }
    if (Array.isArray(record.children)) {
      migrateLinkStyles(record.children)
    }
  }
}

function migrateInlineContent(items: unknown[]): unknown[] {
  const result: unknown[] = []
  for (const item of items) {
    if (!item || typeof item !== 'object') { result.push(item); continue }
    const record = item as Record<string, unknown>
    if (record.type === 'link' && Array.isArray(record.content)) {
      record.content = migrateInlineContent(record.content)
      result.push(record)
      continue
    }
    if (record.type === 'text' && record.styles && typeof record.styles === 'object') {
      const styles = record.styles as Record<string, unknown>
      if ('link' in styles && typeof styles.link === 'string') {
        const href = styles.link
        const { link, ...restStyles } = styles
        result.push({
          type: 'link',
          href,
          content: [{ type: 'text', text: record.text, styles: restStyles }],
        })
        continue
      }
    }
    result.push(record)
  }
  return result
}

export function toComparableJson(value: unknown) {
  return JSON.stringify(value, (key, current) => {
    if (key === 'id') return undefined
    return current
  })
}

