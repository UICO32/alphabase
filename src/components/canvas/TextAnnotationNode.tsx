import { memo, useState, useCallback, useRef, useEffect, useSyncExternalStore } from 'react'
import { useReactFlow, NodeResizeControl, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { ArrowUpRight, Trash2, AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import { connectionMediator } from './utils/connectionMediator'
import { useFrameInteraction } from './utils/frameInteraction'
import { CardHandles } from './card/CardHandles'
import { AnnotationEditor, type AnnotationEditorHandle } from '../editor/AnnotationEditor'
import { useThemeStore } from '../../stores/themeStore'
import {
  CARD_COLORS,
  ANNOTATION_FONT_SIZES,
  DEFAULT_ANNOTATION_WIDTH,
  DEFAULT_ANNOTATION_HEIGHT,
  type CardColor,
  type TextAnnotationNodeData,
  type AnnotationFontSize,
  type AnnotationAlign,
} from '../../types/card'
import { createAnnotationHeightBatcher } from './annotationHeightBatcher'

type TextAnnotationNodeType = Node<TextAnnotationNodeData, 'text'>

const FONT_SIZE_ORDER: AnnotationFontSize[] = ['sm', 'md', 'lg', 'xl']
const MIN_ANNOTATION_WIDTH = 160
const MIN_ANNOTATION_HEIGHT = DEFAULT_ANNOTATION_HEIGHT
const ANNOTATION_PADDING_X = 10
const ANNOTATION_PADDING_Y = 7
const ALIGN_OPTIONS: { value: AnnotationAlign; Icon: typeof AlignLeft; title: string }[] = [
  { value: 'left', Icon: AlignLeft, title: 'Align left' },
  { value: 'center', Icon: AlignCenter, title: 'Align center' },
  { value: 'right', Icon: AlignRight, title: 'Align right' },
]

function getNextFontSize(current: AnnotationFontSize): AnnotationFontSize {
  const idx = FONT_SIZE_ORDER.indexOf(current)
  return FONT_SIZE_ORDER[(idx + 1) % FONT_SIZE_ORDER.length]
}

export const TextAnnotationNode = memo(({ id, data, selected }: NodeProps<TextAnnotationNodeType>) => {
  const { setNodes, setEdges, getNode } = useReactFlow()
  const isDarkMode = useThemeStore(s => s.isDarkMode)
  const [isEditing, setIsEditing] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const editorRef = useRef<AnnotationEditorHandle>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const measuredHeightRef = useRef<number>(data.height ?? DEFAULT_ANNOTATION_HEIGHT)

  const color: CardColor = data.color ?? 'white'
  const fontSize: AnnotationFontSize = data.fontSize ?? 'md'
  const align: AnnotationAlign = data.align ?? 'left'

  // 鈹€鈹€ 杩炴帴鐘舵€佽闃咃紙澶嶅埢 CardNode 妯″紡锛夆攢鈹€
  const isConnecting = useSyncExternalStore(
    connectionMediator.subscribe.bind(connectionMediator),
    connectionMediator.isConnecting.bind(connectionMediator),
  )
  const isConnectingSource = useSyncExternalStore(
    (fn) => connectionMediator.subscribeCard(id, fn),
    () => connectionMediator.isConnectingFrom(id),
  )
  const isConnectionTarget = isConnecting && !isConnectingSource
  const isNearbyTarget = useSyncExternalStore(
    (fn) => connectionMediator.subscribeCard(id, fn),
    () => connectionMediator.getNearbyTarget() === id,
  )

  // 鈹€鈹€ autoEdit锛氬伐鍏锋斁缃悗鑷姩杩涘叆缂栬緫鎬侊紙鍙傝€?CardNode isAutoEdit 妯″紡锛夆攢鈹€
  const isAutoEdit = useFrameInteraction((s) => s.autoEditAnnoId === id)
  useEffect(() => {
    if (!isAutoEdit) return
    setIsEditing(true)
    // 娑堣垂鏍囪锛岄伩鍏嶉噸澶嶈Е鍙?    useFrameInteraction.setState({ autoEditAnnoId: null })
    requestAnimationFrame(() => editorRef.current?.focus())
  }, [isAutoEdit])

  // 鈹€鈹€ 缂栬緫鎬佽 dragHandle锛岄伩鍏嶆嫋鎷戒笌缂栬緫鍐茬獊锛堝弬鑰?CardNode 妯″紡锛夆攢鈹€
  useEffect(() => {
    setNodes((nds) => {
      const idx = nds.findIndex((n) => n.id === id)
      if (idx === -1) return nds
      const me = nds[idx]
      const newDragHandle = isEditing ? '.text-anno-drag-handle' : undefined
      if (me.dragHandle === newDragHandle) return nds
      const next = [...nds]
      next[idx] = { ...me, ...(me.dragHandle !== newDragHandle ? { dragHandle: newDragHandle } : {}) }
      return next
    })
  }, [isEditing, id, setNodes])

  // 鈹€鈹€ 鑷姩鎾戦珮锛氱洃鍚唴瀹瑰尯楂樺害鍙樺寲鍐欏叆 data.height锛堝弬鑰?CardNode MiniCard 妯″紡锛夆攢鈹€
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const heightBatcher = createAnnotationHeightBatcher({
      initialHeight: measuredHeightRef.current,
      threshold: 4,
      onCommit: (height) => {
        measuredHeightRef.current = height
        setNodes(nds => nds.map(n =>
          n.id === id ? { ...n, data: { ...n.data, height } } : n
        ))
      },
    })
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const measuredH = Math.max(MIN_ANNOTATION_HEIGHT, Math.round(entry.contentRect.height))
        if (measuredH < 10) return
        heightBatcher.schedule(measuredH)
      }
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      heightBatcher.dispose()
    }
  }, [id, setNodes])

  const getNodeSize = useCallback((node: Node) => {
    const d = node.data as TextAnnotationNodeData
    return { w: d.width ?? DEFAULT_ANNOTATION_WIDTH, h: d.height ?? DEFAULT_ANNOTATION_HEIGHT }
  }, [])

  // 鈹€鈹€ 鐐瑰嚮锛氳繛鎺ュ畬鎴?or 杩涘叆缂栬緫锛堝鍒?CardNode.handleCardClick 鏍稿績锛夆攢鈹€
  const handleNodeClick = useCallback((e: React.MouseEvent) => {
    if (isConnectionTarget || isNearbyTarget) {
      e.stopPropagation()
      const pending = connectionMediator.getPending()
      const sourceNode = pending ? getNode(pending.sourceNodeId) : undefined
      const targetNode = getNode(id)
      if (sourceNode && targetNode) {
        const ss = getNodeSize(sourceNode)
        const ts = getNodeSize(targetNode)
        connectionMediator.complete(
          id,
          '',
          sourceNode.position,
          { w: ss.w, h: ss.h },
          targetNode.position,
          { w: ts.w, h: ts.h },
        )
      } else {
        connectionMediator.complete(id, '')
      }
      return
    }
    // 鐐瑰嚮缂栬緫鍣ㄥ唴閮ㄤ笉鎷︽埅
    const target = e.target as HTMLElement
    if (target.closest('[contenteditable="true"]')) return
    if (isEditing) return
    setIsEditing(true)
    requestAnimationFrame(() => editorRef.current?.focus())
  }, [isConnectionTarget, isNearbyTarget, id, isEditing, getNode, getNodeSize])

  const handleStartConnection = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    connectionMediator.start(id, 'top')
  }, [id])

  const updateData = useCallback((patch: Partial<TextAnnotationNodeData>) => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
  }, [id, setNodes])

  const handleFontSizeToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    updateData({ fontSize: getNextFontSize(fontSize) })
  }, [fontSize, updateData])

  const handleAlignChange = useCallback((newAlign: AnnotationAlign) => {
    updateData({ align: newAlign })
  }, [updateData])

  const handleColorChange = useCallback((newColor: CardColor) => {
    updateData({ color: newColor })
  }, [updateData])

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setNodes(nds => nds.filter(n => n.id !== id))
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id))
  }, [id, setNodes, setEdges])

  // 宸ュ叿鏉′粎鍦ㄩ€変腑/缂栬緫/杩炴帴鎬佸嚭鐜帮紱hover 涓嶅脊鍑猴紝閬垮厤骞叉壈闃呰
  const showToolbar = selected || isEditing || isConnecting
  const colorStroke = CARD_COLORS[color]?.stroke ?? CARD_COLORS.white.stroke
  const fontPx = ANNOTATION_FONT_SIZES[fontSize]
  const frameColor = isEditing
    ? 'var(--accent-blue, #3b82f6)'
    : selected
      ? 'var(--border-strong, #9ca3af)'
      : isHovered
        ? 'var(--border-subtle, #d4d4d8)'
        : 'transparent'

  const handleMouseEnter = useCallback(() => setIsHovered(true), [])
  const handleMouseLeave = useCallback(() => setIsHovered(false), [])

  return (
    <div
      className={`text-anno-node relative ${isEditing ? 'text-anno-node--editing' : ''}`}
      style={{
        width: '100%',
        minWidth: MIN_ANNOTATION_WIDTH,
        minHeight: MIN_ANNOTATION_HEIGHT,
        border: `1.5px solid ${frameColor}`,
        boxShadow: isEditing ? '0 0 0 2px rgba(59, 130, 246, 0.12)' : 'none',
        borderRadius: 6,
        cursor: isEditing ? 'text' : 'grab',
        background: 'transparent',
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleNodeClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 閫変腑鏃舵樉绀鸿璋冩暣澶у皬鎺т欢 */}
      {selected && (
        <NodeResizeControl
          position="bottom-right"
          minWidth={MIN_ANNOTATION_WIDTH}
          minHeight={MIN_ANNOTATION_HEIGHT}
          style={{ width: 10, height: 10, background: 'transparent', border: 'none' }}
          className="!border-0 !bg-transparent !opacity-0"
        />
      )}

      {/* 娴姩宸ュ叿鏉★紙浠呴€変腑/缂栬緫/杩炴帴鎬侊級 */}
      {showToolbar && (
        <div
          className="ui-floating-surface ui-floating-content"
          data-side="top"
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: -42,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 6px',
            borderRadius: 8,
            whiteSpace: 'nowrap',
          }}
        >
          {/* 瀛楀彿鍒囨崲 */}
          <button
            onClick={handleFontSizeToggle}
            className="action-icon-btn"
            style={{ width: 26, height: 24, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
            title={`瀛楀彿 ${fontSize.toUpperCase()}`}
          >
            {fontPx}
          </button>

          <div style={{ width: 1, height: 14, background: isDarkMode ? '#3f3f46' : '#e4e4e7' }} />

          {/* 瀵归綈 */}
          {ALIGN_OPTIONS.map(({ value, Icon, title }) => (
            <button
              key={value}
              onClick={(e) => { e.stopPropagation(); handleAlignChange(value) }}
              className="action-icon-btn"
              style={{
                width: 24, height: 24, cursor: 'pointer',
                background: align === value ? 'var(--surface-card-active, rgba(99,102,241,0.12))' : 'transparent',
                color: align === value ? 'var(--accent-blue, #3b82f6)' : undefined,
              }}
              title={title}
            >
              <Icon size={13} />
            </button>
          ))}

          <div style={{ width: 1, height: 14, background: isDarkMode ? '#3f3f46' : '#e4e4e7' }} />

          {/* 鑹叉澘锛氬皬鍦嗙偣 */}
          <ColorDotPicker color={color} onChange={handleColorChange} />

          <div style={{ width: 1, height: 14, background: isDarkMode ? '#3f3f46' : '#e4e4e7' }} />

          {/* 鍙戣捣杩炴帴 */}
          <button
            onClick={handleStartConnection}
            className="action-icon-btn"
            style={{ width: 24, height: 24, cursor: 'pointer' }}
            title="鍙戣捣杩炴帴"
          >
            <ArrowUpRight size={13} />
          </button>

          {/* 鍒犻櫎 */}
          <button
            onClick={handleDelete}
            className="action-icon-btn"
            style={{ width: 24, height: 24, cursor: 'pointer', color: 'var(--destructive, #ef4444)' }}
            title="鍒犻櫎娉ㄩ噴"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}

      {/* 鍐呭鍖猴細鎷栨嫿 handle + 鍙€夊渾鐐?+ 缂栬緫鍣?*/}
      {color !== 'white' && (
        <div
          className={isEditing ? 'text-anno-drag-handle' : undefined}
          style={{
            position: 'absolute',
            top: 3,
            left: ANNOTATION_PADDING_X,
            right: ANNOTATION_PADDING_X,
            height: 2,
            borderRadius: 999,
            backgroundColor: colorStroke,
            opacity: 0.9,
            cursor: isEditing ? 'grab' : 'inherit',
            pointerEvents: isEditing ? 'auto' : 'none',
          }}
        />
      )}

      <div
        className={isEditing ? undefined : 'text-anno-drag-handle'}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          padding: `${ANNOTATION_PADDING_Y}px ${ANNOTATION_PADDING_X}px`,
          paddingTop: color !== 'white' ? ANNOTATION_PADDING_Y + 5 : ANNOTATION_PADDING_Y,
        }}
      >
        <div
          ref={contentRef}
          style={{ flex: 1, minWidth: 0 }}
          onPointerDown={isEditing ? (e) => e.stopPropagation() : undefined}
          onMouseDown={isEditing ? (e) => e.stopPropagation() : undefined}
          onClick={(e) => {
            if (isEditing) {
              e.stopPropagation()
              editorRef.current?.focus()
            }
          }}
        >
          <div style={{ ['--anno-font-size' as string]: `${fontPx}px` }}>
            <AnnotationEditor
              ref={editorRef}
              content={data.content}
              align={align}
              editable={isEditing}
              onChange={(newContent) => updateData({ content: newContent })}
              onFocus={() => {}}
              onBlur={(finalContent) => {
                setIsEditing(false)
                // 澶辩劍鏃惰嫢鍐呭涓虹┖锛堟棤鏂囨湰锛夊垯鑷姩鍒犻櫎锛岄伩鍏嶉仐鐣欑┖娉ㄩ噴
                const isContentEmpty = (() => {
                  try {
                    const doc = JSON.parse(finalContent)
                    if (!Array.isArray(doc) || doc.length === 0) return true
                    const text = doc.map((b: Record<string, unknown>) => {
                      const content = b.content
                      if (!Array.isArray(content)) return ''
                      return content
                        .map((c: Record<string, unknown>) => (typeof c.text === 'string' ? c.text : ''))
                        .join('')
                    }).join('').trim()
                    return text === ''
                  } catch {
                    return true
                  }
                })()
                if (isContentEmpty) {
                  setNodes(nds => nds.filter(n => n.id !== id))
                  setEdges(eds => eds.filter(e => e.source !== id && e.target !== id))
                }
              }}
            />
          </div>
        </div>
      </div>

      <CardHandles />
    </div>
  )
})

TextAnnotationNode.displayName = 'TextAnnotationNode'

// 鈹€鈹€ 鑹叉澘灏忓渾鐐归€夋嫨鍣?鈹€鈹€
const ColorDotPicker = memo(function ColorDotPicker({
  color,
  onChange,
}: {
  color: CardColor
  onChange: (c: CardColor) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v) }}
        className="action-icon-btn"
        style={{ width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        title="棰滆壊"
      >
        <span style={{
          display: 'block',
          width: 12, height: 12, borderRadius: '50%',
          backgroundColor: CARD_COLORS[color].stroke,
          flexShrink: 0,
        }} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-dropdown)' }} onClick={(e) => { e.stopPropagation(); setOpen(false) }} />
          <div className="ui-floating-surface ui-floating-content" data-side="bottom" style={{
            position: 'absolute',
            top: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 6,
            padding: 6,
            borderRadius: 8,
            width: 110,
          }}>
            {(Object.keys(CARD_COLORS) as CardColor[]).map((c) => (
              <button
                key={c}
                onClick={(e) => { e.stopPropagation(); onChange(c); setOpen(false) }}
                style={{
                  width: 14, height: 14, borderRadius: '50%',
                  backgroundColor: CARD_COLORS[c].stroke,
                  border: color === c ? '2px solid #fff' : '2px solid transparent',
                  boxShadow: color === c ? `0 0 0 1.5px ${CARD_COLORS[c].stroke}` : 'none',
                  cursor: 'pointer',
                }}
                title={c}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
})

