import { memo, useState, useCallback, useRef } from 'react'
import { type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'

export interface SectionNodeData extends Record<string, unknown> {
  name?: string
  color?: string
  width?: number
  height?: number
}

type SectionNodeType = Node<SectionNodeData, 'section'>

export const SectionNode = memo(({ data, selected }: NodeProps<SectionNodeType>) => {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(data.name || 'Section')
  const [size, setSize] = useState({
    width: (data.width ?? 400) as number,
    height: (data.height ?? 300) as number,
  })
  const { color } = data
  const resizingRef = useRef(false)
  const startPosRef = useRef({ x: 0, y: 0 })
  const startSizeRef = useRef({ width: 0, height: 0 })

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true)
  }, [])

  const handleBlur = useCallback(() => {
    setIsEditing(false)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditing(false)
    }
  }, [])

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    resizingRef.current = true
    startPosRef.current = { x: e.clientX, y: e.clientY }
    startSizeRef.current = { ...size }

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return
      const dx = e.clientX - startPosRef.current.x
      const dy = e.clientY - startPosRef.current.y
      setSize({
        width: Math.max(200, startSizeRef.current.width + dx),
        height: Math.max(150, startSizeRef.current.height + dy),
      })
    }

    const handleMouseUp = () => {
      resizingRef.current = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [size])

  const borderColor = color ?? 'var(--border-default)'

  return (
    <div
      className="section-node rounded-xl border-2 border-dashed relative"
      style={{
        width: size.width,
        height: size.height,
        borderColor,
        backgroundColor: `${borderColor}10`,
        boxShadow: selected ? 'var(--shadow-glow-blue)' : 'none',
      }}
      onDoubleClick={handleDoubleClick}
    >
      <div className="px-4 py-2">
        {isEditing ? (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="input-base w-full text-sm font-medium bg-transparent border-none outline-none"
            autoFocus
          />
        ) : (
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{name}</span>
        )}
      </div>

      {selected && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
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

SectionNode.displayName = 'SectionNode'
