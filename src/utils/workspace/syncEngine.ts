import { writeFile, deleteFile, exists, mkdir, rename } from './fs'
import type { CardFile, BoardSnapshot, BoardManifest, TrashFile } from './types'

export class WorkspaceSyncEngine {
  private cardsDir: string = ''
  private boardsDir: string = ''
  private trashDir: string = ''
  private pendingWrites = new Map<string, { data: string; timer: ReturnType<typeof setTimeout> }>()
  private running = false

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
    for (const [, { timer }] of this.pendingWrites) {
      clearTimeout(timer)
    }
    this.flushAll()
  }

  isRunning() { return this.running }

  scheduleWriteCard(card: CardFile, debounceMs = 500) {
    const path = joinPath(this.cardsDir, `${card.id}.json`)
    this.scheduleWrite(path, JSON.stringify(card, null, 2), debounceMs)
  }

  scheduleDeleteCard(cardId: string) {
    if (!this.running) return
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
    if (!this.running) return
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
    try {
      if (data === '__DELETE__') {
        if (await exists(path)) await deleteFile(path)
      } else {
        const tmpPath = path + '.tmp'
        await writeFile(tmpPath, data)
        await rename(tmpPath, path)
      }
    } catch {
      /* noop */
    }
  }

  flushAll() {
    const entries = [...this.pendingWrites.entries()]
    for (const [, { timer }] of entries) {
      clearTimeout(timer)
    }
    this.pendingWrites.clear()

    for (const [key, { data }] of entries) {
      try {
        const path = key.startsWith('delete:') ? key.slice(7) : key
        if (data === '__DELETE__') {
          exists(path).then(e => { if (e) deleteFile(path) }).catch(() => {})
        } else {
          const tmpPath = path + '.tmp'
          writeFile(tmpPath, data)
            .then(() => rename(tmpPath, path))
            .catch(() => {})
        }
      } catch {
        /* noop */
      }
    }
  }
}

function joinPath(...parts: string[]): string {
  return parts.join('/').replace(/\\/g, '/')
}