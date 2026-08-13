import { DEFAULT_ANNOTATION_CONTENT } from '../types/card'

const INVISIBLE_TEXT = /[\s\u00a0\u200b\u200c\u200d\ufeff]/g

function collectText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(collectText).join('')
  if (!value || typeof value !== 'object') return ''

  const record = value as Record<string, unknown>
  return `${typeof record.text === 'string' ? record.text : ''}${collectText(record.content)}${collectText(record.children)}`
}

function hasVisibleText(value: unknown): boolean {
  return collectText(value).replace(INVISIBLE_TEXT, '').length > 0
}

export function annotationContentToText(content: string): string {
  try {
    const document = JSON.parse(content)
    if (!Array.isArray(document)) return ''
    return document.map(block => collectText(block)).join('\n')
  } catch {
    return content
  }
}

export function annotationTextToContent(text: string): string {
  const normalized = text.replace(/\r\n?/g, '\n')
  return JSON.stringify(normalized.split('\n').map(line => ({
    type: 'paragraph',
    content: line.length > 0
      ? [{ type: 'text', text: line, styles: {} }]
      : [],
  })))
}

export function normalizeAnnotationContent(content: string): {
  content: string
  isEmpty: boolean
} {
  try {
    const document = JSON.parse(content)
    if (!Array.isArray(document)) {
      return { content: DEFAULT_ANNOTATION_CONTENT, isEmpty: true }
    }

    // Text annotations are intentionally compact: discard empty paragraph
    // blocks on commit so repeated Enter presses do not leave visual gaps.
    const nonEmptyBlocks = document.filter(hasVisibleText)
    if (nonEmptyBlocks.length === 0) {
      return { content: DEFAULT_ANNOTATION_CONTENT, isEmpty: true }
    }

    return { content: JSON.stringify(nonEmptyBlocks), isEmpty: false }
  } catch {
    return { content: DEFAULT_ANNOTATION_CONTENT, isEmpty: true }
  }
}
