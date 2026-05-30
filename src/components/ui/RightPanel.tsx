import { useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { useLibraryStore } from '../../stores/libraryStore'
import { useCardStore, useCard } from '../../stores/cardStore'
import { CollapseButton } from './SharedUI'
import { CardLibraryView } from './CardLibraryView'
import { RelatedCardsTab } from './RelatedCardsTab'
import { CardBlockNoteEditor } from '../editor/BlockNoteEditor'
import { Layers, FileText, Search, PanelRightOpen, Globe } from 'lucide-react'
import { WebviewPanel } from './WebviewPanel'

interface RightPanelProps {
  onOpenSettings?: () => void
}

export function RightPanel({ onOpenSettings }: RightPanelProps) {
  const rightPanelCollapsed = useLibraryStore(s => s.rightPanelCollapsed)
  const setRightPanelCollapsed = useLibraryStore(s => s.setRightPanelCollapsed)
  const rightPanelActiveTab = useLibraryStore(s => s.rightPanelActiveTab)
  const setRightPanelActiveTab = useLibraryStore(s => s.setRightPanelActiveTab)
  const rightPanelWidth = useLibraryStore(s => s.rightPanelWidth)
  const setRightPanelWidth = useLibraryStore(s => s.setRightPanelWidth)
  const viewMode = useLibraryStore(s => s.viewMode)
  const editingCardId = useLibraryStore(s => s.editingCardId)
  const webviewUrl = useLibraryStore(s => s.webviewUrl)
  const setWebviewUrl = useLibraryStore(s => s.setWebviewUrl)
  const editingCard = useCard(editingCardId ?? '')
  const isClipCard = !!(editingCard?.sourceUrl)

  const isDragging = useRef(false)

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    isDragging.current = true
    const startX = e.clientX
    const startWidth = rightPanelWidth
    const onMove = (ev: PointerEvent) => {
      if (!isDragging.current) return
      const delta = startX - ev.clientX
      setRightPanelWidth(startWidth + delta)
    }
    const onUp = () => {
      isDragging.current = false
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [rightPanelWidth, setRightPanelWidth])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation()
  }, [])

  if (viewMode !== 'board') return null

  return (
    <>
      <motion.div
        className="absolute right-0 top-0 bottom-0 z-10 flex flex-col overflow-hidden glass-panel-large"
        style={{ width: rightPanelWidth }}
        animate={{ x: rightPanelCollapsed ? rightPanelWidth : 0 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        onWheel={handleWheel}
      >
        <div
          className="absolute left-0 top-0 bottom-0 z-20 cursor-col-resize"
          style={{ width: 4 }}
          onPointerDown={handleResizeStart}
        />

      <div className="flex items-center justify-between px-3 py-2 border-b border-border-default transition-theme">
        <div className="flex gap-1">
          <button
            onClick={() => setRightPanelActiveTab('library')}
            className={`panel-tab panel-tab-hover flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs ${rightPanelActiveTab === 'library' ? 'bg-surface-card text-text-primary' : 'text-text-secondary'}`}
          >
            <Layers size={14} />
            卡片库
          </button>
          <button
            onClick={() => setRightPanelActiveTab('editor')}
            className={`panel-tab panel-tab-hover flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs ${rightPanelActiveTab === 'editor' ? 'bg-surface-card text-text-primary' : 'text-text-secondary'}`}
          >
            <FileText size={14} />
            卡片编辑器
          </button>
          <button
            onClick={() => setRightPanelActiveTab('related')}
            className={`panel-tab panel-tab-hover flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs ${rightPanelActiveTab === 'related' ? 'bg-surface-card text-text-primary' : 'text-text-secondary'}`}
          >
            <Search size={14} />
            相关
          </button>
        </div>
        <CollapseButton direction="right" onClick={() => setRightPanelCollapsed(true)} />
      </div>

      <div className="flex-1 overflow-y-auto">
        {rightPanelActiveTab === 'library' ? (
          <CardLibraryView onOpenSettings={onOpenSettings} />
        ) : rightPanelActiveTab === 'related' ? (
          <RelatedCardsTab />
        ) : editingCardId ? (
          <ClipAwareEditorView
            cardId={editingCardId}
            isClipCard={isClipCard}
            sourceUrl={editingCard?.sourceUrl}
            webviewUrl={webviewUrl}
            setWebviewUrl={setWebviewUrl}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full animate-fadeIn text-text-secondary">
            <FileText size={48} className="mb-4 opacity-30" />
            <p className="text-sm">选择卡片进行编辑</p>
          </div>
        )}
      </div>
    </motion.div>

    {rightPanelCollapsed && (
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        onClick={() => setRightPanelCollapsed(false)}
        className="fixed top-10 right-2 z-50 flex items-center justify-center h-7 px-2 rounded-md cursor-pointer shadow-md glass-panel text-text-secondary border border-border-default"
      >
        <PanelRightOpen size={16} />
      </motion.button>
    )}
  </>
  )
}

function ClipAwareEditorView({ cardId, isClipCard, sourceUrl, webviewUrl, setWebviewUrl }: {
  cardId: string
  isClipCard: boolean
  sourceUrl?: string
  webviewUrl: string | null
  setWebviewUrl: (url: string | null, cardId?: string | null) => void
}) {
  const card = useCardStore(s => s.cards[cardId])
  const updateCard = useCardStore(s => s.updateCard)

  const handleChange = useCallback((content: string) => {
    updateCard(cardId, { content })
  }, [cardId, updateCard])

  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center h-full animate-fadeIn text-text-secondary">
        <p className="text-sm">卡片不存在或已被删除</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {isClipCard && (
        <div className="flex justify-center px-6 pt-3">
          <div className="flex items-center rounded-full bg-surface-card border border-border-default p-0.5">
            <button
              onClick={() => setWebviewUrl(null)}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${!webviewUrl ? 'bg-surface-panel text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
            >
              <FileText size={11} />
              剪藏
            </button>
            <button
              onClick={() => setWebviewUrl(sourceUrl!, cardId)}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${webviewUrl ? 'bg-surface-panel text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
            >
              <Globe size={11} />
              网页
            </button>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-auto p-6">
        {webviewUrl ? (
          <WebviewPanel url={webviewUrl} embedded />
        ) : (
          <CardBlockNoteEditor
            content={card.content}
            onChange={handleChange}
            editable={true}
          />
        )}
      </div>
    </div>
  )
}
