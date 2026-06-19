import { useEffect } from 'react'
import { useEmbeddingStore } from '../../../stores/embeddingStore'

export function VectorIndexSettings() {
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
      <h3 className="text-sm font-medium mb-4 text-fg-primary">
        向量索引
      </h3>
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-surface-panel-hover">
          <span className="text-sm text-fg-primary">
            {indexed ? `已索引（${cardCount} 张卡片）` : '未索引'}
          </span>
          {lastIndexedAt && (
            <span className="text-xs ml-2 text-fg-secondary">
              {formatTime(lastIndexedAt)}
            </span>
          )}
        </div>

        {!modelAvailable && (
          <div className="p-3 rounded-lg text-sm bg-[var(--color-blue-50)] text-[var(--color-blue-600)] [data-theme=dark]:bg-[var(--color-blue-900)] [data-theme=dark]:text-[var(--color-blue-200)]">
            未检测到向量模型文件。请将 model_q4f16.onnx 和 tokenizer.json 放置到应用共享目录后重启应用：{modelDir || '（加载中...）'}
          </div>
        )}

        {indexing && (
          <div className="p-3 rounded-lg bg-surface-panel-hover">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-fg-primary">
                正在索引...
              </span>
              <span className="text-xs text-fg-secondary">
                {progress}/{total}（{percent}%）
              </span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden bg-surface-card-active">
              <div
                className="h-full rounded-full transition-all bg-accent-blue"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {!indexing ? (
            <button
              onClick={startIndexing}
              disabled={!modelAvailable}
              className={`flex-1 p-3 rounded-lg text-sm transition-colors ${
                modelAvailable
                  ? 'bg-emphasis text-fg-inverse hover:opacity-90'
                  : 'bg-surface-panel-hover text-fg-tertiary cursor-not-allowed'
              }`}
            >
              向量化全部卡片
            </button>
          ) : (
            <button
              onClick={cancelIndexing}
              className="flex-1 p-3 rounded-lg text-sm bg-surface-panel-hover text-fg-primary hover:bg-surface-card-active transition-colors"
            >
              取消
            </button>
          )}
        </div>

        <div className="p-3 rounded-lg bg-surface-panel-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-fg-primary">
              相似度阈值
            </span>
            <span className="text-xs text-fg-secondary">
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
            className="w-full accent-accent-blue"
          />
        </div>
      </div>
    </div>
  )
}
