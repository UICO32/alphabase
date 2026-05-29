import TurndownService from 'turndown'

export interface FlomoTag {
  name: string
}

export interface FlomoMemo {
  slug: string
  content: string
  tags: FlomoTag[]
  created_at: string
  updated_at: string
  files: { url: string; type: string }[]
}

export interface ConvertedCard {
  title: string
  blocks: Record<string, unknown>[]
  tags: string[]
  flomoSlug: string
  flomoCreatedAt: string
  imageUrls: string[]
}

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
})

function parseMarkdownToBlocks(md: string): Record<string, unknown>[] {
  const lines = md.split('\n')
  const blocks: Record<string, unknown>[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '') {
      i++
      continue
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)/)
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3
      blocks.push({
        type: 'heading',
        props: { level, backgroundColor: 'default', textColor: 'default' },
        content: [{ type: 'text', text: headingMatch[2], styles: {} }],
        children: [],
      })
      i++
      continue
    }

    if (line.startsWith('> ')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2))
        i++
      }
      blocks.push({
        type: 'quote',
        props: { backgroundColor: 'default', textColor: 'default' },
        content: [{ type: 'text', text: quoteLines.join('\n'), styles: {} }],
        children: [],
      })
      continue
    }

    if (line.startsWith('```')) {
      const codeLines: string[] = []
      const lang = line.slice(3).trim()
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++
      blocks.push({
        type: 'codeBlock',
        props: { language: lang || 'plaintext', backgroundColor: 'default' },
        content: [{ type: 'text', text: codeLines.join('\n'), styles: {} }],
        children: [],
      })
      continue
    }

    if (line.match(/^[-*]\s+/)) {
      while (i < lines.length && lines[i].match(/^[-*]\s+/)) {
        blocks.push({
          type: 'bulletListItem',
          props: { backgroundColor: 'default', textColor: 'default' },
          content: [{ type: 'text', text: lines[i].replace(/^[-*]\s+/, ''), styles: {} }],
          children: [],
        })
        i++
      }
      continue
    }

    if (line.match(/^\d+\.\s+/)) {
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        blocks.push({
          type: 'numberedListItem',
          props: { backgroundColor: 'default', textColor: 'default' },
          content: [{ type: 'text', text: lines[i].replace(/^\d+\.\s+/, ''), styles: {} }],
          children: [],
        })
        i++
      }
      continue
    }

    const imgMatch = line.match(/!\[.*?\]\((.+?)\)/)
    if (imgMatch) {
      blocks.push({
        type: 'image',
        props: { backgroundColor: 'default', url: imgMatch[1], caption: '' },
        children: [],
      })
      i++
      continue
    }

    blocks.push({
      type: 'paragraph',
      props: { backgroundColor: 'default', textColor: 'default' },
      content: [{ type: 'text', text: line, styles: {} }],
      children: [],
    })
    i++
  }

  return blocks
}

export function convertFlomoMemo(memo: FlomoMemo): ConvertedCard {
  const imageUrls = (memo.files || [])
    .filter(f => f.type?.startsWith('image/'))
    .map(f => f.url)

  const markdown = turndown.turndown(memo.content || '')
  const blocks = parseMarkdownToBlocks(markdown)
  const tags = (memo.tags || []).map(t => t.name)

  const firstText = memo.content?.replace(/<[^>]+>/g, '').trim() || ''
  const title = firstText.slice(0, 50) || `flomo ${memo.slug}`

  return {
    title,
    blocks,
    tags,
    flomoSlug: memo.slug,
    flomoCreatedAt: memo.created_at,
    imageUrls,
  }
}
