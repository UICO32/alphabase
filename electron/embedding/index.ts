import { ipcMain, BrowserWindow, app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { EmbeddingService, EMBEDDING_ERRORS } from './EmbeddingService'

const EMBEDDING_MODEL_DIR = join(app.getPath('userData'), 'embedding')
const MODEL_FILENAME = 'model_q4f16.onnx'

let service: EmbeddingService | null = null
let currentWorkspacePath = ''
let registered = false

function getMainWindow(): BrowserWindow | null {
  return BrowserWindow.getAllWindows()[0] ?? null
}

export function registerEmbeddingIPC(): void {
  if (registered) return
  registered = true

  // Renderer calls this when workspace loads, before any other embedding operations
  ipcMain.handle('embedding:init', async (_event, workspacePath: string) => {
    try {
      currentWorkspacePath = workspacePath
      service = new EmbeddingService()
      await service.init(workspacePath, EMBEDDING_MODEL_DIR)
      console.log('[embedding] init success, modelDir:', EMBEDDING_MODEL_DIR)
      return { initialized: true }
    } catch (err: any) {
      console.error('[embedding] init failed:', err.message)
      return { initialized: false, error: err.message }
    }
  })

  ipcMain.handle('embedding:indexAll', async () => {
    if (!service || !currentWorkspacePath) {
      return { error: EMBEDDING_ERRORS.NOT_INITIALIZED }
    }
    try {
      const cardsDir = join(currentWorkspacePath, 'cards')
      const result = await service.indexAll(cardsDir, (progress) => {
        const win = getMainWindow()
        win?.webContents.send('embedding:progress', {
          current: progress.indexed + progress.skipped,
          total: progress.total,
          indexed: progress.indexed,
          skipped: progress.skipped,
        })
      })
      const win = getMainWindow()
      win?.webContents.send('embedding:complete', result)
      return { started: true }
    } catch (err: any) {
      const win = getMainWindow()
      win?.webContents.send('embedding:error', { message: err.message })
      return { error: err.message }
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

  ipcMain.handle('embedding:cancel', async () => {
    service?.cancel()
    return { cancelled: true }
  })

  ipcMain.handle('embedding:getStatus', async () => {
    if (!service) {
      const modelAvailable = existsSync(join(EMBEDDING_MODEL_DIR, MODEL_FILENAME))
      return { initialized: false, modelAvailable, indexing: false, docCount: 0, indexCompleteness: {}, modelDir: EMBEDDING_MODEL_DIR }
    }
    return service.getStatus()
  })

  ipcMain.handle('embedding:checkModel', async () => {
    if (!service) {
      return { available: existsSync(join(EMBEDDING_MODEL_DIR, MODEL_FILENAME)) }
    }
    return { available: service.isModelAvailable() }
  })

  ipcMain.handle('embedding:setThreshold', async (_event, { value }: { value: number }) => {
    service?.setThreshold(value)
    return { success: true }
  })
}

export async function disposeEmbeddingService(): Promise<void> {
  service?.dispose()
  service = null
  currentWorkspacePath = ''
  // Do NOT reset registered — IPC handlers stay registered for the app lifetime
}
