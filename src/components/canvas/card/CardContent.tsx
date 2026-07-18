import DOMPurify from 'dompurify'
import { memo, useMemo, useState } from 'react'
import { ExternalLink, Play } from 'lucide-react'
import type { BlockNoteEditorHandle } from '../../editor/BlockNoteEditor'
import { useCardStore } from '../../../stores/cardStore'
import { useViewStore } from '../../../stores/viewStore'
import { useLibraryStore } from '../../../stores/libraryStore'
import { usePanelStore } from '../../../stores/panelStore'
import { useIsDarkMode } from '../../../hooks/useIsDarkMode'
import { CardEditorEntry } from '../../editor/CardEditorEntry'

interface CardContentProps {
  isEditing: boolean
  isSelected: boolean
  cardId: string
  content: string
  previewHTML?: string
  enforceInitialHeading?: boolean
  onChange: (content: string) => void
  onFocus?: () => void
  onBlur: () => void
  onBeforeEditorReveal?: () => void
  editorRef: React.Ref<BlockNoteEditorHandle>
  textColor: string
  onNavigateToCard?: (cardId: string) => void
  onTagClick?: (tagName: string) => void
}

export const CardContent = memo(function CardContent({
  isEditing,
  isSelected,
  cardId,
  content,
  previewHTML,
  enforceInitialHeading,
  onChange,
  onFocus,
  onBlur,
  onBeforeEditorReveal,
  editorRef,
  textColor,
  onNavigateToCard,
  onTagClick,
}: CardContentProps) {
  const canScroll = isSelected || isEditing
  const isDarkMode = useIsDarkMode()
  const card = useCardStore(s => s.cards[cardId])
  const isWebMode = card?.viewMode === 'web' && !!card?.sourceUrl

  const sanitizedHTML = useMemo(() => {
    // Use store's lazy getPreviewHTML — generates on first access, caches after
    const raw = previewHTML || useCardStore.getState().getPreviewHTML(cardId) || '<span style="opacity:0.5">双击编辑...</span>'
    return DOMPurify.sanitize(raw, { ALLOWED_URI_REGEXP: /^(?:(?:hepta-media|https?|mailto|tel|data):|[^a-zA-Z]|[^a-zA-Z]javascript:)/i })
  }, [previewHTML, cardId, content])

  return (
    <div
      className="pb-3"
      style={{
        height: 'calc(100% - 28px)',
        color: textColor,
        cursor: isEditing ? 'text' : undefined,
        overflow: isEditing ? 'visible' : 'hidden',
      }}
      onWheelCapture={canScroll ? (e) => e.stopPropagation() : undefined}
    >
      {isEditing ? (
        <div
          className="h-full overflow-y-auto px-6"
          style={{ fontSize: '13px', lineHeight: '1.5' }}
        >
          <CardEditorEntry
            entryKey={cardId}
            cardId={cardId}
            content={content}
            previewHTML={previewHTML}
            editorRef={editorRef}
            onBeforeReveal={onBeforeEditorReveal}
            onChange={onChange}
            onFocus={onFocus}
            onBlur={onBlur}
            theme={isDarkMode ? 'dark' : 'light'}
            editable
            enforceInitialHeading={enforceInitialHeading}
            onNavigateToCard={onNavigateToCard}
            onTagClick={onTagClick}
          />
        </div>
      ) : isWebMode && card?.sourceUrl ? (
        <CardWebPreview cardId={cardId} sourceUrl={card.sourceUrl} />
      ) : (
        <div className="h-full overflow-y-auto px-6" style={{ fontSize: '13px', lineHeight: '1.5' }}>
          <div
            className="bn-editor bn-default-styles card-preview-native"
            style={{ wordBreak: 'break-word', whiteSpace: 'break-spaces' }}
            dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
            onClickCapture={(e) => {
              const anchor = (e.target as HTMLElement).closest('a')
              if (anchor && anchor.href && (anchor.href.startsWith('http://') || anchor.href.startsWith('https://'))) {
                e.preventDefault()
                e.stopPropagation()
                const viewState = useViewStore.getState()
                if (!viewState.editingCardId) {
                  viewState.setEditingCardId(cardId)
                }
                useLibraryStore.getState().setWebviewUrl(anchor.href, cardId)
              }
            }}
          />
        </div>
      )}
    </div>
  )
})

function getBilibiliEmbedUrl(url: string): string | null {
  const bvMatch = url.match(/BV[\w]+/i)
  if (!bvMatch) return null
  return `//player.bilibili.com/player.html?bvid=${bvMatch[0]}&autoplay=0&high_quality=1`
}

function CardWebPreview({ cardId, sourceUrl }: { cardId: string; sourceUrl: string }) {
  const [hovered, setHovered] = useState(false)
  const isBilibili = getBilibiliEmbedUrl(sourceUrl)

  const openInRightPanel = () => {
    useLibraryStore.getState().setWebviewUrl(sourceUrl, cardId)
    useViewStore.getState().setEditingCardId(cardId)
    usePanelStore.getState().setRightPanelActiveTab('editor')
    usePanelStore.getState().setRightPanelCollapsed(false)
  }

  return (
    <div
      className="h-full w-full flex items-center justify-center overflow-hidden relative cursor-pointer"
      style={{ padding: 4 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={openInRightPanel}
    >
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-lg w-full h-full"
        style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--line-default)',
        }}
      >
        {isBilibili ? (
          <Play size={32} style={{ color: 'var(--fg-secondary)' }} />
        ) : (
          <ExternalLink size={32} style={{ color: 'var(--fg-secondary)' }} />
        )}
        <span className="text-xs text-fg-secondary truncate max-w-[80%]">
          {isBilibili ? '点击播放视频' : '点击查看网页'}
        </span>
      </div>
      {hovered && (
        <div
          className="absolute top-1 right-1 p-1 rounded-md"
          style={{ background: 'var(--surface-hover)' }}
        >
          <ExternalLink size={14} style={{ color: 'var(--fg-primary)' }} />
        </div>
      )}
    </div>
  )
}
