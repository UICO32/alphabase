import DOMPurify from 'dompurify'

interface CardPreviewInput {
  content?: string
  title?: string
  previewHTML?: string
}

export interface CardPreviewSemantics {
  title: string | null
  bodyHTML: string
}

const ALLOWED_PREVIEW_URI = /^(?:(?:hepta-media|https?|mailto|tel|data):|[^a-zA-Z]|[^a-zA-Z]javascript:)/i

function normalizeVisibleText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function readInlineText(value: unknown): string {
  if (Array.isArray(value)) return value.map(readInlineText).join('')
  if (!value || typeof value !== 'object') return ''

  const item = value as { text?: unknown; content?: unknown }
  if (typeof item.text === 'string') return item.text
  return readInlineText(item.content)
}

function extractExplicitTitle(content?: string): string | null {
  if (!content) return null

  try {
    const blocks: unknown = JSON.parse(content)
    if (!Array.isArray(blocks)) return null

    for (const value of blocks) {
      if (!value || typeof value !== 'object') continue
      const block = value as { type?: unknown; content?: unknown }
      if (block.type !== 'heading') continue

      const text = normalizeVisibleText(readInlineText(block.content))
      if (text) return text
    }
  } catch {
    return null
  }

  return null
}

function removeDisplayedHeading(doc: Document): void {
  const nativeHeadings = Array.from(
    doc.body.querySelectorAll<HTMLElement>('[data-content-type="heading"]'),
  )
  const heading = nativeHeadings.find(element => normalizeVisibleText(element.textContent || ''))
    ?? Array.from(doc.body.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'))
      .find(element => normalizeVisibleText(element.textContent || ''))

  if (!heading) return

  let removed: HTMLElement = heading.closest<HTMLElement>('.bn-block-outer') ?? heading
  const parent = removed.parentElement
  removed.remove()

  let emptyAncestor = parent
  while (
    emptyAncestor
    && emptyAncestor !== doc.body
    && !normalizeVisibleText(emptyAncestor.textContent || '')
    && !emptyAncestor.querySelector('img, video, audio, iframe')
  ) {
    removed = emptyAncestor
    emptyAncestor = emptyAncestor.parentElement
    removed.remove()
  }
}

export function buildCardPreviewSemantics({
  content,
  previewHTML = '',
}: CardPreviewInput): CardPreviewSemantics {
  const title = extractExplicitTitle(content)
  const sanitizedHTML = DOMPurify.sanitize(previewHTML, {
    ALLOWED_URI_REGEXP: ALLOWED_PREVIEW_URI,
  })

  if (!title || !sanitizedHTML) {
    return { title, bodyHTML: sanitizedHTML }
  }

  try {
    const doc = new DOMParser().parseFromString(sanitizedHTML, 'text/html')
    removeDisplayedHeading(doc)
    return { title, bodyHTML: doc.body.innerHTML }
  } catch {
    return { title: null, bodyHTML: sanitizedHTML }
  }
}
