import type { CardFile } from './types'
import type { GlobalCard } from '../cardStore'

export function cardFileToGlobalCard(file: CardFile): GlobalCard {
  return {
    id: file.id,
    content: file.content,
    color: file.color as GlobalCard['color'],
    variant: file.variant as GlobalCard['variant'],
    createdAt: file.createdAt,
    enforceInitialHeading: file.enforceInitialHeading,
    fixedHeight: file.fixedHeight,
    collapsed: file.collapsed,
  }
}

export function globalCardToCardFile(card: GlobalCard): CardFile {
  return {
    id: card.id,
    title: extractTitleFromContent(card.content),
    color: card.color,
    variant: card.variant,
    createdAt: card.createdAt,
    content: card.content,
    enforceInitialHeading: card.enforceInitialHeading,
    fixedHeight: card.fixedHeight,
    collapsed: card.collapsed,
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
    // Fallback: first text content
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
