import { useState, useRef, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'
import { CARD_COLORS, type CardColor } from '../../../types/card'
import { useAIStore, type SummaryFormat } from '../../../stores/aiStore'
import { SummaryFormatMenu } from './SummaryFormatMenu'
import { SummaryBubble } from './SummaryBubble'

interface SummaryButtonProps {
  color: CardColor
  visible: boolean
  cardId: string
}

export function SummaryButton({ color, visible, cardId }: SummaryButtonProps) {
  const [bubbleOpen, setBubbleOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const isStreaming = useAIStore(s => s.isStreaming)
  const streamingCardId = useAIStore(s => s.streamingCardId)
  const startStreaming = useAIStore(s => s.startStreaming)
  const reset = useAIStore(s => s.reset)
  const format = useAIStore(s => s.format)
  const isThisCardStreaming = isStreaming && streamingCardId === cardId
  const isThisCardComplete = !isStreaming && streamingCardId === cardId && bubbleOpen

  const doGenerate = useCallback((fmt?: SummaryFormat) => {
    const aiState = useAIStore.getState()
    if (aiState.isStreaming) return

    const cardData = (window as any).__cardDataCache?.[cardId]
    if (!cardData?.content) return

    const html = cardData.previewHTML || ''
    const textContent = html
      ? new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() || ''
      : ''
    if (!textContent) return

    const actualFormat = fmt || aiState.format
    startStreaming(cardId, actualFormat)
    setBubbleOpen(true)
    setMenuOpen(false)

    const electronAPI = (window as any).electronAPI
    if (!electronAPI?.ai?.generateSummary) {
      useAIStore.getState().errorStreaming('AI 功能不可用')
      return
    }

    electronAPI.ai.generateSummary(
      textContent,
      actualFormat,
      actualFormat === 'custom' ? aiState.customQuestion : undefined,
    )
  }, [cardId, startStreaming])

  const handleClickStar = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (bubbleOpen) {
      setBubbleOpen(false)
      reset()
      return
    }
    doGenerate()
  }, [bubbleOpen, doGenerate, reset])

  const handleClickArrow = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpen(!menuOpen)
  }, [menuOpen])

  const handleCloseBubble = useCallback(() => {
    setBubbleOpen(false)
    reset()
  }, [reset])

  const handleSelectFormat = useCallback((fmt: SummaryFormat) => {
    setMenuOpen(false)
    if (fmt === 'custom') {
      useAIStore.getState().setFormat('custom')
      setBubbleOpen(true)
      return
    }
    doGenerate(fmt)
  }, [doGenerate])

  const strokeColor = CARD_COLORS[color].stroke
  const show = visible || isThisCardStreaming || isThisCardComplete

  return (
    <>
      <div
        ref={containerRef}
        className="absolute z-20"
        style={{
          top: -16,
          right: -16,
          width: 52,
          height: 32,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
          gap: 1,
          opacity: show ? 1 : 0,
          pointerEvents: show ? 'auto' : 'none',
          transition: 'opacity 0.15s',
        }}
      >
        <button
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: strokeColor,
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1,
            padding: '4px 2px',
            textShadow: '0 0 6px rgba(0,0,0,0.15)',
          }}
          onClick={handleClickStar}
          onPointerDown={(e) => e.stopPropagation()}
          title="AI 摘要"
        >
          {isThisCardStreaming ? '⋯' : '✦'}
        </button>

        {show && !bubbleOpen && (
          <button
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: strokeColor,
              padding: '4px 1px',
              opacity: 0.7,
              lineHeight: 1,
            }}
            onClick={handleClickArrow}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <ChevronDown size={12} />
          </button>
        )}
      </div>

      {menuOpen && containerRef.current && (
        <SummaryFormatMenu
          color={color}
          triggerRef={containerRef}
          currentFormat={format}
          onSelect={handleSelectFormat}
          onClose={() => setMenuOpen(false)}
        />
      )}

      {bubbleOpen && (
        <SummaryBubble
          cardId={cardId}
          onClose={handleCloseBubble}
        />
      )}
    </>
  )
}
