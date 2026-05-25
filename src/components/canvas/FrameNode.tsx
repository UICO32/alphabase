import { memo, useState, useCallback, useRef } from 'react'
import { type NodeProps, type Node, useReactFlow } from '@xyflow/react'
import type { CardNodeData } from '../../types/card'

export interface FrameNodeData extends Record<string, unknown> {
  name: string
  layout?: string
  color?: string
  width: number
  height: number
  childCardIds?: string[]
}

type FrameNodeType = Node<FrameNodeData, 'frame'>

const DEFAULT_FRAME_WIDTH = 600
const DEFAULT_FRAME_HEIGHT = 400

export const FrameNode = memo(({ id, data, selected }: NodeProps<FrameNodeType>) => {
  const { setNodes } = useReactFlow()
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(data.name || 'Frame')
  const [size, setSize] = useState({
    width: data.width ?? DEFAULT_FRAME_WIDTH,
    height: data.height ?? DEFAULT_FRAME_HEIGHT,
  })
  const resizingRef = useRef(false)
  const startPosRef = useRef({ x: 0, y: 0 })
  const startSizeRef = useRef({ width: 0, height: 0 })

  const handleNameSubmit = useCallback(() => {
    setIsEditing(false)
    const trimmed = name.trim() || 'Frame'
    setName(trimmed)
    setNodes(nds => nds.map(n =>
      n.id === id ? { ...n, data: { ...n.data, name: trimmed } } : n
    ))
  }, [id, name, setNodes])

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    resizingRef.current = true
    startPosRef.current = { x: e.clientX, y: e.clientY }
    startSizeRef.current = { ...size }

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return
      const dx = e.clientX - startPosRef.current.x
      const dy = e.clientY - startPosRef.current.y
      const newW = Math.max(300, startSizeRef.current.width + dx)
      const newH = Math.max(200, startSizeRef.current.height + dy)
      setSize({ width: newW, height: newH })
      setNodes(nds => nds.map(n =>
        n.id === id ? { ...n, data: { ...n.data, width: newW, height: newH } } : n
      ))
    }

    const handleMouseUp = () => {
      resizingRef.current = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [id, size, setNodes])

  const borderColor = data.color ?? 'var(--border-default)'

  return (
    <div
      className="rounded-xl border-2 border-dashed relative overflow-hidden"
      style={{
        width: size.width,
        height: size.height,
        borderColor,
        backgroundColor: `${borderColor}08`,
        boxShadow: selected ? 'var(--shadow-glow-blue)' : 'none',
      }}
    >
      <div
        className="px-4 py-2 select-none"
        style={{ borderBottom: `1px solid ${borderColor}20` }}
      >
        {isEditing ? (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => { if (e.key === 'Enter') handleNameSubmit() }}
            className="text-sm font-medium bg-transparent border-none outline-none w-full"
            style={{ color: 'var(--text-primary)' }}
            autoFocus
          />
        ) : (
          <span
            className="text-sm font-medium cursor-pointer truncate"
            style={{ color: 'var(--text-secondary)' }}
            onDoubleClick={() => setIsEditing(true)}
          >
            {name}
          </span>
        )}
      </div>

      {selected && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10"
          onMouseDown={handleResizeStart}
        >
          <svg viewBox="0 0 16 16" className="w-full h-full" style={{ color: 'var(--text-tertiary)' }}>
            <path
              d="M8 8L16 16M12 16L16 12M16 8L8 16"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </div>
      )}
    </div>
  )
})

FrameNode.displayName = 'FrameNode'
