import TurndownService from 'turndown'

let turndown: TurndownService | null = null

function getTurndown(): TurndownService {
  if (!turndown) {
    turndown = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
    })
  }
  return turndown
}

const FONT = 'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; line-height: 1.5;'

/**
 * Minimal BlockNote block renderer for electron main process.
 * Handles the common block types; unknown blocks render their text content.
 */
function renderBlock(block: Record<string, unknown>): string {
  const type = block.type as string
  const content = block.content as Record<string, unknown> | undefined
  const props = block.props as Record<string, unknown> | undefined

  switch (type) {
    case 'heading': {
      const level = (props?.level as number) || 1
      const text = inlineContentToHTML(content)
      return `<h${level}>${text}</h${level}>`
    }
    case 'paragraph': {
      const text = inlineContentToHTML(content)
      return `<p>${text}</p>`
    }
    case 'bulletListItem':
    case 'numberedListItem': {
      const text = inlineContentToHTML(content)
      return `<li>${text}</li>`
    }
    case 'checkListItem': {
      const checked = props?.checked as boolean
      const text = inlineContentToHTML(content)
      return `<li>${checked ? '✓' : '○'} ${text}</li>`
    }
    case 'codeBlock': {
      const code = (props?.code as string) || ''
      const lang = (props?.language as string) || ''
      return `<pre><code class="language-${lang}">${escapeHTML(code)}</code></pre>`
    }
    case 'quote': {
      const text = inlineContentToHTML(content)
      return `<blockquote>${text}</blockquote>`
    }
    case 'image': {
      const caption = (props?.caption as string) || ''
      return caption ? `<p>${escapeHTML(caption)}</p>` : ''
    }
    case 'table': {
      const rows = block.content as unknown[] | undefined
      if (!Array.isArray(rows)) return ''
      return rows.map(row => {
        if (!row || typeof row !== 'object') return ''
        const cells = (row as Record<string, unknown>).content as unknown[] | undefined
        if (!Array.isArray(cells)) return ''
        return '<tr>' + cells.map(cell => {
          if (!cell || typeof cell !== 'object') return '<td></td>'
          const cellContent = (cell as Record<string, unknown>).content as Record<string, unknown> | undefined
          return `<td>${inlineContentToHTML(cellContent)}</td>`
        }).join('') + '</tr>'
      }).join('')
    }
    default: {
      const text = inlineContentToHTML(content)
      return text ? `<p>${text}</p>` : ''
    }
  }
}

function inlineContentToHTML(content: Record<string, unknown> | undefined): string {
  if (!content) return ''
  // content can be a single inline item or an array of inline items
  const items = Array.isArray(content) ? content as Record<string, unknown>[] : [content]
  const parts = items.map(item => {
    const styles = item.styles as string[] | undefined
    const text = item.text as string | undefined
    if (!text) return ''
    let html = escapeHTML(text)
    if (styles) {
      for (const style of styles) {
        switch (style) {
          case 'bold': html = `<strong>${html}</strong>`; break
          case 'italic': html = `<em>${html}</em>`; break
          case 'underline': html = `<u>${html}</u>`; break
          case 'strike': html = `<s>${html}</s>`; break
          case 'code': html = `<code>${html}</code>`; break
        }
      }
    }
    return html
  })
  return parts.join('')
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function blocksToHTML(content: string): string {
  if (!content) return ''
  try {
    const blocks = JSON.parse(content)
    if (!Array.isArray(blocks) || blocks.length === 0) return ''
    const inner = (blocks as Record<string, unknown>[]).map(b => renderBlock(b)).join('')
    return `<div style="${FONT}">${inner}</div>`
  } catch {
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br />')
  }
}

/**
 * BlockNote JSON blocks → Markdown text
 * Path: JSON string → HTML → Markdown (turndown)
 */
export function extractMarkdown(blocksJson: string): string {
  if (!blocksJson) return ''
  try {
    const html = blocksToHTML(blocksJson)
    const markdown = getTurndown().turndown(html)
    return markdown.trim()
  } catch {
    return ''
  }
}

/**
 * Extract text from card content for vectorization.
 * Truncates long text (jina v5 max 8192 tokens, conservatively truncate to ~6000 chars)
 */
export function extractEmbeddingText(blocksJson: string): string {
  const md = extractMarkdown(blocksJson)
  if (md.length > 6000) {
    return md.slice(0, 6000)
  }
  return md
}