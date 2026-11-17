import { writeFile, deleteFile, exists, mkdir, rename } from '../utils/workspace/fs'
import type { CardFile, BoardSnapshot, BoardManifest, TrashFile, WorkspaceMetadata, ProjectData } from '../utils/workspace/types'
import { useEventBus } from '../stores/eventBus'
import { auditWorkspaceEvent, auditWorkspaceHealth } from '../utils/workspace/audit'

export class WorkspaceSyncEngine {
  private cardsDir: string = ''
  private boardsDir: string = ''
  private trashDir: string = ''
  private projectsDir: string = ''
  private workspacePath: string = ''
  private pendingWrites = new Map<string, { data: string; timer: ReturnType<typeof setTimeout> }>()
  /** 拖拽期间被抑制的画板快照：不排盘，但保留最新值供 flush（关闭窗口/切工作区）使用。 */
  private deferredBoardWrites = new Map<string, string>()
  private running = false
  private isDragging = false

  constructor() {}

  setDragging(isDragging: boolean): void {
    this.isDragging = isDragging
    // 松手后由节点/边变化的防抖写最终快照，拖拽期间的中间快照不必再写。
    if (!isDragging) this.deferredBoardWrites.clear()
  }

  async init(workspacePath: string) {
    this.workspacePath = workspacePath
    this.cardsDir = joinPath(workspacePath, 'cards')
    this.boardsDir = joinPath(workspacePath, 'boards')
    this.trashDir = joinPath(workspacePath, 'trash')
    this.projectsDir = joinPath(workspacePath, 'projects')

    await auditWorkspaceHealth(workspacePath, 'sync-init-before-directory-check')
    for (const dir of [this.cardsDir, this.boardsDir, this.trashDir, this.projectsDir]) {
      if (!(await exists(dir))) {
        auditWorkspaceEvent({
          action: 'sync-init-create-missing-directory',
          workspacePath,
          path: dir,
        })
        await mkdir(dir)
      }
    }
    await auditWorkspaceHealth(workspacePath, 'sync-init-after-directory-check')

    this.running = true
  }

  stop(): Promise<void> {
    this.running = false
    return this.flushAll()
  }

  /** 丢弃所有未写盘的挂起写入。取消加载工作区时用，保证不产生任何磁盘写入。 */
  discard(): void {
    for (const { timer } of this.pendingWrites.values()) clearTimeout(timer)
    this.pendingWrites.clear()
    this.deferredBoardWrites.clear()
    this.running = false
  }

  // 提取共享的 drainPending 逻辑，flushNow 和 flushAll 都复用
  private drainPending(parallel: boolean): Promise<void> | void {
    // 按最终路径归并：同一文件只有最新一份数据（后写入的覆盖先排队的），
    // 否则 flushAll 并行写入时旧快照可能后落盘，把拖拽期间的最新快照覆盖掉。
    const entries = new Map<string, string>()
    for (const [key, { data, timer }] of this.pendingWrites) {
      clearTimeout(timer)
      entries.set(key.startsWith('delete:') ? key.slice(7) : key, data)
    }
    // 拖拽中被抑制的快照也一起排空：进程要关闭时，中间快照也比丢失好。
    for (const [path, data] of this.deferredBoardWrites) entries.set(path, data)
    this.pendingWrites.clear()
    this.deferredBoardWrites.clear()

    if (parallel) {
      // flushAll: 并行写入，返回 Promise
      return Promise.all([...entries].map(([path, data]) => this.writeEntry(path, data))).then(() => {})
    }
    // flushNow: 同步依次写入
    for (const [path, data] of entries) {
      this.writeEntry(path, data).catch(() => { /* noop */ })
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

  getWorkspacePath() { return this.workspacePath }

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
    const path = joinPath(this.boardsDir, `${boardId}.json`)
    const data = this.stringify(snapshot, false)
    if (this.isDragging) {
      // 拖拽期间不排盘（避免每帧写盘），但保留最新快照供 flush 使用。
      this.deferredBoardWrites.set(path, data)
      return
    }
    this.scheduleWrite(path, data, debounceMs)
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

  scheduleWriteProject(data: ProjectData, debounceMs = 300) {
    const path = joinPath(this.projectsDir, `${data.boardId}.json`)
    this.scheduleWrite(path, this.stringify(data), debounceMs)
  }

  scheduleDeleteProject(boardId: string) {
    this.scheduleDelete(this.projectsDir, `${boardId}.json`)
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
