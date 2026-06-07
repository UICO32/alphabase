import { memo, useState, useCallback, useMemo, useSyncExternalStore } from 'react'
import { type NodeProps, type Node, useReactFlow, useStore } from '@xyflow/react'
import { createPortal } from 'react-dom'
import { computeLayout, saveCardSnapshots, saveFrameSnapshot, restoreOrComputePositions, restoreFrameDimensions, updateSingleCardSnapshot, type FrameLayout, type KanbanColumn } from '../../utils/frameLayouts'
import type { CardNodeData } from '../../types/card'
import { kanbanDragPreview } from '../../utils/kanbanDragPreview'
import { useFrameInteraction } from '../../utils/frameInteraction'
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
const HEADER_HEIGHT = 44

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const LAYOUT_OPTIONS: { value: FrameLayout; label: string }[] = [
  { value: 'free', label: '自由画布' },
  { value: 'bento', label: 'Bento' },
  { value: 'kanban', label: '看板' },
]

export const FrameNode = memo(({ id, data, selected }: NodeProps<FrameNodeType>) => {
  const { setNodes } = useReactFlow()
  const zoom = useStore((s) => s.transform[2])
  const isDarkMode = useIsDarkMode()
  const isDragOver = useFrameInteraction(s => s.dragOverFrameId === id)

  const kanbanPreview = useSyncExternalStore(
    kanbanDragPreview.subscribe.bind(kanbanDragPreview),
    kanbanDragPreview.get.bind(kanbanDragPreview),
  )

  const [isEditing, setIsEditing] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [name, setName] = useState(data.name || 'Frame')
  const [size, setSize] = useState({
    width: data.width ?? DEFAULT_FRAME_WIDTH,
    height: data.height ?? DEFAULT_FRAME_HEIGHT,
  })
  const [showLayoutMenu, setShowLayoutMenu] = useState(false)
  const [showColorMenu, setShowColorMenu] = useState(false)
  const [colorMenuPos, setColorMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [layoutMenuPos, setLayoutMenuPos] = useState<{ x: number; y: number } | null>(null)

  const currentLayout = data.layout ?? 'free'
  const frameColor = data.color ?? '#6366f1'

  const handleColorChange = useCallback((color: string) => {
    setShowColorMenu(false)
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, color } } : n)),
    )
  }, [id, setNodes])

  const handleNameSubmit = useCallback(() => {
    setIsEditing(false)
    const trimmed = name.trim() || 'Frame'
    setName(trimmed)
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, name: trimmed } } : n)),
    )
  }, [id, name, setNodes])

  const handleLayoutChange = useCallback(
    (layout: FrameLayout) => {
      setShowLayoutMenu(false)
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
          return updatedData ? { ...n, data: updatedData } : n
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
          if (!pos) return n

          const baseData = (cardSnapshots.get(n.id) ?? n.data) as Record<string, unknown>
          return {
            ...n,
            position: {
              x: frameNode.position.x + pos.x,
              y: frameNode.position.y + pos.y,
            },
            data: {
              ...baseData,
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
      const currentZoom = zoom
      const frameLayout = currentLayout

      const handleMouseMove = (ev: MouseEvent) => {
        ev.preventDefault()
        const dx = (ev.clientX - startX) / currentZoom
        const dy = (ev.clientY - startY) / currentZoom
        let newW = startW
        let newH = startH
        if (dir.includes('e')) newW = Math.max(300, startW + dx)
        if (dir.includes('s')) newH = Math.max(200, startH + dy)
        if (dir.includes('w')) newW = Math.max(300, startW - dx)
        if (dir.includes('n')) newH = Math.max(200, startH - dy)
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
                data: saveFrameSnapshot({ ...fd, width: size.width, height: size.height, snapshotVersion: newVersion }, frameLayout),
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
    [id, size, setNodes, zoom, currentLayout],
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
        zIndex: 9999,
      }}
      onClick={(e) => {
        e.stopPropagation()
        setShowColorMenu(false)
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: (colorMenuPos?.x ?? 0),
          top: (colorMenuPos?.y ?? 0),
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          padding: 10,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 6,
          zIndex: 10000,
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
              borderRadius: '50%',
              backgroundColor: c.value,
              border: c.value === frameColor ? '2.5px solid #1a1a1a' : '2px solid rgba(0,0,0,0.08)',
              boxShadow: c.value === frameColor ? '0 0 0 2px rgba(255,255,255,0.8)' : 'none',
              cursor: 'pointer',
              transition: 'transform 0.15s',
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
        zIndex: 9999,
      }}
      onClick={(e) => {
        e.stopPropagation()
        setShowLayoutMenu(false)
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: (layoutMenuPos?.x ?? 0),
          top: (layoutMenuPos?.y ?? 0),
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          padding: '4px 0',
          minWidth: 120,
          zIndex: 10000,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {LAYOUT_OPTIONS.map((option) => (
          <button
            key={option.value}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 16px',
              fontSize: 13,
              color: option.value === currentLayout ? '#1a1a1a' : '#666',
              fontWeight: option.value === currentLayout ? 600 : 400,
              background: option.value === currentLayout ? 'rgba(0,0,0,0.05)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            onClick={(e) => {
              e.stopPropagation()
              handleLayoutChange(option.value)
            }}
          >
            {option.label}
          </button>
        ))}
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

  const tagScale = 1 / zoom
  const ts = tagScale
  const tagFontSize = 11 * ts
  const tagDotSize = 3 * ts
  const tagPaddingH = 10 * ts
  const tagPaddingV = 4 * ts
  const tagGap = 2 * ts
  const tagMaxWidth = 80 * ts
  const tagInputWidth = 24 * ts
  const tagBorderWidth = 1 * ts
  const tagBorderRadius = 6 * ts
  const dragHandleHeight = Math.max(44, 28 * ts)

  const rs = tagScale
  const edgeSize = Math.max(2, EDGE_SIZE * rs)
  const cornerSize = Math.max(4, CORNER_SIZE * rs)

  const resizeEdges: { dir: ResizeDir; style: React.CSSProperties }[] = selected
    ? [
        { dir: 'n', style: { top: 0, left: cornerSize, right: cornerSize, height: edgeSize, cursor: 'n-resize' } },
        { dir: 's', style: { bottom: 0, left: cornerSize, right: cornerSize, height: edgeSize, cursor: 's-resize' } },
        { dir: 'e', style: { right: 0, top: cornerSize, bottom: cornerSize, width: edgeSize, cursor: 'e-resize' } },
        { dir: 'w', style: { left: 0, top: cornerSize, bottom: cornerSize, width: edgeSize, cursor: 'w-resize' } },
        { dir: 'ne', style: { top: 0, right: 0, width: cornerSize, height: cornerSize, cursor: 'ne-resize' } },
        { dir: 'nw', style: { top: 0, left: 0, width: cornerSize, height: cornerSize, cursor: 'nw-resize' } },
        { dir: 'se', style: { bottom: 0, right: 0, width: cornerSize, height: cornerSize, cursor: 'se-resize' } },
        { dir: 'sw', style: { bottom: 0, left: 0, width: cornerSize, height: cornerSize, cursor: 'sw-resize' } },
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
        border: `${Math.max(0.5, 1.5 * ts)}px solid ${borderColor}`,
        boxShadow,
        pointerEvents: 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      {/* 标签区域 — 拖拽 + hover + 双击编辑 */}
      <div
        className="frame-drag-handle select-none absolute"
        style={{
          top: 0,
          left: 0,
          height: dragHandleHeight,
          zIndex: 3,
          pointerEvents: 'auto',
          cursor: 'grab',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className="inline-flex items-center"
          style={{
            marginTop: 4 * ts,
            marginLeft: 6 * ts,
            background: isDarkMode
              ? `color-mix(in srgb, ${frameColor} 18%, rgba(25,25,25,0.98))`
              : `color-mix(in srgb, ${frameColor} 18%, rgba(255,255,255,0.98))`,
            border: `${tagBorderWidth}px solid ${isDarkMode ? frameColor + '60' : frameColor + '50'}`,
            borderRadius: tagBorderRadius,
            padding: `${tagPaddingV}px ${tagPaddingH}px`,
            gap: tagGap,
            fontSize: tagFontSize,
            lineHeight: 1.4,
            transition: 'border-color 0.15s',
            boxShadow: isDarkMode ? '0 1px 4px rgba(0,0,0,0.4)' : '0 1px 4px rgba(0,0,0,0.08)',
          }}
        >
          {isEditing ? (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSubmit()
              }}
              style={{
                width: tagInputWidth,
                fontSize: tagFontSize,
                fontWeight: 600,
                color: isDarkMode ? '#c8c8c8' : '#333',
                background: 'transparent',
                border: 'none',
                outline: 'none',
              }}
              autoFocus
            />
          ) : (
            <span
              style={{
                fontWeight: 600,
                color: isDarkMode ? '#c8c8c8' : '#333',
                letterSpacing: -0.3,
                cursor: 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: tagMaxWidth,
              }}
              onDoubleClick={() => setIsEditing(true)}
            >
              {name}
            </span>
          )}

          <button
              style={{
                width: tagDotSize,
                height: tagDotSize,
                borderRadius: '50%',
                backgroundColor: frameColor,
                boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'transform 0.15s',
              }}
              onClick={(e) => {
                e.stopPropagation()
                const rect = (e.target as HTMLElement).getBoundingClientRect()
                setColorMenuPos({ x: rect.left - 40, y: rect.bottom + 6 })
                setShowColorMenu((v) => !v)
                setShowLayoutMenu(false)
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.25)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            />
            <button
              style={{
                fontSize: tagFontSize,
                padding: `${0.5 * ts}px ${1.5 * ts}px`,
                borderRadius: 3 * ts,
                color: isDarkMode ? '#a0a0a0' : '#6b6b6b',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
              onClick={(e) => {
                e.stopPropagation()
                const rect = (e.target as HTMLElement).getBoundingClientRect()
                setLayoutMenuPos({ x: rect.right - 120, y: rect.bottom + 4 })
                setShowLayoutMenu((v) => !v)
                setShowColorMenu(false)
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {LAYOUT_OPTIONS.find((l) => l.value === currentLayout)?.label}
            </button>
          </div>
        </div>

        {/* 看板列头 */}
        {currentLayout === 'kanban' && kanbanColumns.length > 0 && (
        <div
          className="absolute inset-0 flex pointer-events-none"
          style={{ top: HEADER_HEIGHT + 1 }}
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