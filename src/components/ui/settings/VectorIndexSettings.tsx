import { useEffect } from 'react'
import { usePanelSurface } from '../../../hooks/usePanelSurface'
import { useEmbeddingStore } from '../../../stores/embeddingStore'

export function VectorIndexSettings() {
  const surface = usePanelSurface()
  const {
    indexing,
    progress,
    total,
    indexed,
    cardCount,
    lastIndexedAt,
    modelAvailable,
    modelDir,
    threshold,
    startIndexing,
    cancelIndexing,
    setThreshold,
    checkStatus,
  } = useEmbeddingStore()

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  const percent = total > 0 ? Math.round((progress / total) * 100) : 0

  function formatTime(iso: string) {
    const d = new Date(iso)
    return d.toLocaleString('zh-CN')
  }

  return (
    <div className="mb-8">
      <h3 className="text-sm font-medium mb-4" style={{ color: surface.text }}>
        向量索引
      </h3>
      <div className="space-y-3">
        {/* Status line */}
        <div className="p-3 rounded-lg" style={{ backgroundColor: surface.surface }}>
          <span className="text-sm" style={{ color: surface.text }}>
            {indexed ? `已索引（${cardCount} 张卡片）` : '未索引'}
          </span>
          {lastIndexedAt && (
            <span className="text-xs ml-2" style={{ color: surface.muted }}>
              {formatTime(lastIndexedAt)}
            </span>
          )}
        </div>

        {/* Model missing warning */}
        {!modelAvailable && (
          <div
            className="p-3 rounded-lg text-sm"
            style={{
              backgroundColor: 'hsl(45, 100%, 95%)',
              color: 'hsl(35, 90%, 30%)',
              border: '1px solid hsl(45, 80%, 75%)',
            }}
          >
            未检测到向量模型文件。请将 model_q4f16.onnx 和 tokenizer.json 放置到应用共享目录后重启应用：{modelDir || '（加载中...）'}
          </div>
        )}

        {/* Progress bar */}
        {indexing && (
          <div className="p-3 rounded-lg" style={{ backgroundColor: surface.surface }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: surface.text }}>
                正在索引...
              </span>
              <span className="text-xs" style={{ color: surface.muted }}>
                {progress}/{total}（{percent}%）
              </span>
            </div>
            <div
              className="w-full h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: surface.divider }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${percent}%`,
                  backgroundColor: surface.text,
                }}
              />
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {!indexing ? (
            <button
              onClick={startIndexing}
              disabled={!modelAvailable}
              className="btn-base flex-1 p-3 rounded-lg text-sm"
              style={{
                backgroundColor: modelAvailable ? surface.text : surface.divider,
                color: modelAvailable ? surface.panelBg : surface.muted,
                cursor: modelAvailable ? 'pointer' : 'not-allowed',
              }}
            >
              向量化全部卡片
            </button>
          ) : (
            <button
              onClick={cancelIndexing}
              className="btn-base flex-1 p-3 rounded-lg text-sm"
              style={{
                backgroundColor: surface.surface,
                color: surface.text,
                border: `1px solid ${surface.divider}`,
              }}
            >
              取消
            </button>
          )}
        </div>

        {/* Threshold slider */}
        <div className="p-3 rounded-lg" style={{ backgroundColor: surface.surface }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: surface.text }}>
              相似度阈值
            </span>
            <span className="text-xs" style={{ color: surface.muted }}>
              {threshold.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={0.5}
            max={0.95}
            step={0.05}
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="w-full"
            style={{ accentColor: surface.text }}
          />
        </div>
      </div>
    </div>
  )
}
