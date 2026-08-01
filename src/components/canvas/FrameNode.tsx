import { memo, useState, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { type NodeProps, type Node, useReactFlow } from '@xyflow/react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { computeLayout, saveCardSnapshots, saveFrameSnapshot, restoreOrComputePositions, restoreFrameDimensions, updateSingleCardSnapshot, type FrameLayout, type KanbanColumn, KANBAN_CARD_HEIGHT } from './utils/frameLayouts'
import { computeResize, type ResizeDir } from './utils/frameResize'
import type { CardNodeData } from '../../types/card'
import { kanbanDragPreview } from './utils/kanbanDragPreview'
import { useFrameInteraction } from './utils/frameInteraction'
import { useIsDarkMode } from '../../hooks/useIsDarkMode'

const FRAME_COLORS: { value: string; label: string }[] = [
  { value: '#6366f1', label: '靛蓝' },
  { value: '#3b82f6', label: '蓝' },
  { value: '#10b981', label: '绿' },
  { value: '#f59e0b', label: '琥珀' },
  { value: '#ef4444', label: '红' },
  { value: '#8b5cf6', label: '薰衣草' },
  { value: '#ec4899', label: '粉' },
  { value: '#14b8a6', label: '青' },
]

export interface FrameLayoutSnapshot {
  width: number
  height: number
  columns?: KanbanColumn[]
  version?: number
}

export interface FrameNodeData extends Record<string, unknown> {
  name: string
  description?: string
  layout?: FrameLayout
  color?: string
  width: number
  height: number
  childCardIds?: string[]
  columns?: KanbanColumn[]
  layoutSnapshots?: Partial<Record<FrameLayout, FrameLayoutSnapshot>>
  snapshotVersion?: number
}

type FrameNodeType = Node<FrameNodeData, 'frame'>

const DEFAULT_FRAME_WIDTH = 600
const DEFAULT_FRAME_HEIGHT = 400
const EDGE_SIZE = 8
const CORNER_SIZE = 16
const TITLE_MIN_CHARS = 8
const TITLE_MAX_WIDTH = 480

const LAYOUT_OPTIONS: { value: FrameLayout; label: string }[] = [
  { value: 'free', label: '自由画布' },
  { value: 'bento', label: 'Bento' },
  { value: 'kanban', label: '看板' },
]

export const FrameNode = memo(({ id, data, selected }: NodeProps<FrameNodeType>) => {
  const { setNodes, getViewport } = useReactFlow()
  // 注意：这里不再订阅 React Flow 的 transform。
  // 标签/边框等逆缩放尺寸改用 CSS 变量 --rf-inv-zoom（由 ReactFlowCanvas.onMove
  // 每帧更新），浏览器原生处理，避免缩放时整个 FrameNode 每帧重渲染。
  const isDarkMode = useIsDarkMode()
  const isDragOver = useFrameInteraction(s => s.dragOverFrameId === id)

  const kanbanPreview = useSyncExternalStore(
    kanbanDragPreview.subscribe.bind(kanbanDragPreview),
    kanbanDragPreview.get.bind(kanbanDragPreview),
  )

  const [isEditing, setIsEditing] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isTitleHovered, setIsTitleHovered] = useState(false)
  const [name, setName] = useState(data.name || 'Frame')
  const [description, setDescription] = useState((data.description as string | undefined) ?? '')
  const [titleDraft, setTitleDraft] = useState([data.name || 'Frame', data.description].filter(Boolean).join('\n'))
  const titleInputRef = useRef<HTMLTextAreaElement | null>(null)
  const titlePointerStart = useRef<{ x: number; y: number } | null>(null)
  const [size, setSize] = useState({
    width: data.width ?? DEFAULT_FRAME_WIDTH,
    height: data.height ?? DEFAULT_FRAME_HEIGHT,
  })
  const [showColorMenu, setShowColorMenu] = useState(false)
  const [colorMenuPos, setColorMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [showLayoutMenu, setShowLayoutMenu] = useState(false)
  const [layoutMenuPos, setLayoutMenuPos] = useState<{ x: number; y: number } | null>(null)

  const currentLayout = data.layout ?? 'free'
  const frameColor = data.color ?? '#6366f1'

  useEffect(() => {
    setSize({
      width: data.width ?? DEFAULT_FRAME_WIDTH,
      height: data.height ?? DEFAULT_FRAME_HEIGHT,
    })
  }, [data.width, data.height])

  useEffect(() => {
    setName(data.name || 'Frame')
    setDescription((data.description as string | undefined) ?? '')
    setTitleDraft([data.name || 'Frame', data.description].filter(Boolean).join('\n'))
  }, [data.name, data.description])

  useEffect(() => {
    if (!isEditing) return
    const input = titleInputRef.current
    if (!input) return
    const newlineIndex = input.value.search(/\r?\n/)
    const end = newlineIndex === -1 ? input.value.length : newlineIndex
    input.focus()
    input.setSelectionRange(end, end)
  }, [isEditing])

  const handleColorChange = useCallback((color: string) => {
    setShowColorMenu(false)
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, color } } : n)),
    )
  }, [id, setNodes])

  const startTitleEdit = useCallback(() => {
    setShowLayoutMenu(false)
    setShowColorMenu(false)
    setTitleDraft([name || 'Frame', description].filter(Boolean).join('\n'))
    setIsEditing(true)
  }, [description, name])

  const handleTitlePointerDown = useCallback((e: React.PointerEvent) => {
    titlePointerStart.current = { x: e.clientX, y: e.clientY }
  }, [])

  const handleTitleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button, textarea')) return

    const start = titlePointerStart.current
    titlePointerStart.current = null
    if (start) {
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (Math.hypot(dx, dy) > 4) return
    }
    startTitleEdit()
  }, [startTitleEdit])

  const handleNameSubmit = useCallback(() => {
    setIsEditing(false)
    const [rawTitle = '', ...rawDescription] = titleDraft.split(/\r?\n/)
    const trimmed = rawTitle.trim() || 'Frame'
    const nextDescription = rawDescription.join('\n').trim()
    setName(trimmed)
    setDescription(nextDescription)
    setTitleDraft([trimmed, nextDescription].filter(Boolean).join('\n'))
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, name: trimmed, description: nextDescription } } : n)),
    )
  }, [id, titleDraft, setNodes])

  const handleLayoutChange = useCallback(
    (layout: FrameLayout) => {
      setNodes((nds) => {
        const frameNode = nds.find((n) => n.id === id)
        if (!frameNode) return nds

        const currentLayout = (frameNode.data as FrameNodeData).layout ?? 'free'

        const children = nds.filter((n) => {
          const nd = n.data as Record<string, unknown>
          return nd.frameId === id
        })

        // 1. 保存当前 layout 的子卡片快照
        const cardSnapshots = saveCardSnapshots(
          children,
          { x: frameNode.position.x, y: frameNode.position.y },
          currentLayout,
        )

        // 2. 保存当前 layout 的 Frame 快照
        const frameData = frameNode.data as FrameNodeData
        const updatedFrameData = saveFrameSnapshot(frameData, currentLayout)

        // 3. 确定目标 layout 的 Frame 尺寸
        const restored = restoreFrameDimensions(updatedFrameData, layout)

        // 构造虚拟 Frame 节点供 computeLayout 使用
        const virtualFrame = {
          ...frameNode,
          data: {
            ...updatedFrameData,
            width: restored.width,
            height: restored.height,
            columns: restored.columns,
            layout,
          },
        }

        // 4. 恢复或计算目标 layout 的子卡片位置
        const childrenWithUpdatedData = children.map((n) => {
          const updatedData = cardSnapshots.get(n.id)
          const base = updatedData ? { ...n, data: updatedData } : n
          if (layout === 'kanban') {
            const nd = base.data as Record<string, unknown>
            return { ...base, data: { ...nd, height: KANBAN_CARD_HEIGHT } }
          }
          return base
        })

        const result = restoreOrComputePositions(
          virtualFrame,
          childrenWithUpdatedData,
          layout,
          cardSnapshots,
          updatedFrameData.snapshotVersion,
        )

        // 5. 应用变更
        return nds.map((n) => {
          if (n.id === id) {
            return {
              ...n,
              data: {
                ...updatedFrameData,
                layout,
                width: restored.width,
                height: restored.height,
                ...(restored.columns ? { columns: restored.columns } : {}),
              },
            }
          }

          const pos = result.positions[n.id]
          // 子卡即使没有位置变更（理论上 layout 切换都有），也要同步下沉新的 frameLayout，
          // 否则 CardNode 仍读到旧 data.frameLayout，无法正确切换 MiniCard 渲染。
          const isChild = (n.data as Record<string, unknown>).frameId === id
          if (!isChild) return n

          const baseData = (cardSnapshots.get(n.id) ?? n.data) as Record<string, unknown>
          if (!pos) {
            return { ...n, data: { ...baseData, frameLayout: layout } }
          }

          return {
            ...n,
            position: {
              x: frameNode.position.x + pos.x,
              y: frameNode.position.y + pos.y,
            },
            data: {
              ...baseData,
              frameLayout: layout,
              localX: pos.x,
              localY: pos.y,
              ...(pos.width ? { width: pos.width } : {}),
              ...(pos.height ? { height: pos.height } : {}),
            },
          }
        })
      })
    },
    [id, setNodes],
  )

  const handleResizeStart = useCallback(
    (dir: ResizeDir) => (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      const startX = e.clientX
      const startY = e.clientY
      const startW = size.width
      const startH = size.height
      // 动态取当前缩放（不订阅 transform，避免每帧重渲染）
      const currentZoom = getViewport().zoom
      const frameLayout = currentLayout

      const handleMouseMove = (ev: MouseEvent) => {
        ev.preventDefault()
        const dx = (ev.clientX - startX) / currentZoom
        const dy = (ev.clientY - startY) / currentZoom
        const { width: newW, height: newH } = computeResize(dir, dx, dy, startW, startH)
        setSize({ width: newW, height: newH })
        setNodes((nds) => {
          const frameIdx = nds.findIndex((n) => n.id === id)
          if (frameIdx === -1) return nds
          const frameNode = nds[frameIdx]
          const updatedFrame = { ...frameNode, data: { ...frameNode.data, width: newW, height: newH } }

          if (frameLayout === 'free') {
            const next = [...nds]
            next[frameIdx] = updatedFrame
            return next
          }

          // kanban / bento: re-layout children to fit new dimensions
          const children = nds.filter((n) => (n.data as Record<string, unknown>).frameId === id)
          const result = computeLayout(updatedFrame, children, frameLayout)
          return nds.map((n) => {
            if (n.id === id) return updatedFrame
            const pos = result.positions[n.id]
            if (pos) {
              return {
                ...n,
                position: { x: frameNode.position.x + pos.x, y: frameNode.position.y + pos.y },
                data: { ...n.data, localX: pos.x, localY: pos.y, ...(pos.width ? { width: pos.width } : {}), ...(pos.height ? { height: pos.height } : {}) },
              }
            }
            return n
          })
        })
      }

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
        // save snapshot + bump version (invalidates other layout snapshots)
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === id) {
              const fd = n.data as FrameNodeData
              const newVersion = (fd.snapshotVersion ?? 0) + 1
              return {
                ...n,
                data: saveFrameSnapshot({ ...fd, snapshotVersion: newVersion }, frameLayout),
              }
            }
            const nd = n.data as CardNodeData
            if (nd.frameId === id) {
              return { ...n, data: updateSingleCardSnapshot(nd, frameLayout, nd.localX ?? 0, nd.localY ?? 0, nd.width, nd.height) }
            }
            return n
          }),
        )
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [id, size, setNodes, getViewport, currentLayout],
  )

  const kanbanColumns: KanbanColumn[] = useMemo(() => {
    if (currentLayout !== 'kanban') return []
    return data.columns ?? [
      { id: 'col-0', title: 'To Do', color: '#6366f1' },
      { id: 'col-1', title: 'In Progress', color: '#f59e0b' },
      { id: 'col-2', title: 'Done', color: '#10b981' },
    ]
  }, [currentLayout, data.columns])

  const menuPortal = typeof document !== 'undefined' ? document.body : null

  const colorMenu = showColorMenu && (
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 'var(--z-dropdown)',
      }}
      onClick={(e) => {
        e.stopPropagation()
        setShowColorMenu(false)
      }}
    >
      <div
        className="ui-floating-surface ui-floating-content"
        data-side="bottom"
        style={{
          position: 'absolute',
          left: (colorMenuPos?.x ?? 0),
          top: (colorMenuPos?.y ?? 0),
          backdropFilter: 'blur(12px)',
          borderRadius: 12,
          padding: 10,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 28px)',
          gap: 6,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {FRAME_COLORS.map((c) => (
          <button
            key={c.value}
            title={c.label}
            style={{
              width: 28,
              height: 28,
              minWidth: 28,
              minHeight: 28,
              maxWidth: 28,
              maxHeight: 28,
              borderRadius: '50%',
              backgroundColor: c.value,
              border: c.value === frameColor ? '2.5px solid #1a1a1a' : '2px solid rgba(0,0,0,0.08)',
              boxShadow: c.value === frameColor ? '0 0 0 2px rgba(255,255,255,0.8)' : 'none',
              cursor: 'pointer',
              padding: 0,
              aspectRatio: '1 / 1',
              boxSizing: 'border-box',
              transition: 'filter var(--duration-fast) var(--ease-default)',
            }}
            onClick={(e) => {
              e.stopPropagation()
              handleColorChange(c.value)
            }}
          />
        ))}
      </div>
    </div>
  )

  const layoutMenu = showLayoutMenu && (
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 'var(--z-dropdown)',
      }}
      onClick={(e) => {
        e.stopPropagation()
        setShowLayoutMenu(false)
      }}
    >
      <div
        className="ui-floating-surface ui-floating-content"
        data-side="bottom"
        style={{
          position: 'absolute',
          left: layoutMenuPos?.x ?? 0,
          top: layoutMenuPos?.y ?? 0,
          minWidth: 118,
          padding: 5,
          borderRadius: 10,
          backdropFilter: 'blur(12px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {LAYOUT_OPTIONS.map((option) => {
          const active = option.value === currentLayout
          return (
            <button
              key={option.value}
              style={{
                width: '100%',
                padding: '6px 8px',
                borderRadius: 7,
                border: 'none',
                background: active
                  ? (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.045)')
                  : 'transparent',
                color: active ? frameColor : (isDarkMode ? '#d1d1d1' : '#3f3f3f'),
                fontSize: 12,
                fontWeight: active ? 600 : 500,
                lineHeight: 1.25,
                textAlign: 'left',
                cursor: 'pointer',
              }}
              onClick={(e) => {
                e.stopPropagation()
                setShowLayoutMenu(false)
                if (!active) handleLayoutChange(option.value)
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )

  const borderDragOver = frameColor + 'aa'
  const borderDefault = frameColor + '44'
  const borderHover = frameColor + '66'
  const shadowDefault = isDarkMode ? '0 1px 3px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.06)'
  const shadowHover = isDarkMode ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.1)'
  const shadowSelected = isDarkMode ? `0 0 0 2px ${frameColor}50, 0 4px 16px rgba(0,0,0,0.3)` : `0 0 0 2px ${frameColor}40, 0 4px 16px rgba(0,0,0,0.1)`
  const shadowDragOver = `0 0 0 3px ${frameColor}66, 0 4px 20px rgba(0,0,0,0.15)`

  const borderColor = isDragOver ? borderDragOver
    : selected ? frameColor + '66'
    : isHovered ? borderHover
    : borderDefault
  const boxShadow = isDragOver ? shadowDragOver
    : selected ? shadowSelected
    : isHovered ? shadowHover
    : shadowDefault

  // 缩放逆尺寸：所有值保持"zoom=1 时的基准"，实际渲染用
  // calc(<base>px * var(--rf-inv-zoom, 1))（--rf-inv-zoom 由 ReactFlowCanvas
  // 每帧更新，浏览器原生处理，FrameNode 自身不因缩放重渲染）。
  const tagFontSize = 11
  const tagDotSize = 9
  const tagPaddingH = 10
  const tagPaddingV = 2.5
  const tagMaxWidth = 80
  const tagBorderWidth = 1
  const tagBorderRadius = 6
  const titleControlHeight = 20
  const titleModuleHeight = titleControlHeight + (tagPaddingV * 2) + (tagBorderWidth * 2)
  const frameBorderW = 1.5
  const headerFrameGap = 8
  const dragHandleHeight = 36
  const titleTextForWidth = isEditing ? titleDraft.split(/\r?\n/)[0]?.trim() ?? '' : name.trim()
  const titleDisplayChars = Math.max(TITLE_MIN_CHARS, titleTextForWidth.length)
  const titleMinWidth = Math.max(64, TITLE_MIN_CHARS * tagFontSize * 0.62 + 28)
  const titleMaxWidth = Math.max(titleMinWidth, TITLE_MAX_WIDTH)
  const titleMeasuredWidth = Math.max(
    titleMinWidth,
    Math.min(titleMaxWidth, titleDisplayChars * tagFontSize * 0.62 + 28),
  )
  const titleDisplayMaxWidth = Math.max(titleMinWidth, TITLE_MAX_WIDTH)

  const edgeSize = Math.max(2, EDGE_SIZE)
  const cornerSize = Math.max(4, CORNER_SIZE)
  // 统一逆缩放函数：把 zoom=1 时的基准尺寸转为随 --rf-inv-zoom 缩放的样式值
  const rz = (base: number) => `calc(${base}px * var(--rf-inv-zoom, 1))`

  const resizeEdges: { dir: ResizeDir; style: React.CSSProperties }[] = selected
    ? [
        { dir: 'n', style: { top: 0, left: rz(cornerSize), right: rz(cornerSize), height: rz(edgeSize), cursor: 'n-resize' } },
        { dir: 's', style: { bottom: 0, left: rz(cornerSize), right: rz(cornerSize), height: rz(edgeSize), cursor: 's-resize' } },
        { dir: 'e', style: { right: 0, top: rz(cornerSize), bottom: rz(cornerSize), width: rz(edgeSize), cursor: 'e-resize' } },
        { dir: 'w', style: { left: 0, top: rz(cornerSize), bottom: rz(cornerSize), width: rz(edgeSize), cursor: 'w-resize' } },
        { dir: 'ne', style: { top: 0, right: 0, width: rz(cornerSize), height: rz(cornerSize), cursor: 'ne-resize' } },
        { dir: 'nw', style: { top: 0, left: 0, width: rz(cornerSize), height: rz(cornerSize), cursor: 'nw-resize' } },
        { dir: 'se', style: { bottom: 0, right: 0, width: rz(cornerSize), height: rz(cornerSize), cursor: 'se-resize' } },
        { dir: 'sw', style: { bottom: 0, left: 0, width: rz(cornerSize), height: rz(cornerSize), cursor: 'sw-resize' } },
      ]
    : []

  return (
    <div
      className="frame-node relative"
      style={{
        width: size.width,
        height: size.height,
        background: isDarkMode
          ? `color-mix(in srgb, ${frameColor} 8%, rgba(30,30,30,0.03))`
          : `color-mix(in srgb, ${frameColor} 8%, rgba(255,255,255,0.3))`,
        borderRadius: 18,
        border: `${rz(frameBorderW)} solid ${selected || isDragOver || isHovered ? borderColor : 'transparent'}`,
        boxShadow,
        pointerEvents: 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      {/* 标签区域 — 拖拽 + hover + 双击编辑，放在 Frame 上方避免被卡片遮挡 */}
      <div
        className={`${isEditing ? '' : 'frame-drag-handle select-none'} absolute`}
        style={{
          top: rz(-(dragHandleHeight + frameBorderW + headerFrameGap)),
          left: 0,
          height: rz(dragHandleHeight),
          zIndex: 1,
          pointerEvents: 'auto',
          cursor: isEditing ? 'default' : 'grab',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className="inline-flex items-center"
          style={{
            marginTop: rz(2),
            marginLeft: 0,
            gap: rz(5),
          }}
        >
        <div
          className="inline-flex items-center"
          style={{
            background: isDarkMode
              ? `color-mix(in srgb, ${frameColor} 18%, rgba(25,25,25,0.98))`
              : `color-mix(in srgb, ${frameColor} 18%, rgba(255,255,255,0.98))`,
            border: `${rz(tagBorderWidth)} solid ${isDarkMode ? frameColor + '60' : frameColor + '50'}`,
            borderRadius: rz(tagBorderRadius),
            padding: `${rz(tagPaddingV)} ${rz(tagPaddingH)}`,
            gap: rz(6),
            fontSize: rz(tagFontSize),
            lineHeight: 1,
            transition: 'border-color 0.15s, background-color 0.15s',
            boxShadow: isDarkMode ? '0 1px 4px rgba(0,0,0,0.4)' : '0 1px 4px rgba(0,0,0,0.08)',
          }}
          onPointerDown={handleTitlePointerDown}
          onClick={handleTitleClick}
          onMouseDown={(e) => {
            if (isEditing) e.stopPropagation()
          }}
        >
          <button
            style={{
              width: rz(tagDotSize),
              height: rz(tagDotSize),
              minWidth: rz(tagDotSize),
              minHeight: rz(tagDotSize),
              borderRadius: '50%',
              backgroundColor: frameColor,
              boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
              border: `${rz(tagBorderWidth)} solid ${isDarkMode ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.85)'}`,
              cursor: 'pointer',
              flexShrink: 0,
              padding: 0,
              aspectRatio: '1 / 1',
              boxSizing: 'border-box',
              transition: 'transform 0.15s',
            }}
            onClick={(e) => {
              e.stopPropagation()
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              setColorMenuPos({ x: rect.left - 40, y: rect.bottom + 6 })
              setShowLayoutMenu(false)
              setShowColorMenu((v) => !v)
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(0.9)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
          />
          {isEditing ? (
            <textarea
              ref={titleInputRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleNameSubmit}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleNameSubmit()
                }
              }}
              style={{
                width: rz(titleMeasuredWidth),
                minWidth: rz(titleMinWidth),
                maxWidth: rz(titleDisplayMaxWidth),
                height: rz(titleControlHeight),
                minHeight: rz(titleControlHeight),
                maxHeight: rz(titleControlHeight),
                padding: `0 ${rz(7)}`,
                fontSize: rz(tagFontSize),
                fontFamily: 'inherit',
                fontWeight: 600,
                color: isDarkMode ? '#c8c8c8' : '#333',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                overflow: 'hidden',
                lineHeight: rz(titleControlHeight),
                whiteSpace: 'nowrap',
                boxSizing: 'border-box',
              }}
              autoFocus
            />
          ) : (
            <span
              style={{
                display: 'block',
                color: isDarkMode ? '#c8c8c8' : '#333',
                letterSpacing: 0,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                maxWidth: rz(Math.max(tagMaxWidth, titleDisplayMaxWidth)),
                width: rz(titleMeasuredWidth),
                minWidth: rz(titleMinWidth),
                height: rz(titleControlHeight),
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                padding: `0 ${rz(7)}`,
                borderRadius: rz(5),
                background: isTitleHovered
                  ? (isDarkMode ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.026)')
                  : 'transparent',
                lineHeight: rz(titleControlHeight),
                transition: 'background-color 0.15s',
                boxSizing: 'border-box',
              }}
              onMouseEnter={() => setIsTitleHovered(true)}
              onMouseLeave={() => setIsTitleHovered(false)}
            >
              <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
            </span>
          )}
          </div>
          <button
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: rz(3),
              height: rz(titleModuleHeight),
              minWidth: rz(32),
              padding: `0 ${rz(7)}`,
              borderRadius: rz(tagBorderRadius),
              border: `${rz(tagBorderWidth)} solid ${isDarkMode ? frameColor + '45' : frameColor + '35'}`,
              background: isDarkMode
                ? `color-mix(in srgb, ${frameColor} 10%, rgba(25,25,25,0.96))`
                : `color-mix(in srgb, ${frameColor} 10%, rgba(255,255,255,0.96))`,
              boxShadow: isDarkMode ? '0 1px 4px rgba(0,0,0,0.32)' : '0 1px 4px rgba(0,0,0,0.07)',
              flexShrink: 0,
              color: isDarkMode ? '#a8a8a8' : '#5f5f5f',
              cursor: 'pointer',
              fontSize: rz(tagFontSize),
              fontWeight: 600,
              lineHeight: 1,
            }}
            onClick={(e) => {
              e.stopPropagation()
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              setLayoutMenuPos({ x: rect.left, y: rect.bottom + 6 })
              setShowColorMenu(false)
              setShowLayoutMenu((v) => !v)
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span style={{ whiteSpace: 'nowrap' }}>
              {LAYOUT_OPTIONS.find((option) => option.value === currentLayout)?.label}
            </span>
            <ChevronDown
              size={rz(12)}
              strokeWidth={2}
              style={{
                flexShrink: 0,
                transform: showLayoutMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s',
              }}
            />
          </button>
          </div>
        </div>

        {/* 看板列头 */}
        {currentLayout === 'kanban' && kanbanColumns.length > 0 && (
        <div
          className="absolute inset-0 flex pointer-events-none"
          style={{ top: 8 }}
        >
          {kanbanColumns.map((col, i) => (
            <div
              key={col.id}
              className="flex-1 relative"
              style={{
                borderRight: i < kanbanColumns.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <div
                className="px-3 py-2 flex items-center gap-2"
                style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: col.color ?? frameColor }}
                />
                <span
                  className="text-xs font-semibold truncate"
                  style={{ color: isDarkMode ? '#e5e5e5' : '#1a1a1a' }}
                >
                  {col.title}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resize 手柄（仅选中时显示） */}
      {resizeEdges.map(({ dir, style }) => (
        <div
          key={dir}
          className="absolute pointer-events-auto"
          style={style}
          onMouseDown={handleResizeStart(dir)}
        />
      ))}

      {/* 看板拖拽虚线预览框 */}
      {kanbanPreview && kanbanPreview.frameId === id && (
        <div
          style={{
            position: 'absolute',
            left: kanbanPreview.localX,
            top: kanbanPreview.localY,
            width: kanbanPreview.width,
            height: kanbanPreview.height,
            border: '2px dashed rgba(99,102,241,0.4)',
            borderRadius: 12,
            pointerEvents: 'none',
            background: 'rgba(99,102,241,0.06)',
          }}
        />
      )}

      {menuPortal && createPortal(colorMenu, menuPortal)}
      {menuPortal && createPortal(layoutMenu, menuPortal)}
    </div>
  )
})

FrameNode.displayName = 'FrameNode'
