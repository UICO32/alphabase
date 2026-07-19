import { useCallback, useEffect, useRef, useState } from 'react'
import { useAIStore } from '../../../stores/aiStore'
import { useCardStore } from '../../../stores/cardStore'
import { useReactFlow } from '@xyflow/react'
import { DEFAULT_CARD_WIDTH, DEFAULT_CARD_HEIGHT } from '../../../types/card'

interface SummaryBubbleProps {
  cardId: string
  onClose: () => void
}

const LOADING_STAGES = [
  { text: '读取卡片内容…', duration: 1200 },
  { text: '思考中…', duration: 4000 },
  { text: '总结中…', duration: Infinity },
]

// Parse **bold** and ==highlight== inline markers into BlockNote styled text segments
// ==highlight== renders with backgroundColor for visual emphasis instead of bold
function parseInlineText(text: string): Record<string, unknown>[] {
  const segments: Record<string, unknown>[] = []
  const regex = /(\*\*(.+?)\*\*|==(.+?)==)/g
  let lastIdx = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      segments.push({ type: 'text', text: text.slice(lastIdx, match.index), styles: {} })
    }
    if (match[2]) {
      // **bold**
      segments.push({ type: 'text', text: match[2], styles: { bold: true } })
    } else if (match[3]) {
      // ==highlight== → background color
      segments.push({ type: 'text', text: match[3], styles: { backgroundColor: 'blue' } })
    }
    lastIdx = regex.lastIndex
  }
  if (lastIdx < text.length) {
    segments.push({ type: 'text', text: text.slice(lastIdx), styles: {} })
  }
  if (segments.length === 0) {
    segments.push({ type: 'text', text, styles: {} })
  }
  return segments
}

// Post-process: clean up think tags, residual == markers and --- separators
function cleanMarkdown(md: string): string {
  // Remove <think&gt;...</think&gt; blocks (reasoning model output)
  let cleaned = md.replace(/<think[\s\S]*?(<\/think>|$)/gi, '')
  // Remove standalone --- lines
  cleaned = cleaned.replace(/^---\s*$/gm, '')
  // Remove unmatched == markers (odd count on a line)
  const lines = cleaned.split('\n')
  cleaned = lines.map(line => {
    const count = (line.match(/==/g) || []).length
    if (count % 2 !== 0) {
      return line.replace(/==/g, '')
    }
    return line
  }).join('\n')
  return cleaned
}

function markdownToBlocks(md: string): Record<string, unknown>[] {
  const cleaned = cleanMarkdown(md)
  const lines = cleaned.split('\n')
  const blocks: Record<string, unknown>[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') { i++; continue }

    // Horizontal rule (---) — skip
    if (line.match(/^-{3,}$/)) { i++; continue }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/)
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        props: { level: headingMatch[1].length, backgroundColor: 'default', textColor: 'default' },
        content: parseInlineText(headingMatch[2]),
        children: [],
      })
      i++; continue
    }

    // Quote block (> line)
    if (line.match(/^>\s+/)) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].match(/^>\s+/)) {
        quoteLines.push(lines[i].replace(/^>\s+/, ''))
        i++
      }
      blocks.push({
        type: 'quote',
        props: { backgroundColor: 'default', textColor: 'default' },
        content: parseInlineText(quoteLines.join(' ')),
        children: [],
      })
      continue
    }

    // Bullet list
    if (line.match(/^[-*]\s+/)) {
      while (i < lines.length && lines[i].match(/^[-*]\s+/)) {
        blocks.push({
          type: 'bulletListItem',
          props: { backgroundColor: 'default', textColor: 'default' },
          content: parseInlineText(lines[i].replace(/^[-*]\s+/, '')),
          children: [],
        })
        i++
      }
      continue
    }

    // Numbered list
    if (line.match(/^\d+\.\s+/)) {
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        blocks.push({
          type: 'numberedListItem',
          props: { backgroundColor: 'default', textColor: 'default' },
          content: parseInlineText(lines[i].replace(/^\d+\.\s+/, '')),
          children: [],
        })
        i++
      }
      continue
    }

    // Table (Markdown | header | row |) → flatten to bullet list
    if (line.match(/^\|.*\|$/)) {
      i++ // skip header
      if (i < lines.length && lines[i].match(/^\|[-\s|:]+\|$/)) i++ // skip separator
      while (i < lines.length && lines[i].match(/^\|.*\|$/)) {
        const cells = lines[i].split('|').map(c => c.trim()).filter(Boolean)
        if (cells.length >= 2) {
          blocks.push({
            type: 'bulletListItem',
            props: { backgroundColor: 'default', textColor: 'default' },
            content: parseInlineText(cells.join(' — ')),
            children: [],
          })
        }
        i++
      }
      continue
    }

    // Paragraph (with inline bold support)
    blocks.push({
      type: 'paragraph',
      props: { backgroundColor: 'default', textColor: 'default' },
      content: parseInlineText(line),
      children: [],
    })
    i++
  }
  return blocks
}

export function SummaryBubble({ cardId, onClose }: SummaryBubbleProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [stageIndex, setStageIndex] = useState(0)

  const streamingText = useAIStore(s => s.streamingText)
  const isStreaming = useAIStore(s => s.isStreaming)
  const isComplete = useAIStore(s => s.isComplete)
  const error = useAIStore(s => s.error)

  const { setNodes, getNode, setEdges, getEdges } = useReactFlow()
  const addCard = useCardStore(s => s.addCard)

  // Auto-expand collapsed card when summary completes
  useEffect(() => {
    if (!isComplete) return
    const node = getNode(cardId)
    if (!node) return
    const d = node.data as Record<string, unknown>
    if (d.collapsed) {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === cardId ? { ...n, data: { ...n.data, collapsed: false } } : n,
        ),
      )
    }
  }, [isComplete, cardId, getNode, setNodes])

  const hasContent = streamingText.length > 0

  // Advance loading stages while no content yet
  useEffect(() => {
    if (hasContent || error || isComplete) return
    const stage = LOADING_STAGES[stageIndex]
    if (!stage || stage.duration === Infinity) return
    const timer = setTimeout(() => {
      setStageIndex(i => Math.min(i + 1, LOADING_STAGES.length - 1))
    }, stage.duration)
    return () => clearTimeout(timer)
  }, [stageIndex, hasContent, error, isComplete])

  // Smooth scroll: keep bottom line visible as text grows
  useEffect(() => {
    if (trackRef.current) {
      trackRef.current.scrollTo({ top: trackRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [streamingText])

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleCreateCard = useCallback(() => {
    if (!streamingText) return

    const blocks = markdownToBlocks(streamingText)
    const summaryContent = JSON.stringify(blocks)

    const newCardId = crypto.randomUUID()
    addCard({
      id: newCardId,
      content: summaryContent,
      color: 'white',
      createdAt: Date.now(),
    })

    const currentNode = getNode(cardId)
    // Place card at the bubble's visual position (right side of source card)
    const offset = 40
    const newPos = currentNode
      ? { x: currentNode.position.x + (currentNode.measured?.width ?? DEFAULT_CARD_WIDTH) + offset, y: currentNode.position.y }
      : { x: 200, y: 200 }

    setNodes((nds) => [
      ...nds,
      {
        id: newCardId,
        type: 'card',
        position: newPos,
        data: { cardId: newCardId, color: 'white', width: DEFAULT_CARD_WIDTH, height: DEFAULT_CARD_HEIGHT },
      },
    ])

    // Add connecting edge from source card to summary card
    const existingEdges = getEdges()
    const edgeId = `e-${cardId}-${newCardId}`
    if (!existingEdges.find(e => e.id === edgeId)) {
      setEdges((eds) => [
        ...eds,
        {
          id: edgeId,
          source: cardId,
          target: newCardId,
          type: 'connection',
        },
      ])
    }

    onClose()
  }, [cardId, streamingText, addCard, getNode, setNodes, setEdges, getEdges, onClose])

  const lineHeight = 22
  const viewportLines = 4
  const showLoading = isStreaming && !hasContent
  const showContent = hasContent || isComplete
  const showActions = !isStreaming && (hasContent || error)

  return (
    <div
      className="ui-floating-content"
      data-side="right"
      style={{
        position: 'absolute',
        top: -8,
        left: '100%',
        marginLeft: 10,
        zIndex: 'var(--z-dropdown)',
        width: 260,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Viewport with gradient fade at edges */}
      <div
        className="ui-floating-surface"
        style={{
          position: 'relative',
          width: 260,
          height: lineHeight * viewportLines,
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {/* Top gradient fade */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 20,
          background: 'linear-gradient(to bottom, var(--surface-card), transparent)',
          zIndex: 2, pointerEvents: 'none',
        }} />

        {/* Bottom gradient fade */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 20,
          background: 'linear-gradient(to top, var(--surface-card), transparent)',
          zIndex: 2, pointerEvents: 'none',
        }} />

        {/* Scrollable content area */}
        <div
          ref={trackRef}
          style={{
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            padding: '0 10px',
          }}
        >
          <div
            ref={contentRef}
            style={{
              fontSize: 13,
              lineHeight: `${lineHeight}px`,
              color: error ? 'var(--fg-danger)' : 'var(--fg-primary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              paddingTop: lineHeight * 0.5,
              paddingBottom: lineHeight * 0.5,
            }}
          >
            {error ? (
              <span style={{ color: 'var(--fg-danger)' }}>✗ {error}</span>
            ) : showLoading ? (
              <span style={{ color: 'var(--fg-secondary)' }}>
                {LOADING_STAGES[stageIndex]?.text}
                <span className="summary-bubble-loading-caret" style={{ marginLeft: 2 }}>…</span>
              </span>
            ) : showContent ? (
              <>
                {streamingText.replace(/==/g, '').replace(/^---\s*$/gm, '')}
                {isStreaming && <span style={{ opacity: 0.4 }}>▍</span>}
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Action bar: appears when streaming complete or on error */}
      {showActions && (
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {!error && (
            <button
              onClick={handleCreateCard}
              style={{
                flex: 1,
                padding: '5px 0',
                fontSize: 11,
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                background: 'var(--brand)',
                color: 'var(--color-white)',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--brand-hover)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--brand)' }}
            >
              创建卡片
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              flex: error ? 1 : undefined,
              padding: '5px 10px',
              fontSize: 11,
              borderRadius: 6,
              border: error ? 'none' : '1px solid var(--line-default)',
              cursor: 'pointer',
              background: error ? 'var(--fg-danger)' : 'var(--surface-card)',
              color: error ? 'white' : 'var(--fg-secondary)',
            }}
            onMouseEnter={(e) => {
              if (error) { (e.currentTarget as HTMLElement).style.opacity = '0.85' }
              else { (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)' }
            }}
            onMouseLeave={(e) => {
              if (error) { (e.currentTarget as HTMLElement).style.opacity = '1' }
              else { (e.currentTarget as HTMLElement).style.background = 'var(--surface-card)' }
            }}
          >
            关闭
          </button>
        </div>
      )}
    </div>
  )
}
