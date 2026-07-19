import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, List, Table, MessageSquare } from 'lucide-react'
import { CARD_COLORS, type CardColor } from '../../../types/card'
import { type SummaryFormat } from '../../../stores/aiStore'

interface SummaryFormatMenuProps {
  color: CardColor
  triggerRef: React.RefObject<HTMLElement | null>
  currentFormat: SummaryFormat
  onSelect: (format: SummaryFormat) => void
  onClose: () => void
}

const FORMAT_OPTIONS: Array<{ format: SummaryFormat; icon: React.ReactNode; label: string; desc: string }> = [
  { format: 'concise', icon: <FileText size={14} />, label: '简洁摘要', desc: '核心观点与关键要点' },
  { format: 'list', icon: <List size={14} />, label: '要点列表', desc: '每条不超过30字' },
  { format: 'table', icon: <Table size={14} />, label: '表格提取', desc: '关键数据表格化' },
  { format: 'custom', icon: <MessageSquare size={14} />, label: '自由提问', desc: '自定义问题' },
]

export function SummaryFormatMenu({
  color,
  triggerRef,
  currentFormat,
  onSelect,
  onClose,
}: SummaryFormatMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number; side: 'left' | 'right' }>({ top: 0, left: 0, side: 'right' })

  useEffect(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const menuWidth = 180
    const menuMarginLeft = 4
    let left = rect.right + menuMarginLeft
    let side: 'left' | 'right' = 'right'
    if (left + menuWidth > window.innerWidth) {
      left = rect.left - menuWidth - menuMarginLeft
      side = 'left'
    }
    setPosition({ top: rect.top, left, side })
  }, [triggerRef])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose, triggerRef])

  const strokeColor = CARD_COLORS[color].stroke

  const handleSelect = useCallback((format: SummaryFormat) => {
    onSelect(format)
  }, [onSelect])

  const menuContent = (
    <div
      ref={menuRef}
      className="ui-floating-surface ui-floating-content overflow-hidden rounded-lg py-1"
      data-side={position.side}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        minWidth: 180,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-[10px] py-1 text-[11px] text-fg-tertiary">
        摘要格式
      </div>
      {FORMAT_OPTIONS.map((opt) => {
        const isSelected = currentFormat === opt.format
        return (
          <button
            key={opt.format}
            onClick={() => handleSelect(opt.format)}
            className={`floating-menu-item ${isSelected ? 'floating-menu-item-active' : ''}`}
          >
            <span style={{ color: strokeColor, display: 'flex' }}>{opt.icon}</span>
            <div className="flex-1">
              <div className="text-[13px] text-fg-primary">{opt.label}</div>
              <div className="text-[10px] text-fg-tertiary">{opt.desc}</div>
            </div>
            {isSelected && (
              <span style={{ color: strokeColor, fontSize: 12 }}>✓</span>
            )}
          </button>
        )
      })}
    </div>
  )

  return createPortal(menuContent, document.body)
}
