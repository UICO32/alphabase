const TAG_PATTERN = /#([\p{L}\p{N}\p{Pc}\p{Po}]+)/gu

export function extractTags(text: string): string[] {
  const tags = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = TAG_PATTERN.exec(text)) !== null) {
    const tag = match[1].trim()
    if (tag && tag.length <= 50) {
      tags.add(tag)
    }
  }
  return Array.from(tags)
}

export function extractTagsFromBlocks(content: string): string[] {
  try {
    const blocks = JSON.parse(content)
    const allTags = new Set<string>()
    const walkBlocks = (blocks: unknown[]) => {
      for (const block of blocks) {
        if (typeof block === 'object' && block) {
          const b = block as Record<string, unknown>
          if (typeof b.text === 'string') {
            for (const tag of extractTags(b.text as string)) {
              allTags.add(tag)
            }
          }
          if (Array.isArray(b.content)) walkBlocks(b.content as unknown[])
        }
      }
    }
    walkBlocks(blocks)
    return Array.from(allTags)
  } catch {
    return extractTags(content)
  }
}
