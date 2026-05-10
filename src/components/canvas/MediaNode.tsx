import { memo, useState, useEffect } from 'react'
import { NodeResizer, useReactFlow, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'

export interface MediaNodeData extends Record<string, unknown> {
  url: string
  type: 'image'
  name?: string
}

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
      className="relative overflow-hidden"
      style={{
        width: '100%',
        height: '100%',
        outline: selected ? '2px solid #3b82f6' : '1px solid transparent',
        outlineOffset: 0,
        borderRadius: 4,
        lineHeight: 0,
      }}
    >
      {selected && (
        <NodeResizer
          minWidth={100}
          minHeight={50}
          isVisible={selected}
          handleClassName="!w-3 !h-3 !bg-blue-500 !border-2 !border-white !rounded-sm !shadow-md"
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
          className="flex items-center justify-center"
          style={{ width: '100%', height: '100%', minWidth: 60, minHeight: 60 }}
        >
          <span className="text-gray-400 text-xs">Loading...</span>
        </div>
      )}
    </div>
  )
})

MediaNode.displayName = 'MediaNode'
