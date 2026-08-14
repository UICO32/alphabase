import { useEffect } from 'react'
import { useEmbeddingStore } from '../../../stores/embeddingStore'
import { Slider } from '../shadcn/slider'
import { Button } from '../shadcn/button'
import { SettingGroup, SettingRow } from './SettingPrimitives'

export function VectorIndexSettings() {
  const {
    indexing,
    initialized,
    progress,
    total,
    indexed,
    cardCount,
    totalCards,
    emptyCount,
    failedCount,
    lastIndexedAt,
    modelAvailable,
    modelDir,
    threshold,
    startIndexing,
    retryModelInitialization,
    cancelIndexing,
    setThreshold,
    checkStatus,
    indexError,
    downloading,
    downloadProgress,
    downloadCurrentFile,
    downloadModel,
    cancelDownload,
  } = useEmbeddingStore()

  useEffect(() => { checkStatus() }, [checkStatus])

  const percent = total > 0 ? Math.round((progress / total) * 100) : 0

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString('zh-CN')
  }

  const coverageDetails = [
    emptyCount > 0 ? `${emptyCount} 张空白卡片` : null,
    failedCount > 0 ? `${failedCount} 张失败` : null,
    lastIndexedAt ? `更新于 ${formatTime(lastIndexedAt)}` : null,
  ].filter(Boolean).join(' · ') || undefined
  const runtimeUnavailable = modelAvailable && !initialized
  const runtimeError = runtimeUnavailable && indexError

  return (
    <SettingGroup title="向量索引">
      <SettingRow
        label={indexed ? `已索引（${cardCount}/${totalCards || cardCount} 张卡片）` : '未索引'}
        description={coverageDetails}
      >
        <span />
      </SettingRow>

      {(indexError === 'partial-index-failure' || indexError === 'incremental-index-failed') && (
        <div className="py-2.5 text-xs text-destructive">
          部分卡片向量化失败。可重试“向量化全部卡片”；失败卡片不会被误报为已索引。
        </div>
      )}

      {runtimeError && (
        <div className="space-y-1 py-2.5 text-xs text-destructive">
          <div>模型文件已下载，但本地向量运行时加载失败。请重试；如果仍然失败，请重启或重新安装应用。</div>
          <div className="break-all text-[11px] text-fg-tertiary">{indexError}</div>
        </div>
      )}

      {!modelAvailable && (
        <div className="space-y-3 py-2.5 text-xs text-fg-secondary">
          <div>
            首次使用相似卡片功能需要下载本地向量模型（约 150MB）。模型会保存在应用数据目录，之后重启或升级无需重复下载。
          </div>
          {downloading && (
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="truncate">正在下载 {downloadCurrentFile || '模型文件'}</span>
                <span className="shrink-0">{Math.round(downloadProgress)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-card-active">
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${downloadProgress}%` }} />
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={() => void downloadModel()} disabled={downloading} className="flex-1">
              {downloading ? '正在下载…' : '下载并启用模型'}
            </Button>
            {downloading && (
              <Button onClick={() => void cancelDownload()} variant="secondary">
                取消
              </Button>
            )}
          </div>
          {(indexError === 'model-download-failed' || indexError?.startsWith('Download failed')) && (
            <div className="text-destructive">模型下载失败，请检查网络后重试。</div>
          )}
          {modelDir && <div className="break-all text-[11px] text-fg-tertiary">保存位置：{modelDir}</div>}
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
          <Button
            onClick={() => void (runtimeUnavailable ? retryModelInitialization() : startIndexing())}
            disabled={!modelAvailable}
            className="flex-1"
          >
            {runtimeUnavailable ? (runtimeError ? '重试加载模型' : '加载模型并向量化') : '向量化全部卡片'}
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
