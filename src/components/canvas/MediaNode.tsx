import { memo, useState, useEffect, useCallback, useContext } from 'react'
import { NodeResizeControl, useReactFlow, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { Copy } from 'lucide-react'
import { CardHandles } from './card/CardHandles'
import { MultiSelectContext } from './utils/multiSelectContext'
import { showToast } from '../../utils/toast'
import type { MediaNodeData } from '../../types/card'

type MediaNodeType = Node<MediaNodeData, 'media'>

const MAX_WIDTH = 800

async function copyImageAsPng(url: string) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const pngBlob = blob.type === 'image/png' ? blob : await new Promise<Blob>((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.drawImage(img, 0, 0)
        URL.revokeObjectURL(img.src)
        canvas.toBlob((b) => resolve(b || blob), 'image/png')
      }
      img.onerror = () => resolve(blob)
      img.src = URL.createObjectURL(blob)
    })
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })])
  } catch {
    await navigator.clipboard.writeText(url).catch(() => {})
  }
}

export const MediaNode = memo(({ id, data, selected }: NodeProps<MediaNodeType>) => {
  const { setNodes } = useReactFlow()
  const [loaded, setLoaded] = useState(false)
  const [hovered, setHovered] = useState(false)
  // 多选状态由画布统一计算（context），避免每张图各自 filter 节点
  const multiSelected = useContext(MultiSelectContext)
  // 多选时隐藏图片自身的选中态（整体缩放框已代表选中范围）
  const showSelected = selected && !multiSelected

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

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (data.url && data.type === 'image') {
      await copyImageAsPng(data.url)
      showToast('已复制为图片')
    }
  }, [data.url, data.type])

  // Invisible corner resize controls — no visual appearance, but drag still works
  const cornerPositions = [
    'top-left' as const,
    'top-right' as const,
    'bottom-left' as const,
    'bottom-right' as const,
  ]

  return (
    <div
      className="media-node relative"
      style={{
        width: '100%',
        height: '100%',
        outline: showSelected ? '2px solid var(--card-selected-border)' : '1px solid transparent',
        outlineOffset: 0,
        borderRadius: 8,
        lineHeight: 0,
        boxShadow: showSelected ? 'var(--shadow-glow-accent)' : 'var(--shadow-sm)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {selected && !multiSelected && cornerPositions.map((pos) => (
        <NodeResizeControl
          key={pos}
          position={pos}
          keepAspectRatio
          minWidth={100}
          minHeight={50}
          style={{
            width: 12,
            height: 12,
            background: 'transparent',
            border: 'none',
          }}
          className="!border-0 !bg-transparent !opacity-0"
        />
      ))}
      {(hovered || selected) && data.type === 'image' && (
        <button
          onClick={handleCopy}
          style={{
            position: 'absolute',
            top: '6px',
            right: '6px',
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            border: 'none',
            background: 'rgba(255,255,255,0.9)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
            color: 'var(--fg-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
          title="复制为图片"
        >
          <Copy size={14} />
        </button>
      )}
      {loaded ? (
        <img
          src={data.url}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            borderRadius: 8,
          }}
          alt={data.name || ''}
        />
      ) : (
        <div
          className="flex items-center justify-center loading-pulse"
          style={{ width: '100%', height: '100%', minWidth: 60, minHeight: 60 }}
        >
          <span className="text-xs" style={{ color: 'var(--fg-tertiary)' }}>Loading...</span>
        </div>
      )}
      <CardHandles />
    </div>
  )
})

MediaNode.displayName = 'MediaNode'