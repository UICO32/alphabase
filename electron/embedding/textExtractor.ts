import TurndownService from 'turndown'
import { renderBlocksToHTML } from '@/converters/renderBlocks'

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
})

/**
 * BlockNote JSON blocks → Markdown 文本
 * 路径: JSON string → HTML (renderBlocksToHTML) → Markdown (turndown)
 */
export function extractMarkdown(blocksJson: string): string {
  if (!blocksJson) return ''
  try {
    const html = renderBlocksToHTML(blocksJson)
    const markdown = turndown.turndown(html)
    return markdown.trim()
  } catch {
    return ''
  }
}

/**
 * 从卡片内容中提取用于向量化的文本
 * 截断过长文本（jina v5 max 8192 tokens, 保守截断到 ~6000 chars）
 */
export function extractEmbeddingText(blocksJson: string): string {
  const md = extractMarkdown(blocksJson)
  if (md.length > 6000) {
    return md.slice(0, 6000)
  }
  return md
}
