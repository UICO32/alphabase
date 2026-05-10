/**
 * Converts BlockNote JSON blocks array to preview HTML.
 * Used for rendering card previews when not in edit mode.
 */

function renderBlock(block: Record<string, unknown>): string {
  const type = block.type as string
  const props = block.props as Record<string, unknown> | undefined
  const content = block.content as unknown[] | undefined

  const renderedContent = content ? content.map((c) => renderInlineContent(c as Record<string, unknown>)).join('') : ''

  switch (type) {
    case 'heading': {
      const level = (props?.level as number) || 2
      return `<h${level} style="font-size:${level === 1 ? '1.25em' : level === 2 ? '1.1em' : '1em'};font-weight:600;margin:0.3em 0">${renderedContent}</h${level}>`
    }
    case 'paragraph':
      return `<p style="margin:0.2em 0">${renderedContent}</p>`
    case 'bulletListItem':
      return `<li style="margin:0.1em 0">${renderedContent}</li>`
    case 'numberedListItem':
      return `<li style="margin:0.1em 0">${renderedContent}</li>`
    case 'checkListItem':
      return `<li style="margin:0.1em 0;list-style-type:none"><input type="checkbox" ${props?.checked ? 'checked' : ''} disabled /> ${renderedContent}</li>`
    case 'image': {
      const url = props?.url as string
      return url ? `<img src="${url}" style="max-width:100%;height:auto;border-radius:4px" />` : ''
    }
    default:
      return renderedContent ? `<div>${renderedContent}</div>` : ''
  }
}

function renderInlineContent(node: Record<string, unknown>): string {
  if (node.type === 'text') {
    let text = node.text as string
    const styles = node.styles as Record<string, unknown> | undefined
    if (styles?.bold) text = `<strong>${text}</strong>`
    if (styles?.italic) text = `<em>${text}</em>`
    if (styles?.strike) text = `<s>${text}</s>`
    if (styles?.code) text = `<code>${text}</code>`
    if (styles?.underline) text = `<u>${text}</u>`
    return text
  }
  if (node.type === 'link') {
    const href = node.href as string
    return `<a href="${href}">${(node.content as unknown[])?.map((c) => renderInlineContent(c as Record<string, unknown>)).join('') || href}</a>`
  }
  return ''
}

export function renderBlocksToHTML(content: string): string {
  if (!content) return ''
  try {
    const blocks = JSON.parse(content)
    if (!Array.isArray(blocks)) return ''
    return blocks.map((b) => renderBlock(b as Record<string, unknown>)).join('\n')
  } catch {
    return content
  }
}
