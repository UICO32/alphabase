import { writeFile, deleteFile, exists, mkdir, rename } from '../utils/workspace/fs'
import type { CardFile, BoardSnapshot, BoardManifest, TrashFile, WorkspaceMetadata } from '../utils/workspace/types'
import { useEventBus } from '../stores/eventBus'

export class WorkspaceSyncEngine {
  private cardsDir: string = ''
  private boardsDir: string = ''
  private trashDir: string = ''
  private workspacePath: string = ''
  private pendingWrites = new Map<string, { data: string; timer: ReturnType<typeof setTimeout> }>()
  private running = false
  private isDragging = false

  constructor() {}

  setDragging(isDragging: boolean): void {
    this.isDragging = isDragging
  }

  async init(workspacePath: string) {
    this.workspacePath = workspacePath
    this.cardsDir = joinPath(workspacePath, 'cards')
    this.boardsDir = joinPath(workspacePath, 'boards')
    this.trashDir = joinPath(workspacePath, 'trash')

    for (const dir of [this.cardsDir, this.boardsDir, this.trashDir]) {
      if (!(await exists(dir))) {
        await mkdir(dir)
      }
    }

    this.running = true
  }

  stop(): Promise<void> {
    this.running = false
    return this.flushAll()
  }

  // 提取共享的 drainPending 逻辑，flushNow 和 flushAll 都复用
  private drainPending(parallel: boolean): Promise<void> | void {
    const entries = [...this.pendingWrites.entries()]
    for (const [, { timer }] of entries) {
      clearTimeout(timer)
    }
    this.pendingWrites.clear()

    if (parallel) {
      // flushAll: 并行写入，返回 Promise
      const promises: Promise<void>[] = []
      for (const [key, { data }] of entries) {
        const path = key.startsWith('delete:') ? key.slice(7) : key
        promises.push(this.writeEntry(path, data))
      }
      return Promise.all(promises).then(() => {})
    } else {
      // flushNow: 同步依次写入
      for (const [key, { data }] of entries) {
        const path = key.startsWith('delete:') ? key.slice(7) : key
        this.writeEntry(path, data).catch(() => { /* noop */ })
      }
    }
  }

  // 统一的写入入口，避免 flushNow/flushAll/executeWrite 中重复的 tmp+rename 逻辑
  private async writeEntry(path: string, data: string): Promise<void> {
    try {
      if (data === '__DELETE__') {
        if (await exists(path)) await deleteFile(path)
      } else {
        const tmpPath = path + '.tmp'
        await writeFile(tmpPath, data)
        await rename(tmpPath, path)
      }
    } catch (err) {
      useEventBus.getState().emit('write-error', {
        path,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  /** Flush all pending writes immediately (fire-and-forget) */
  flushNow(): void {
    this.drainPending(false)
  }

  isRunning() { return this.running }

  private stringify(data: unknown, pretty = true) {
    return JSON.stringify(data, null, pretty ? 2 : undefined)
  }

  scheduleWriteCard(card: CardFile, debounceMs = 500) {
    const path = joinPath(this.cardsDir, `${card.id}.json`)
    this.scheduleWrite(path, this.stringify(card), debounceMs)
  }

  // 提取共享的 scheduleDelete 方法，避免 scheduleDeleteCard 和 scheduleDeleteTrashFile 重复
  private scheduleDelete(baseDir: string, fileName: string) {
    if (!this.running) return
    const path = joinPath(baseDir, fileName)
    const key = `delete:${path}`
    const existing = this.pendingWrites.get(key)
    if (existing) clearTimeout(existing.timer)
    this.pendingWrites.set(key, {
      data: '__DELETE__',
      timer: setTimeout(() => this.executeWrite(key, path, '__DELETE__'), 500),
    })
  }

  scheduleDeleteCard(cardId: string) {
    this.scheduleDelete(this.cardsDir, `${cardId}.json`)
  }

  scheduleWriteBoard(boardId: string, snapshot: BoardSnapshot, debounceMs = 600) {
    if (this.isDragging) return
    const path = joinPath(this.boardsDir, `${boardId}.json`)
    this.scheduleWrite(path, this.stringify(snapshot, false), debounceMs)
  }

  scheduleWriteManifest(manifest: BoardManifest, debounceMs = 300) {
    const path = joinPath(this.boardsDir, '_manifest.json')
    this.scheduleWrite(path, this.stringify(manifest), debounceMs)
  }

  scheduleWriteMetadata(metadata: WorkspaceMetadata, debounceMs = 300) {
    const path = joinPath(this.workspacePath, '_metadata.json')
    this.scheduleWrite(path, this.stringify(metadata), debounceMs)
  }

  scheduleWriteTrash(item: TrashFile, debounceMs = 500) {
    const path = joinPath(this.trashDir, `${item.cardId}.trash.json`)
    this.scheduleWrite(path, this.stringify(item), debounceMs)
  }

  scheduleDeleteTrashFile(cardId: string) {
    this.scheduleDelete(this.trashDir, `${cardId}.trash.json`)
  }

  private scheduleWrite(path: string, data: string, debounceMs: number) {
    if (!this.running) return
    const existing = this.pendingWrites.get(path)
    if (existing) clearTimeout(existing.timer)
    this.pendingWrites.set(path, {
      data,
      timer: setTimeout(() => this.executeWrite(path, path, data), debounceMs),
    })
  }

  private async executeWrite(key: string, path: string, data: string) {
    this.pendingWrites.delete(key)
    if (!this.running && data === '__DELETE__') return
    await this.writeEntry(path, data)
  }

  flushAll(): Promise<void> {
    return this.drainPending(true) as Promise<void>
  }
}

function joinPath(...parts: string[]): string {
  return parts.join('/').replace(/\\/g, '/')
}
