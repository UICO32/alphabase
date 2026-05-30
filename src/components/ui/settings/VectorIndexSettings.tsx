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
      <h3 className="text-sm font-medium mb-4 text-text-primary">
        向量索引
      </h3>
      <div className="space-y-3">
        {/* Status line */}
        <div className="p-3 rounded-lg bg-surface-card">
          <span className="text-sm text-text-primary">
            {indexed ? `已索引（${cardCount} 张卡片）` : '未索引'}
          </span>
          {lastIndexedAt && (
            <span className="text-xs ml-2 text-text-secondary">
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
          <div className="p-3 rounded-lg bg-surface-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-text-primary">
                正在索引...
              </span>
              <span className="text-xs text-text-secondary">
                {progress}/{total}（{percent}%）
              </span>
            </div>
            <div
              className="w-full h-2 rounded-full overflow-hidden bg-border-default"
            >
              <div
                className="h-full rounded-full transition-all bg-text-primary"
                style={{ width: `${percent}%` }}
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
              className={`btn-base flex-1 p-3 rounded-lg text-sm ${modelAvailable ? 'bg-text-primary text-text-inverse' : 'bg-border-default text-text-secondary cursor-not-allowed'}`}
            >
              向量化全部卡片
            </button>
          ) : (
            <button
              onClick={cancelIndexing}
              className="btn-base flex-1 p-3 rounded-lg text-sm bg-surface-card text-text-primary border border-border-default"
            >
              取消
            </button>
          )}
        </div>

        {/* Threshold slider */}
        <div className="p-3 rounded-lg bg-surface-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-primary">
              相似度阈值
            </span>
            <span className="text-xs text-text-secondary">
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
