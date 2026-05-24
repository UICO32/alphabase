import { useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { useLibraryStore } from '../../stores/libraryStore'
import { useCardStore } from '../../stores/cardStore'
import { usePanelSurface } from '../../hooks/usePanelSurface'
import { CollapseButton } from './SharedUI'
import { CardLibraryView } from './CardLibraryView'
import { RelatedCardsTab } from './RelatedCardsTab'
import { CardBlockNoteEditor } from '../editor/BlockNoteEditor'
import { Layers, FileText, Search, PanelRightOpen } from 'lucide-react'

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

  const surface = usePanelSurface()
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

      <div
        className="flex items-center justify-between px-3 py-2 border-b transition-theme"
        style={{ borderColor: surface.divider }}
      >
        <div className="flex gap-1">
          <button
            onClick={() => setRightPanelActiveTab('library')}
            className="panel-tab panel-tab-hover flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
            style={{
              backgroundColor: rightPanelActiveTab === 'library' ? surface.surface : 'transparent',
              color: rightPanelActiveTab === 'library' ? surface.text : surface.muted,
            }}
          >
            <Layers size={14} />
            卡片库
          </button>
          <button
            onClick={() => setRightPanelActiveTab('editor')}
            className="panel-tab panel-tab-hover flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
            style={{
              backgroundColor: rightPanelActiveTab === 'editor' ? surface.surface : 'transparent',
              color: rightPanelActiveTab === 'editor' ? surface.text : surface.muted,
            }}
          >
            <FileText size={14} />
            卡片编辑器
          </button>
          <button
            onClick={() => setRightPanelActiveTab('related')}
            className="panel-tab panel-tab-hover flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
            style={{
              backgroundColor: rightPanelActiveTab === 'related' ? surface.surface : 'transparent',
              color: rightPanelActiveTab === 'related' ? surface.text : surface.muted,
            }}
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
          <CardEditorView cardId={editingCardId} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full animate-fadeIn" style={{ color: surface.muted }}>
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
        className="fixed top-10 right-2 z-50 flex items-center justify-center h-7 px-2 rounded-md cursor-pointer shadow-md"
        style={{
          backgroundColor: surface.panelBg,
          color: surface.muted,
          border: `1px solid ${surface.divider}`,
        }}
      >
        <PanelRightOpen size={16} />
      </motion.button>
    )}
  </>
  )
}

function CardEditorView({ cardId }: { cardId: string }) {
  const card = useCardStore(s => s.cards[cardId])
  const updateCard = useCardStore(s => s.updateCard)

  const handleChange = useCallback((content: string) => {
    updateCard(cardId, { content })
  }, [cardId, updateCard])

  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center h-full animate-fadeIn" style={{ color: '#71717a' }}>
        <p className="text-sm">卡片不存在或已被删除</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-2">
      <CardBlockNoteEditor
        content={card.content}
        onChange={handleChange}
        editable={true}
      />
    </div>
  )
}
