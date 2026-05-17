import { parseHTML } from 'linkedom'

export function turndown(html: string): string {
  const { document } = parseHTML(`<div id="turndown-root">${html}</div>`)
  const root = document.getElementById('turndown-root')
  if (!root) return ''
  return nodesToMarkdown(Array.from(root.childNodes))
}

function nodesToMarkdown(nodes: Node[]): string {
  return nodes.map((n) => nodeToMarkdown(n)).join('').trim()
}

function nodeToMarkdown(node: Node): string {
  if (node.nodeType === 3) {
    return (node.textContent || '').replace(/\s+/g, ' ')
  }
  if (node.nodeType !== 1) return ''

  const el = node as Element
  const tag = el.tagName.toLowerCase()
  const children = nodesToMarkdown(Array.from(el.childNodes))

  switch (tag) {
    case 'h1':
      return `# ${children}\n\n`
    case 'h2':
      return `## ${children}\n\n`
    case 'h3':
      return `### ${children}\n\n`
    case 'h4':
      return `#### ${children}\n\n`
    case 'h5':
      return `##### ${children}\n\n`
    case 'h6':
      return `###### ${children}\n\n`
    case 'p':
      return `${children}\n\n`
    case 'br':
      return '\n'
    case 'hr':
      return '---\n\n'
    case 'strong':
    case 'b':
      return `**${children}**`
    case 'em':
    case 'i':
      return `*${children}*`
    case 'code':
      return `\`${children}\``
    case 'pre': {
      const code = el.querySelector('code')
      const text = code ? code.textContent || '' : children
      return `\`\`\`\n${text}\n\`\`\`\n\n`
    }
    case 'a': {
      const href = el.getAttribute('href') || ''
      return `[${children}](${href})`
    }
    case 'img': {
      const src = el.getAttribute('src') || ''
      const alt = el.getAttribute('alt') || ''
      return `![${alt}](${src})`
    }
    case 'ul':
      return Array.from(el.children)
        .map((li) => `- ${nodesToMarkdown(Array.from(li.childNodes))}`)
        .join('\n') + '\n\n'
    case 'ol':
      return Array.from(el.children)
        .map((li, i) => `${i + 1}. ${nodesToMarkdown(Array.from(li.childNodes))}`)
        .join('\n') + '\n\n'
    case 'blockquote':
      return children
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n') + '\n\n'
    case 'div':
    case 'span':
    case 'article':
    case 'section':
    case 'main':
    case 'header':
    case 'footer':
    case 'nav':
    case 'aside':
      return children
    default:
      return children
  }
}
