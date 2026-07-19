import { extractPreviewTextFromHTML } from '../utils/cardPreview'

const COLLAPSED_TITLE_LENGTH = 24
const COLLAPSED_BODY_LENGTH = 120

export interface CollapsedCardText {
  title: string
  body: string
}

function collectInlineText(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const record = value as Record<string, unknown>
  const ownText = typeof record.text === 'string' ? record.text : ''
  const children = Array.isArray(record.content)
    ? record.content.map(collectInlineText).join('')
    : ''
  return `${ownText}${children}`
}

function limitText(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1).trim()}…`
}

export function extractCollapsedCardText(content: string, previewHTML: string): CollapsedCardText {
  try {
    const blocks = JSON.parse(content) as unknown
    if (Array.isArray(blocks) && blocks.length > 0) {
      return {
        title: limitText(collectInlineText(blocks[0]), COLLAPSED_TITLE_LENGTH),
        body: limitText(
          blocks.slice(1).map(collectInlineText).filter(Boolean).join(' '),
          COLLAPSED_BODY_LENGTH,
        ),
      }
    }
  } catch {
    // Fall back to the existing HTML preview for legacy or malformed content.
  }

  return {
    title: '',
    body: extractPreviewTextFromHTML(previewHTML, COLLAPSED_BODY_LENGTH),
  }
}
