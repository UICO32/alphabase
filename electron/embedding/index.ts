import { ipcMain, BrowserWindow, app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, renameSync, unlinkSync, createWriteStream } from 'fs'

const MODEL_FILENAME = 'model_q4f16.onnx'
const MODEL_DATA_FILENAME = 'model_q4f16.onnx_data'
const TOKENIZER_FILENAME = 'tokenizer.json'
const REQUIRED_MODEL_FILES = [MODEL_FILENAME, MODEL_DATA_FILENAME, TOKENIZER_FILENAME]

function getEmbeddingDir(): string {
  return join(app.getPath('userData'), 'embedding')
}

function hasDownloadedModel(): boolean {
  const dir = getEmbeddingDir()
  return REQUIRED_MODEL_FILES.every(filename => existsSync(join(dir, filename)))
}

const MODEL_DOWNLOAD_URLS: Record<string, string> = {
  model: 'https://www.modelscope.cn/models/jinaai/jina-embeddings-v5-text-nano-retrieval/resolve/master/onnx/model_q4f16.onnx',
  modelData: 'https://www.modelscope.cn/models/jinaai/jina-embeddings-v5-text-nano-retrieval/resolve/master/onnx/model_q4f16.onnx_data',
  tokenizer: 'https://www.modelscope.cn/models/jinaai/jina-embeddings-v5-text-nano-retrieval/resolve/master/tokenizer.json',
}

// File sizes (approximate) for weighted progress reporting
const FILE_WEIGHTS: Record<string, number> = {
  model: 30,      // ~30MB
  modelData: 60,  // ~120MB
  tokenizer: 10,  // ~0.5MB
}

let service: import('./EmbeddingService').EmbeddingService | null = null
let currentWorkspacePath = ''
let registered = false
let downloadAbortController: AbortController | null = null

async function getService() {
  if (!service) {
    const { EmbeddingService } = await import('./EmbeddingService')
    service = new EmbeddingService()
  }
  return service
}

function getMainWindow(): BrowserWindow | null {
  return BrowserWindow.getAllWindows()[0] ?? null
}

export function registerEmbeddingIPC(): void {
  if (registered) return
  registered = true

  ipcMain.handle('embedding:init', async (_event, workspacePath: string) => {
    try {
      currentWorkspacePath = workspacePath
      const svc = await getService()
      const result = await svc.init(workspacePath, getEmbeddingDir())
      console.log('[embedding] init:', result)
      return result
    } catch (err: any) {
      console.error('[embedding] init failed:', err.message)
      return { modelLoaded: false, storeLoaded: false, docCount: 0, totalCards: 0, error: err.message }
    }
  })

  ipcMain.handle('embedding:indexAll', async () => {
    if (!service || !currentWorkspacePath) {
      return { error: 'NOT_INITIALIZED' }
    }
    try {
      const result = await service.indexAll((done, total) => {
        const win = getMainWindow()
        win?.webContents.send('embedding:progress', {
          current: done,
          total,
        })
      })
      const win = getMainWindow()
      win?.webContents.send('embedding:complete', result)
      return result
    } catch (err: any) {
      const win = getMainWindow()
      win?.webContents.send('embedding:error', { message: err.message })
      return { error: err.message }
    }
  })

  ipcMain.handle('embedding:indexCard', async (_event, cardId: string) => {
    if (!service) return { error: 'Service not initialized' }
    try {
      const result = await service.indexCard(cardId)
      return { success: true, ...result }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('embedding:retryInit', async () => {
    if (!currentWorkspacePath) {
      return { modelLoaded: false, storeLoaded: false, docCount: 0, totalCards: 0, error: 'WORKSPACE_NOT_INITIALIZED' }
    }
    try {
      const svc = await getService()
      return await svc.init(currentWorkspacePath, getEmbeddingDir())
    } catch (err: any) {
      return { modelLoaded: false, storeLoaded: false, docCount: 0, totalCards: 0, error: err.message }
    }
  })

  ipcMain.handle('embedding:removeVector', async (_event, cardId: string) => {
    if (!service) return { success: false }
    try {
      const removed = service.removeVector(cardId)
      return { success: removed }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('embedding:cluster', async (_event, minClusterSize?: number, clusterThreshold?: number) => {
    try {
      const svc = await getService()
      const result = await svc.cluster(minClusterSize ?? 2, clusterThreshold)
      return result
    } catch (err: any) {
      return { clusters: [], orphanCards: [], computedAt: 0, error: err.message }
    }
  })

  ipcMain.handle('embedding:search', async (_event, { cardId, topK }: { cardId: string; topK?: number }) => {
    if (!service) return { results: [], error: 'Service not initialized' }
    try {
      const results = await service.search(cardId, topK ?? 20)
      return { results }
    } catch {
      return { results: [] }
    }
  })

  ipcMain.handle('embedding:searchByText', async (_event, { query, topK }: { query: string; topK?: number }) => {
    if (!service) return { results: [], error: 'Service not initialized' }
    try {
      const results = await service.searchByText(query, topK ?? 20)
      return { results }
    } catch (err: any) {
      return { results: [], error: err.message }
    }
  })

  ipcMain.handle('embedding:cancel', async () => {
    service?.cancel()
    return { cancelled: true }
  })

  ipcMain.handle('embedding:getStatus', async () => {
    if (!service) {
      const modelAvailable = hasDownloadedModel()
      return {
        initialized: false,
        modelAvailable,
        indexing: false,
        docCount: 0,
        modelDir: getEmbeddingDir(),
        initializationError: null,
      }
    }
    return service.getStatus()
  })

  ipcMain.handle('embedding:checkModel', async () => {
    if (!service) {
      return { available: hasDownloadedModel() }
    }
    return { available: service.isModelAvailable() }
  })

  ipcMain.handle('embedding:setThreshold', async (_event, { value }: { value: number }) => {
    service?.setThreshold(value)
    return { success: true }
  })

  // --- Model download IPC handlers ---

  ipcMain.handle('embedding:downloadModel', async () => {
    if (downloadAbortController) {
      return { error: 'Download already in progress' }
    }

    const dir = getEmbeddingDir()
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    downloadAbortController = new AbortController()
    const { signal } = downloadAbortController

    const files = [
      { key: 'model', url: MODEL_DOWNLOAD_URLS.model, filename: MODEL_FILENAME, weight: FILE_WEIGHTS.model },
      { key: 'modelData', url: MODEL_DOWNLOAD_URLS.modelData, filename: MODEL_DATA_FILENAME, weight: FILE_WEIGHTS.modelData },
      { key: 'tokenizer', url: MODEL_DOWNLOAD_URLS.tokenizer, filename: TOKENIZER_FILENAME, weight: FILE_WEIGHTS.tokenizer },
    ]

    const totalWeight = files.reduce((s, f) => s + f.weight, 0)
    let completedWeight = 0

    try {
      for (const file of files) {
        const destPath = join(dir, file.filename)
        const tmpPath = destPath + '.tmp'

        if (existsSync(destPath)) {
          completedWeight += file.weight
          continue
        }

        const response = await fetch(file.url, { signal })
        if (!response.ok) {
          throw new Error(`Download failed: HTTP ${response.status} for ${file.filename}`)
        }

        const contentLength = Number(response.headers.get('content-length') || '0')
        let downloadedBytes = 0

        const fileStream = createWriteStream(tmpPath)
        const reader = response.body?.getReader()
        if (!reader) throw new Error(`No response body for ${file.filename}`)

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            fileStream.write(value)
            downloadedBytes += value.length

            const fileProgress = contentLength > 0 ? downloadedBytes / contentLength : 0
            const overallProgress = (completedWeight + file.weight * fileProgress) / totalWeight
            const win = getMainWindow()
            win?.webContents.send('embedding:download-progress', {
              progress: Math.round(overallProgress * 100),
              currentFile: file.filename,
            })
          }
        } finally {
          fileStream.end()
          reader.releaseLock()
        }

        await new Promise<void>((resolve, reject) => {
          fileStream.on('finish', resolve)
          fileStream.on('error', reject)
        })

        renameSync(tmpPath, destPath)
        completedWeight += file.weight
      }

      const allExist = files.every(f => existsSync(join(dir, f.filename)))
      if (!allExist) {
        throw new Error('Download verification failed: some files missing')
      }

      if (service && currentWorkspacePath) {
        try {
          await service.init(currentWorkspacePath, getEmbeddingDir())
        } catch (err: any) {
          console.warn('[embedding] re-init after download failed:', err.message)
        }
      }

      const win = getMainWindow()
      win?.webContents.send('embedding:download-complete', { success: true })
      return { success: true }
    } catch (err: any) {
      for (const file of files) {
        const tmpPath = join(dir, file.filename + '.tmp')
        try { if (existsSync(tmpPath)) unlinkSync(tmpPath) } catch { /* ignore */ }
      }

      const isCancelled = err.name === 'AbortError'
      const win = getMainWindow()
      win?.webContents.send('embedding:download-error', {
        message: isCancelled ? 'Download cancelled' : err.message,
        cancelled: isCancelled,
      })
      return { error: isCancelled ? 'CANCELLED' : err.message }
    } finally {
      downloadAbortController = null
    }
  })

  ipcMain.handle('embedding:cancelDownload', async () => {
    if (downloadAbortController) {
      downloadAbortController.abort()
      downloadAbortController = null
    }
    return { cancelled: true }
  })

  ipcMain.handle('embedding:getDownloadConfig', async () => {
    return {
      configured: Object.keys(MODEL_DOWNLOAD_URLS).length > 0,
      modelDir: getEmbeddingDir(),
    }
  })
}

export async function disposeEmbeddingService(): Promise<void> {
  if (downloadAbortController) {
    downloadAbortController.abort()
    downloadAbortController = null
  }
  if (service) await service.dispose()
  service = null
  currentWorkspacePath = ''
}
