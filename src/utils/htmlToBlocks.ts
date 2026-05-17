interface InlineStyle {
  bold?: boolean
  italic?: boolean
  code?: boolean
  link?: string
}

interface TextInline {
  type: 'text'
  text: string
  styles: InlineStyle
}

interface BlockNode {
  type: string
  props?: Record<string, any>
  content?: any[]
  children?: BlockNode[]
}

function parseInlineStyles(el: Element): TextInline[] {
  const result: TextInline[] = []

  function walk(node: Node, styles: InlineStyle) {
    if (node.nodeType === 3) {
      const text = node.textContent || ''
      if (text) {
        result.push({ type: 'text', text, styles: { ...styles } })
      }
      return
    }
    if (node.nodeType !== 1) return
    const e = node as Element
    const tag = e.tagName.toLowerCase()
    const next = { ...styles }
    if (tag === 'strong' || tag === 'b') next.bold = true
    else if (tag === 'em' || tag === 'i') next.italic = true
    else if (tag === 'code' && !e.closest('pre')) next.code = true
    else if (tag === 'a') next.link = e.getAttribute('href') || undefined
    else if (tag === 'br') { result.push({ type: 'text', text: '\n', styles: { ...styles } }); return }
    for (const child of e.childNodes) walk(child, next)
  }

  for (const child of el.childNodes) walk(child, {})
  return result
}

function headingLevel(tag: string): 1 | 2 | 3 {
  const n = parseInt(tag.replace('h', ''))
  return (n <= 3 ? n : 3) as 1 | 2 | 3
}

export function htmlToBlocks(html: string): BlockNode[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const blocks: BlockNode[] = []

  function processElement(el: Element) {
    const tag = el.tagName.toLowerCase()

    if (['section', 'div', 'article', 'main', 'header', 'footer'].includes(tag)) {
      for (const child of el.children) processElement(child)
      return
    }

    if (tag.match(/^h[1-6]$/)) {
      const content = parseInlineStyles(el)
      if (content.length > 0) {
        blocks.push({
          type: 'heading',
          props: { level: headingLevel(tag) },
          content,
        })
      }
      return
    }

    if (tag === 'p') {
      const imgs = el.querySelectorAll('img')
      if (imgs.length === 1 && el.textContent?.trim() === '') {
        const src = imgs[0].getAttribute('src')
        if (src) {
          blocks.push({ type: 'image', props: { url: src } })
          return
        }
      }
      const content = parseInlineStyles(el)
      if (content.length > 0) {
        blocks.push({ type: 'paragraph', content })
      }
      return
    }

    if (tag === 'img') {
      const src = el.getAttribute('src')
      if (src) blocks.push({ type: 'image', props: { url: src } })
      return
    }

    if (tag === 'figure') {
      const img = el.querySelector('img')
      if (img) {
        const src = img.getAttribute('src')
        if (src) blocks.push({ type: 'image', props: { url: src } })
      }
      const caption = el.querySelector('figcaption')
      if (caption?.textContent?.trim()) {
        blocks.push({
          type: 'paragraph',
          content: [{ type: 'text', text: caption.textContent.trim(), styles: { italic: true } }],
        })
      }
      return
    }

    if (tag === 'blockquote') {
      for (const child of el.children) processElement(child)
      return
    }

    if (tag === 'pre') {
      const code = el.querySelector('code')
      const text = code?.textContent || el.textContent || ''
      blocks.push({ type: 'codeBlock', props: { language: '' }, content: [{ type: 'text', text, styles: {} }] })
      return
    }

    if (tag === 'ul' || tag === 'ol') {
      for (const li of el.querySelectorAll(':scope > li')) {
        const content = parseInlineStyles(li)
        if (content.length > 0) {
          blocks.push({ type: 'bulletListItem', content })
        }
      }
      return
    }

    for (const child of el.children) processElement(child)
  }

  for (const child of doc.body.children) processElement(child)

  if (blocks.length === 0) {
    blocks.push({ type: 'paragraph', content: [{ type: 'text', text: '（无内容）', styles: {} }] })
  }

  return blocks
}
