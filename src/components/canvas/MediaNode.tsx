import { memo, useState, useEffect } from 'react'
import { NodeResizer, useReactFlow, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { CardHandles } from './card/CardHandles'
import type { MediaNodeData } from '../../types/card'

type MediaNodeType = Node<MediaNodeData, 'media'>

const MAX_WIDTH = 800

export const MediaNode = memo(({ id, data, selected }: NodeProps<MediaNodeType>) => {
  const { setNodes } = useReactFlow()
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!data.url || data.type !== 'image') return
    setLoaded(false)
    const img = new Image()
    img.onload = () => {
      const w = Math.min(img.naturalWidth, MAX_WIDTH)
      const h = Math.round(w * (img.naturalHeight / img.naturalWidth))
      setLoaded(true)
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, width: w, height: h } : n)),
      )
    }
    img.onerror = () => setLoaded(true)
    img.src = data.url
  }, [data.url, data.type, id, setNodes])

  return (
    <div
      className="media-node relative overflow-hidden"
      style={{
        width: '100%',
        height: '100%',
        outline: selected ? '2px solid var(--border-active)' : '1px solid transparent',
        outlineOffset: 0,
        borderRadius: 4,
        lineHeight: 0,
        boxShadow: selected ? 'var(--shadow-glow-blue)' : 'var(--shadow-sm)',
      }}
    >
      {selected && (
        <NodeResizer
          minWidth={100}
          minHeight={50}
          isVisible={selected}
          handleClassName="!w-3 !h-3 !bg-blue-500 !border-2 !border-white !rounded-sm !shadow-sm"
          lineClassName="!bg-transparent"
        />
      )}
      {loaded ? (
        <img
          src={data.url}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
          alt={data.name || ''}
        />
      ) : (
        <div
          className="flex items-center justify-center loading-pulse"
          style={{ width: '100%', height: '100%', minWidth: 60, minHeight: 60 }}
        >
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Loading...</span>
        </div>
      )}
      <CardHandles />
    </div>
  )
})

MediaNode.displayName = 'MediaNode'
