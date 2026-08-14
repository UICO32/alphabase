import { memo, useState, useEffect, useCallback, useContext } from 'react'
import { NodeResizeControl, useReactFlow, useStore, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { Copy, Play } from 'lucide-react'
import { CardHandles } from './card/CardHandles'
import { MultiSelectContext } from './utils/multiSelectContext'
import { showToast } from '../../utils/toast'
import type { MediaNodeData } from '../../types/card'
import { selectMediaVariant } from '../../media/selectMediaVariant'
import { useMediaPlaybackStore } from '../../stores/mediaPlaybackStore'

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

export const MediaNode = memo(({ id, data, selected, width: nodeWidth }: NodeProps<MediaNodeType>) => {
  const { setNodes } = useReactFlow()
  const [loaded, setLoaded] = useState(() => data.type === 'video' || Boolean(data.width && data.height))
  const [hovered, setHovered] = useState(false)
  const videoActivated = useMediaPlaybackStore((state) => state.activeNodeId === id)
  const activateVideo = useMediaPlaybackStore((state) => state.activate)
  const deactivateVideo = useMediaPlaybackStore((state) => state.deactivate)
  // 多选状态由画布统一计算（context），避免每张图各自 filter 节点
  const multiSelected = useContext(MultiSelectContext)
  // 多选时隐藏图片自身的选中态（整体缩放框已代表选中范围）
  const showSelected = selected && !multiSelected
  const displayUrl = useStore(useCallback((state) => {
    if (data.type !== 'image') return data.url
    const zoom = state.transform[2]
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const targetWidth = (nodeWidth ?? data.width ?? MAX_WIDTH) * zoom * dpr
    return selectMediaVariant(data.url, data.variants, targetWidth)
  }, [data.height, data.type, data.url, data.variants, data.width, nodeWidth]))

  useEffect(() => {
    if (!data.url || data.type !== 'image' || (data.width && data.height)) return
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

  useEffect(() => {
    if (!selected) deactivateVideo(id)
  }, [deactivateVideo, id, selected])

  useEffect(() => {
    if (!videoActivated) return
    const handleVisibility = () => {
      if (document.hidden) deactivateVideo(id)
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      deactivateVideo(id)
    }
  }, [deactivateVideo, id, videoActivated])

  const handleVideoMetadata = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget
    if (!video.videoWidth || !video.videoHeight || (data.width && data.height)) return
    const width = Math.min(video.videoWidth, MAX_WIDTH)
    const height = Math.max(1, Math.round(width * video.videoHeight / video.videoWidth))
    setNodes((nodes) => nodes.map((node) => node.id === id
      ? { ...node, width, height, data: { ...node.data, width: video.videoWidth, height: video.videoHeight } }
      : node))
  }, [data.height, data.width, id, setNodes])

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
      {data.type === 'video' ? (
        videoActivated ? (
          <video
            src={data.url}
            controls
            autoPlay
            preload="metadata"
            onLoadedMetadata={handleVideoMetadata}
            onEnded={() => deactivateVideo(id)}
            style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', borderRadius: 8, background: '#09090b' }}
          />
        ) : (
          <button
            type="button"
            aria-label={`播放${data.name ? ` ${data.name}` : '视频'}`}
            onClick={(event) => {
              event.stopPropagation()
              activateVideo(id)
            }}
            style={{
              display: 'flex',
              width: '100%',
              height: '100%',
              minHeight: 120,
              alignItems: 'center',
              justifyContent: 'center',
              border: 0,
              borderRadius: 8,
              backgroundColor: '#09090b',
              backgroundImage: data.posterUrl ? `url("${data.posterUrl}")` : undefined,
              backgroundSize: 'contain',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              color: 'rgba(255,255,255,0.9)',
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, lineHeight: 1.2 }}>
              <Play size={24} fill="currentColor" />
              <span style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {data.name || '播放视频'}
              </span>
            </span>
          </button>
        )
      ) : (
        <>
        <img
          src={displayUrl}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            borderRadius: 8,
            opacity: loaded ? 1 : 0,
          }}
          alt={data.name || ''}
        />
        {!loaded ? (
        <div
          className="flex items-center justify-center loading-pulse"
          style={{ position: 'absolute', inset: 0, minWidth: 60, minHeight: 60 }}
        >
          <span className="text-xs" style={{ color: 'var(--fg-tertiary)' }}>Loading...</span>
        </div>
        ) : null}
        </>
      )}
      <CardHandles />
    </div>
  )
})

MediaNode.displayName = 'MediaNode'
