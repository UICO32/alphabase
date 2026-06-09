import { useCallback, useEffect, useRef } from 'react'
import { useAIStore } from '../../../stores/aiStore'
import { useCardStore } from '../../../stores/cardStore'
import { useReactFlow } from '@xyflow/react'
import { DEFAULT_CARD_WIDTH } from '../../../types/card'

interface SummaryBubbleProps {
  cardId: string
  onClose: () => void
}

export function SummaryBubble({ cardId, onClose }: SummaryBubbleProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  const streamingText = useAIStore(s => s.streamingText)
  const isStreaming = useAIStore(s => s.isStreaming)
  const error = useAIStore(s => s.error)

  const { setNodes, getNode } = useReactFlow()
  const addCard = useCardStore(s => s.addCard)

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
    const card = useCardStore.getState().cards[cardId]
    if (!card || !streamingText) return

    const summaryContent = JSON.stringify([
      { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: 'AI 摘要' }] },
      ...streamingText.split('\n').filter(line => line.trim()).map(line => ({
        type: 'paragraph' as const,
        props: {} as Record<string, unknown>,
        content: [{ type: 'text' as const, text: line.trim() as string, styles: [] as unknown[] }],
      })),
    ])

    const newCardId = crypto.randomUUID()
    addCard({
      id: newCardId,
      content: summaryContent,
      color: card.color,
      createdAt: Date.now(),
    })

    const currentNode = getNode(cardId)
    const offset = 30
    const newPos = currentNode
      ? { x: currentNode.position.x + DEFAULT_CARD_WIDTH + offset, y: currentNode.position.y }
      : { x: 200, y: 200 }

    setNodes((nds) => [
      ...nds,
      { id: newCardId, type: 'card', position: newPos, data: { cardId: newCardId, color: card.color } },
    ])

    onClose()
  }, [cardId, streamingText, addCard, getNode, setNodes, onClose])

  // Compute display: single line focus with peek of adjacent lines
  const lineHeight = 22

  return (
    <div
      style={{
        position: 'absolute',
        top: -8,
        left: '100%',
        marginLeft: 10,
        zIndex: 9999,
        width: 240,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Streaming text viewport */}
      <div
        ref={trackRef}
        style={{
          width: 240,
          height: lineHeight * 3,
          overflow: 'hidden',
          borderRadius: 8,
          backgroundColor: 'var(--surface-card)',
          boxShadow: 'var(--shadow-md)',
          border: '1px solid var(--border-default)',
          padding: '0 10px',
        }}
      >
        <div
          ref={contentRef}
          style={{
            fontSize: 13,
            lineHeight: `${lineHeight}px`,
            color: error ? 'var(--text-danger)' : 'var(--text-primary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            paddingTop: lineHeight * 0.5,
            paddingBottom: lineHeight * 0.5,
          }}
        >
          {error ? error : streamingText ? (
            <>
              {streamingText}
              {isStreaming && <span style={{ opacity: 0.4 }}>▍</span>}
            </>
          ) : isStreaming ? '正在生成摘要…' : null}
        </div>
      </div>

      {/* Action bar: appears when streaming complete */}
      {!isStreaming && streamingText && !error && (
        <div
          style={{
            display: 'flex',
            gap: 4,
            marginTop: 4,
          }}
        >
          <button
            onClick={handleCreateCard}
            style={{
              flex: 1,
              padding: '5px 0',
              fontSize: 11,
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: 'var(--text-primary)',
              color: 'var(--text-inverse)',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.85' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
          >
            创建卡片
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '5px 10px',
              fontSize: 11,
              borderRadius: 6,
              border: '1px solid var(--border-default)',
              cursor: 'pointer',
              background: 'var(--surface-card)',
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-card)' }}
          >
            关闭
          </button>
        </div>
      )}
    </div>
  )
}
