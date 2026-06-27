import { useEffect } from 'react'
import { useEmbeddingStore } from '../../../stores/embeddingStore'
import { Slider } from '../shadcn/slider'
import { Button } from '../shadcn/button'
import { SettingGroup, SettingRow } from './SettingPrimitives'

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

  useEffect(() => { checkStatus() }, [checkStatus])

  const percent = total > 0 ? Math.round((progress / total) * 100) : 0

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString('zh-CN')
  }

  return (
    <SettingGroup title="向量索引">
      <SettingRow label={indexed ? `已索引（${cardCount} 张卡片）` : '未索引'} description={lastIndexedAt ? formatTime(lastIndexedAt) : undefined}>
        <span />
      </SettingRow>

      {!modelAvailable && (
        <div className="py-2.5 text-xs text-fg-secondary">
          未检测到向量模型文件。请将 model_q4f16.onnx 和 tokenizer.json 放置到应用共享目录后重启应用：{modelDir || '（加载中...）'}
        </div>
      )}

      {indexing && (
        <div className="py-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-fg-primary">正在索引...</span>
            <span className="text-xs text-fg-secondary">{progress}/{total}（{percent}%）</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden bg-surface-card-active">
            <div className="h-full rounded-full transition-all bg-brand" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      <div className="py-2.5 flex gap-2">
        {!indexing ? (
          <Button onClick={startIndexing} disabled={!modelAvailable} className="flex-1">
            向量化全部卡片
          </Button>
        ) : (
          <Button onClick={cancelIndexing} variant="secondary" className="flex-1">
            取消
          </Button>
        )}
      </div>

      <SettingRow label="相似度阈值" description={threshold.toFixed(2)}>
        <div className="w-[120px]">
          <Slider
            value={[threshold]}
            onValueChange={([v]) => setThreshold(v)}
            min={0.5}
            max={0.95}
            step={0.05}
          />
        </div>
      </SettingRow>
    </SettingGroup>
  )
}
