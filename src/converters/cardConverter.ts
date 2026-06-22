import type { CardFile } from '../utils/workspace/types'
import type { GlobalCard } from '../stores/cardStore'

export function cardFileToGlobalCard(file: CardFile): GlobalCard {
  return {
    id: file.id,
    content: file.content,
    color: (file.color as GlobalCard['color']) || 'white',
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    title: file.title,
    enforceInitialHeading: file.enforceInitialHeading,
    fixedHeight: file.fixedHeight,
    collapsed: file.collapsed,
    deletedAt: file.deletedAt,
    sourceUrl: file.sourceUrl,
    tags: file.tags,
    flomoSlug: file.flomoSlug,
  }
}

export function globalCardToCardFile(card: GlobalCard): CardFile {
  return {
    id: card.id,
    title: card.title || extractTitleFromContent(card.content),
    color: card.color,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    content: card.content,
    enforceInitialHeading: card.enforceInitialHeading,
    fixedHeight: card.fixedHeight,
    collapsed: card.collapsed,
    deletedAt: card.deletedAt,
    sourceUrl: card.sourceUrl,
    tags: card.tags,
    flomoSlug: card.flomoSlug,
  }
}

export function extractTitleFromContent(content: string): string {
  try {
    const blocks = JSON.parse(content)
    for (const block of blocks) {
      if (block.type === 'heading' && block.content?.[0]?.text) {
        return block.content[0].text.slice(0, 120)
      }
    }
    for (const block of blocks) {
      const text = extractText(block)
      if (text) return text.slice(0, 120)
    }
  } catch {
    // Not valid JSON
  }
  return 'Untitled'
}

function extractText(block: Record<string, unknown>): string {
  if (typeof block.text === 'string') return block.text
  if (Array.isArray(block.content)) {
    for (const child of block.content) {
      const text = extractText(child as Record<string, unknown>)
      if (text) return text
    }
  }
  return ''
}