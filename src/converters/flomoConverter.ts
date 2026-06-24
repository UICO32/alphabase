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

/**
 * Match #tag patterns: # followed by non-whitespace, non-# characters.
 * Avoids matching Markdown heading # (must be at line start or preceded by whitespace/punctuation).
 */
const TAG_PATTERN = /(?:^|[\s(（【])#([^\s#()（）【】、，。.;:!?，。；：！？]+)/g

/** Extract tag names from markdown text, reversing turndown's `\_` → `_` */
function extractTagsFromMarkdown(md: string): string[] {
  const tags = new Set<string>()
  let m: RegExpExecArray | null
  const re = new RegExp(TAG_PATTERN.source, 'g')
  while ((m = re.exec(md)) !== null) {
    const name = m[1].replace(/\\_/g, '_').trim()
    if (name) tags.add(name)
  }
  return Array.from(tags)
}

/** Convert `#tag` segments in plain text to tag inline content nodes */
function injectTagInline(text: string): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = []
  let lastIndex = 0
  const re = new RegExp(TAG_PATTERN.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const prefix = text.slice(lastIndex, m.index + m[0].indexOf('#'))
    if (prefix) result.push({ type: 'text', text: prefix, styles: {} })
    const tagName = m[1].replace(/\\_/g, '_').trim()
    result.push({
      type: 'tag',
      props: { tagName },
      content: [{ type: 'text', text: tagName, styles: {} }],
    })
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < text.length) {
    result.push({ type: 'text', text: text.slice(lastIndex), styles: {} })
  }
  return result.length > 0 ? result : [{ type: 'text', text, styles: {} }]
}

/** Walk blocks and replace plain-text content with tag inline nodes where applicable */
function injectTagInlineIntoBlocks(blocks: Record<string, unknown>[]): void {
  for (const block of blocks) {
    const type = block.type as string
    if (!['paragraph', 'heading', 'quote', 'bulletListItem', 'numberedListItem'].includes(type)) continue
    const content = block.content as Record<string, unknown>[] | undefined
    if (!content || content.length !== 1) continue
    const node = content[0]
    if (node?.type !== 'text') continue
    const newContent = injectTagInline((node.text as string) || '')
    if (newContent.length > 1 || newContent[0]?.type === 'tag') {
      block.content = newContent
    }
  }
}

export function convertFlomoMemo(memo: FlomoMemo): ConvertedCard {
  const imageUrls = (memo.files || [])
    .filter(f => f.type?.startsWith('image/'))
    .map(f => f.url)

  const markdown = turndown.turndown(memo.content || '')
  const blocks = parseMarkdownToBlocks(markdown)
  injectTagInlineIntoBlocks(blocks)

  // Merge memo.tags with tags extracted from body text
  const bodyTags = extractTagsFromMarkdown(markdown)
  const memoTags = (memo.tags || []).map(t => t?.name).filter(Boolean) as string[]
  const tags = [...new Set([...bodyTags, ...memoTags])]

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
