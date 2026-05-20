import { useMemo } from 'react'
import { renderBlocksToHTML } from '../../../converters/renderBlocks'

interface CollapsedContentProps {
  content: string
  previewHTML?: string
  textColor: string
}

function extractFirstBlock(html: string): string {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    const allBlocks = doc.body.children
    for (let i = 0; i < allBlocks.length; i++) {
      const el = allBlocks[i] as HTMLElement
      if (el.matches('h1, h2, h3')) continue
      const text = el.textContent?.trim() || ''
      if (text) return text
    }
    return ''
  } catch {
    return ''
  }
}

export function CollapsedContent({ content, previewHTML, textColor }: CollapsedContentProps) {
  const html = previewHTML || renderBlocksToHTML(content)
  const preview = useMemo(() => extractFirstBlock(html), [html])

  return (
    <div
      className="overflow-hidden px-3 flex items-center"
      style={{
        height: 'calc(100% - 28px)',
        color: textColor,
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          opacity: preview ? 0.7 : 0.5,
        }}
      >
        {preview || '空卡片'}
      </span>
    </div>
  )
}