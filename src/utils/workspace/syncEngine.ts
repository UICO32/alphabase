import { writeFile, deleteFile, exists, mkdir, rename } from './fs'
import type { CardFile, BoardSnapshot, BoardManifest, TrashFile } from './types'

type Listener = () => void

export class WorkspaceSyncEngine {
  private cardsDir: string = ''
  private boardsDir: string = ''
  private trashDir: string = ''
  private pendingWrites = new Map<string, { data: string; timer: ReturnType<typeof setTimeout> }>()
  private running = false
  private onFlushListeners: Listener[] = []

  constructor() {}

  async init(workspacePath: string) {
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

  stop() {
    this.running = false
    this.flushAll()
    for (const [, { timer }] of this.pendingWrites) {
      clearTimeout(timer)
    }
    this.pendingWrites.clear()
  }

  isRunning() { return this.running }

  scheduleWriteCard(card: CardFile, debounceMs = 500) {
    const path = joinPath(this.cardsDir, `${card.id}.json`)
    this.scheduleWrite(path, JSON.stringify(card, null, 2), debounceMs)
  }

  scheduleDeleteCard(cardId: string) {
    const path = joinPath(this.cardsDir, `${cardId}.json`)
    const key = `delete:${path}`
    const existing = this.pendingWrites.get(key)
    if (existing) clearTimeout(existing.timer)
    this.pendingWrites.set(key, {
      data: '__DELETE__',
      timer: setTimeout(() => this.executeWrite(key, path, '__DELETE__'), 0),
    })
  }

  scheduleWriteBoard(boardId: string, snapshot: BoardSnapshot, debounceMs = 600) {
    const path = joinPath(this.boardsDir, `${boardId}.json`)
    this.scheduleWrite(path, JSON.stringify(snapshot, null, 2), debounceMs)
  }

  scheduleWriteManifest(manifest: BoardManifest, debounceMs = 300) {
    const path = joinPath(this.boardsDir, '_manifest.json')
    this.scheduleWrite(path, JSON.stringify(manifest, null, 2), debounceMs)
  }

  scheduleWriteTrash(item: TrashFile, debounceMs = 500) {
    const path = joinPath(this.trashDir, `${item.cardId}.trash.json`)
    this.scheduleWrite(path, JSON.stringify(item, null, 2), debounceMs)
  }

  scheduleDeleteTrashFile(cardId: string) {
    const path = joinPath(this.trashDir, `${cardId}.trash.json`)
    const key = `delete:${path}`
    const existing = this.pendingWrites.get(key)
    if (existing) clearTimeout(existing.timer)
    this.pendingWrites.set(key, {
      data: '__DELETE__',
      timer: setTimeout(() => this.executeWrite(key, path, '__DELETE__'), 0),
    })
  }

  private scheduleWrite(path: string, data: string, debounceMs: number) {
    const existing = this.pendingWrites.get(path)
    if (existing) clearTimeout(existing.timer)
    this.pendingWrites.set(path, {
      data,
      timer: setTimeout(() => this.executeWrite(path, path, data), debounceMs),
    })
  }

  private async executeWrite(key: string, path: string, data: string) {
    this.pendingWrites.delete(key)
    if (!this.running) return
    try {
      if (data === '__DELETE__') {
        if (await exists(path)) await deleteFile(path)
      } else {
        const tmpPath = path + '.tmp'
        await writeFile(tmpPath, data)
        await rename(tmpPath, path)
      }
    } catch (e) {
      console.warn(`SyncEngine write failed: ${path}`, e)
    }
  }

  flushAll() {
    for (const [key, { data }] of this.pendingWrites) {
      const timer = this.pendingWrites.get(key)?.timer
      if (timer) clearTimeout(timer)
      this.pendingWrites.delete(key)
      // Sync write
      try {
        const path = key.startsWith('delete:') ? key.slice(7) : key
        if (data === '__DELETE__') {
          // Can't sync delete easily, skip
        } else {
          // Will be written asynchronously
          this.executeWrite(key, path, data)
        }
      } catch (e) {
        console.warn('SyncEngine flush error:', e)
      }
    }
  }

  onFlush(listener: Listener) {
    this.onFlushListeners.push(listener)
  }
}

function joinPath(...parts: string[]): string {
  return parts.join('/').replace(/\\/g, '/')
}
