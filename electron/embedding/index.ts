import { ipcMain, BrowserWindow, app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'

const MODEL_FILENAME = 'model_q4f16.onnx'

function getEmbeddingDir(): string {
  return join(app.getPath('userData'), 'embedding')
}

let service: import('./EmbeddingService').EmbeddingService | null = null
let currentWorkspacePath = ''
let registered = false

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
      const result = await svc.init(workspacePath)
      console.log('[embedding] init:', result)
      return result
    } catch (err: any) {
      console.error('[embedding] init failed:', err.message)
      return { modelLoaded: false, storeLoaded: false, docCount: 0, error: err.message }
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
      const success = await service.indexCard(cardId)
      return { success }
    } catch (err: any) {
      return { error: err.message }
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
      const modelAvailable = existsSync(join(getEmbeddingDir(), MODEL_FILENAME))
      return { initialized: false, modelAvailable, indexing: false, docCount: 0, modelDir: getEmbeddingDir() }
    }
    return service.getStatus()
  })

  ipcMain.handle('embedding:checkModel', async () => {
    if (!service) {
      return { available: existsSync(join(getEmbeddingDir(), MODEL_FILENAME)) }
    }
    return { available: service.isModelAvailable() }
  })

  ipcMain.handle('embedding:setThreshold', async (_event, { value }: { value: number }) => {
    service?.setThreshold(value)
    return { success: true }
  })
}

export async function disposeEmbeddingService(): Promise<void> {
  if (service) await service.dispose()
  service = null
  currentWorkspacePath = ''
}