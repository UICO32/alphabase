/**
 * Converts BlockNote JSON blocks array to preview HTML.
 * Styles match BlockNote v0.31 + Mantine theme at 13px base font size.
 */

const BLOCK_STYLE = 'margin:0 0 2px;line-height:1.5'
const FONT =
  "font-family:Inter,'SF Pro Display',-apple-system,BlinkMacSystemFont,'Open Sans','Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,'Fira Sans','Droid Sans','Helvetica Neue',sans-serif"

function renderBlock(block: Record<string, unknown>): string {
  const type = block.type as string
  const props = block.props as Record<string, unknown> | undefined
  const content = block.content as unknown[] | undefined
  const children = block.children as unknown[] | undefined

  const renderedContent = content
    ? content.map((c) => renderInlineContent(c as Record<string, unknown>)).join('')
    : ''
  const renderedChildren = children
    ? children.map((c) => renderBlock(c as Record<string, unknown>)).join('')
    : ''

  switch (type) {
    case 'heading': {
      const level = (props?.level as number) || 2
      // BlockNote Mantine CSS: --level: 3em (h1), 2em (h2), 1.3em (h3)
      const sizes: Record<number, string> = { 1: '3em', 2: '2em', 3: '1.3em' }
      return `<h${level} style="font-size:${sizes[level] || '1.3em'};font-weight:700;${BLOCK_STYLE};${FONT}">${renderedContent}</h${level}>${renderedChildren}`
    }
    case 'paragraph':
      return `<p style="${BLOCK_STYLE};${FONT}">${renderedContent || '<br />'}</p>${renderedChildren}`
    case 'bulletListItem':
      return `<li style="${BLOCK_STYLE};${FONT};list-style-type:disc">${renderedContent}</li>${renderedChildren}`
    case 'numberedListItem':
      return `<li style="${BLOCK_STYLE};${FONT}">${renderedContent}</li>${renderedChildren}`
    case 'checkListItem':
      return `<li style="${BLOCK_STYLE};${FONT};list-style-type:none;display:flex;align-items:flex-start;gap:4px"><input type="checkbox" ${props?.checked ? 'checked' : ''} disabled style="margin-top:2px;flex-shrink:0" /><span>${renderedContent || '<br />'}</span></li>${renderedChildren}`
    case 'image': {
      const url = props?.url as string
      const caption = props?.caption as string | undefined
      const img = url
        ? `<img src="${url}" style="max-width:100%;height:auto;border-radius:6px;display:block;margin:4px 0" />`
        : ''
      const cap = caption
        ? `<p style="font-size:0.85em;opacity:0.6;${BLOCK_STYLE};${FONT}">${escapeHTML(caption)}</p>`
        : ''
      return `<div style="${BLOCK_STYLE};${FONT}">${img}${cap}</div>${renderedChildren}`
    }
    default:
      return renderedContent
        ? `<div style="${BLOCK_STYLE};${FONT}">${renderedContent}</div>${renderedChildren}`
        : renderedChildren
  }
}

function renderInlineContent(node: Record<string, unknown>): string {
  if (node.type === 'text') {
    let text = escapeHTML((node.text as string) || '')
    const styles = node.styles as Record<string, unknown> | undefined
    if (!styles) return text
    if (styles.bold) text = `<strong>${text}</strong>`
    if (styles.italic) text = `<em>${text}</em>`
    if (styles.strike) text = `<s>${text}</s>`
    if (styles.code)
      text = `<code style="font-size:0.875em;background:rgba(0,0,0,0.06);border-radius:3px;padding:0 3px;font-family:ui-monospace,monospace">${text}</code>`
    if (styles.underline) text = `<u>${text}</u>`
    return text
  }
  if (node.type === 'link') {
    const href = escapeHTML((node.href as string) || '')
    const linkContent =
      (node.content as unknown[])
        ?.map((c) => renderInlineContent(c as Record<string, unknown>))
        .join('') || href
    return `<a href="${href}" style="color:inherit;text-decoration:underline">${linkContent}</a>`
  }
  return ''
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderBlocksToHTML(content: string): string {
  if (!content) return ''
  try {
    const blocks = JSON.parse(content)
    if (!Array.isArray(blocks) || blocks.length === 0) return ''
    const inner = blocks.map((b) => renderBlock(b as Record<string, unknown>)).join('')
    return `<div style="${FONT}">${inner}</div>`
  } catch {
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br />')
  }
}
