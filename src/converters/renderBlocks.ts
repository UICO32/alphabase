/**
 * Converts BlockNote JSON blocks array to preview HTML.
 * Must match BlockNote v0.31 Mantine rendering exactly (WYSIWYG).
 */

const BLOCK_STYLE = 'padding:3px 0;margin:0;line-height:1.5'
const FONT =
  "font-family:Inter,'SF Pro Display',-apple-system,BlinkMacSystemFont,'Open Sans','Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,'Fira Sans','Droid Sans','Helvetica Neue',sans-serif"
const CODE_FONT = "font-family:ui-monospace,'SF Mono',Monaco,'Cascadia Code',Consolas,monospace"

const BN_TEXT_COLORS: Record<string, string> = {
  default: 'inherit',
  gray: '#9b9a97',
  brown: '#64473a',
  red: '#e03e3e',
  orange: '#d9730d',
  yellow: '#dfab01',
  green: '#4d6461',
  blue: '#0b6e99',
  purple: '#6940a5',
  pink: '#ad1a72',
}

const BN_BG_COLORS: Record<string, string> = {
  default: 'transparent',
  gray: '#ebeced',
  brown: '#e9e5e3',
  red: '#fbe4e4',
  orange: '#f6e9d9',
  yellow: '#fbf3db',
  green: '#ddedea',
  blue: '#ddebf1',
  purple: '#eae4f2',
  pink: '#f4dfeb',
}

function preprocessBlocks(blocks: Record<string, unknown>[]): Record<string, unknown>[] {
  let counter = 1
  return blocks.map((b) => {
    const type = b.type as string
    if (type === 'numberedListItem') {
      const result = { ...b, _numIndex: counter }
      counter++
      return result
    }
    counter = 1
    return b
  })
}

const BULLET_CHARS = ['•', '◦', '▪']

function renderBlock(block: Record<string, unknown>, depth = 0): string {
  const type = block.type as string
  const props = (block.props as Record<string, unknown>) || {}
  const rawContent = block.content
  const contentArray = Array.isArray(rawContent) ? (rawContent as unknown[]) : undefined
  const rawChildren = (block.children as unknown[]) || undefined
  const childrenArray = rawChildren
    ? preprocessBlocks(rawChildren as Record<string, unknown>[])
    : undefined

  const renderedContent = contentArray
    ? contentArray.map((c) => renderInlineContent(c as Record<string, unknown>)).join('')
    : ''
  const renderedChildren = childrenArray
    ? childrenArray.map((c) => renderBlock(c as Record<string, unknown>, depth + 1)).join('')
    : ''

  const textAlign = (props.textAlignment as string) || undefined
  const alignStyle = textAlign && textAlign !== 'left' ? `text-align:${textAlign};` : ''
  const cs = `${BLOCK_STYLE};${FONT};${alignStyle}`

  switch (type) {
    case 'heading': {
      const level = (props.level as number) || 2
      const sizes: Record<number, string> = { 1: '3em', 2: '2em', 3: '1.3em' }
      return `<h${level} style="font-size:${sizes[level] || '1.3em'};font-weight:700;${BLOCK_STYLE};${FONT}">${renderedContent}</h${level}>${renderedChildren}`
    }

    case 'paragraph':
      return `<p style="${cs}">${renderedContent || '<br />'}</p>${renderedChildren}`

    case 'quote':
      return `<blockquote style="${cs};border-left:3px solid rgba(0,0,0,0.15);padding-left:12px;margin:0;color:#7d797a;font-style:italic">${renderedContent || '<br />'}</blockquote>${renderedChildren}`

    case 'codeBlock': {
      const lang = (props.language as string) || 'text'
      return `<pre style="${BLOCK_STYLE};margin:0;background:#161616;border-radius:8px;padding:24px;overflow-x:auto"><code class="language-${escapeHTML(lang)}" style="${CODE_FONT};font-size:0.875em;line-height:1.6;color:#fff;tab-size:2;-moz-tab-size:2">${renderedContent || ''}</code></pre>${renderedChildren}`
    }

    case 'bulletListItem': {
      const bullet = BULLET_CHARS[Math.min(depth, BULLET_CHARS.length - 1)]
      const inner = renderedContent || ''
      const nested = renderedChildren ? `<div style="margin-left:1.5em">${renderedChildren}</div>` : ''
      return `<div style="${cs};display:flex;gap:0.5em"><span style="flex-shrink:0">${bullet}</span><div style="min-width:0;width:100%">${inner}</div></div>${nested}`
    }

    case 'numberedListItem': {
      const idx = (block as Record<string, unknown>)._numIndex as number || 1
      const inner = renderedContent || ''
      const nested = renderedChildren ? `<div style="margin-left:1.5em">${renderedChildren}</div>` : ''
      return `<div style="${cs};display:flex;gap:0.5em"><span style="flex-shrink:0">${idx}.</span><div style="min-width:0;width:100%">${inner}</div></div>${nested}`
    }

    case 'checkListItem': {
      const checked = !!props.checked
      const inner = renderedContent || '<br />'
      const nested = renderedChildren ? `<div style="margin-left:1.5em">${renderedChildren}</div>` : ''
      const textStyle = checked ? 'text-decoration:line-through' : ''
      return `<div style="${cs};display:flex;align-items:flex-start;gap:0.5em"><input type="checkbox" ${checked ? 'checked' : ''} disabled style="margin:0;cursor:pointer;flex-shrink:0" /><div style="min-width:0;width:100%"><span style="${textStyle}">${inner}</span></div></div>${nested}`
    }

    case 'image': {
      const url = props.url as string
      const caption = props.caption as string | undefined
      const img = url
        ? `<img src="${escapeHTML(url)}" style="max-width:100%;height:auto;border-radius:6px;display:block;margin:4px 0" />`
        : ''
      const cap = caption
        ? `<p style="font-size:0.85em;opacity:0.6;${cs}">${escapeHTML(caption)}</p>`
        : ''
      return `<div style="${cs}">${img}${cap}</div>${renderedChildren}`
    }

    case 'video': {
      const url = props.url as string
      const caption = props.caption as string | undefined
      const showPreview = props.showPreview !== false
      const media = url && showPreview
        ? `<video src="${escapeHTML(url)}" controls style="max-width:100%;border-radius:6px;display:block;margin:4px 0;height:auto" />`
        : url && !showPreview
          ? `<a href="${escapeHTML(url)}" style="color:inherit;text-decoration:underline">${escapeHTML((props.name as string) || url)}</a>`
          : ''
      const cap = caption
        ? `<p style="font-size:0.85em;opacity:0.6;${cs}">${escapeHTML(caption)}</p>`
        : ''
      return `<div style="${cs}">${media}${cap}</div>${renderedChildren}`
    }

    case 'audio': {
      const url = props.url as string
      const caption = props.caption as string | undefined
      const showPreview = props.showPreview !== false
      const media = url && showPreview
        ? `<audio src="${escapeHTML(url)}" controls style="display:block;margin:4px 0;width:100%" />`
        : url && !showPreview
          ? `<a href="${escapeHTML(url)}" style="color:inherit;text-decoration:underline">${escapeHTML((props.name as string) || url)}</a>`
          : ''
      const cap = caption
        ? `<p style="font-size:0.85em;opacity:0.6;${cs}">${escapeHTML(caption)}</p>`
        : ''
      return `<div style="${cs}">${media}${cap}</div>${renderedChildren}`
    }

    case 'file': {
      const url = props.url as string
      const name = (props.name as string) || ''
      const caption = props.caption as string | undefined
      const link = url
        ? `<a href="${escapeHTML(url)}" style="color:inherit;text-decoration:underline">${escapeHTML(name || url)}</a>`
        : escapeHTML(name) || '[File]'
      const cap = caption
        ? `<p style="font-size:0.85em;opacity:0.6;${cs}">${escapeHTML(caption)}</p>`
        : ''
      return `<div style="${cs}">${link}${cap}</div>${renderedChildren}`
    }

    case 'table': {
      const tc = block.content as Record<string, unknown> | undefined
      if (!tc || tc.type !== 'tableContent') return renderedChildren
      return renderTable(tc) + renderedChildren
    }

    default:
      return renderedContent
        ? `<div style="${cs}">${renderedContent}</div>${renderedChildren}`
        : renderedChildren
  }
}

function renderTable(tc: Record<string, unknown>): string {
  const headerRows = (tc.headerRows as number) || 0
  const headerCols = (tc.headerCols as number) || 0
  const rows = (tc.rows as { cells: unknown[] }[]) || []

  let html = '<div style="overflow-x:auto;margin:6px 0"><table style="border-collapse:collapse;width:100%;font-size:inherit;line-height:1.5">'

  for (let r = 0; r < rows.length; r++) {
    html += '<tr>'
    const cells = rows[r].cells || []
    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c]
      let cellContent: unknown[]
      let cellProps: Record<string, unknown> = {}
      let colspan = 1
      let rowspan = 1

      if (Array.isArray(cell)) {
        cellContent = cell
      } else if (cell && typeof cell === 'object') {
        const tcCell = cell as Record<string, unknown>
        const cp = (tcCell.props as Record<string, unknown>) || {}
        cellContent = (tcCell.content as unknown[]) || []
        cellProps = cp
        colspan = (cp.colspan as number) || 1
        rowspan = (cp.rowspan as number) || 1
      } else {
        cellContent = []
      }

      const isHeader = r < headerRows || c < headerCols
      const tag = isHeader ? 'th' : 'td'
      const rendered = cellContent.map((ci) => renderInlineContent(ci as Record<string, unknown>)).join('')

      const bg = cellProps.backgroundColor
      const fg = cellProps.textColor
      const align = cellProps.textAlignment as string | undefined

      const style = [
        'border:1px solid rgba(0,0,0,0.12)',
        'padding:6px 10px',
        'text-align:left',
        `font-weight:${isHeader ? '600' : '400'}`,
        bg && bg !== 'default' ? `background-color:${bg}` : '',
        fg && fg !== 'default' ? `color:${fg}` : '',
        align ? `text-align:${align}` : '',
        'font-size:inherit',
        'line-height:1.5',
      ]
        .filter(Boolean)
        .join(';')

      const attrs = [
        colspan > 1 ? `colspan="${colspan}"` : '',
        rowspan > 1 ? `rowspan="${rowspan}"` : '',
      ]
        .filter(Boolean)
        .join(' ')

      html += `<${tag} style="${style}" ${attrs}>${rendered || '<br />'}</${tag}>`
    }
    html += '</tr>'
  }

  html += '</table></div>'
  return html
}

function renderInlineContent(node: Record<string, unknown>): string {
  if (node.type === 'text') {
    let text = escapeHTML((node.text as string) || '')
    const styles = node.styles as Record<string, unknown> | undefined
    if (!styles) return text
    if (styles.code)
      text = `<code style="font-size:0.875em;background:rgba(0,0,0,0.06);border-radius:3px;padding:0 3px;${CODE_FONT}">${text}</code>`
    if (styles.bold) text = `<strong>${text}</strong>`
    if (styles.italic) text = `<em>${text}</em>`
    if (styles.strike) text = `<s>${text}</s>`
    if (styles.underline) text = `<u>${text}</u>`
    if (styles.textColor) {
      const mapped = BN_TEXT_COLORS[styles.textColor as string] ?? escapeCSS(styles.textColor as string)
      text = `<span style="color:${mapped}">${text}</span>`
    }
    if (styles.backgroundColor) {
      const mapped = BN_BG_COLORS[styles.backgroundColor as string] ?? escapeCSS(styles.backgroundColor as string)
      text = `<span style="background-color:${mapped}">${text}</span>`
    }
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

function escapeCSS(str: string): string {
  return str.replace(/[^-a-zA-Z0-9#.,%()\s]/g, '')
}

export function renderBlocksToHTML(content: string): string {
  if (!content) return ''
  try {
    const blocks = JSON.parse(content)
    if (!Array.isArray(blocks) || blocks.length === 0) return ''
    const preprocessed = preprocessBlocks(blocks as Record<string, unknown>[])
    const inner = preprocessed.map((b) => renderBlock(b)).join('')
    return `<div style="${FONT}">${inner}</div>`
  } catch {
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br />')
  }
}
