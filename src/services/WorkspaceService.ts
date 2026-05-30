import { readJSON, writeJSON, exists, readdir, readDirFiles, mkdir, deleteFile } from '../utils/workspace/fs'
import type { BoardManifest, BoardSnapshot, CardFile, TrashFile, WorkspaceMetadata, ConflictDiffItem } from '../utils/workspace/types'

export class WorkspaceService {
  private workspacePath: string = ''

  constructor() {}

  setWorkspacePath(path: string) {
    this.workspacePath = path
  }

  getWorkspacePath() { return this.workspacePath }

  // --- Board Manifest ---

  async loadManifest(): Promise<BoardManifest> {
    const path = `${this.workspacePath}/boards/_manifest.json`
    if (!(await exists(path))) {
      const boardsDir = `${this.workspacePath}/boards`
      if (!(await exists(boardsDir))) await mkdir(boardsDir)
      const empty: BoardManifest = { boards: [] }
      await writeJSON(path, empty)
      return empty
    }
    return await readJSON<BoardManifest>(path)
  }

  async saveManifest(manifest: BoardManifest): Promise<void> {
    const boardsDir = `${this.workspacePath}/boards`
    if (!(await exists(boardsDir))) await mkdir(boardsDir)
    await writeJSON(`${this.workspacePath}/boards/_manifest.json`, manifest)
  }

  // --- Board Snapshots ---

  async loadBoard(boardId: string): Promise<BoardSnapshot | null> {
    const path = `${this.workspacePath}/boards/${boardId}.json`
    if (!(await exists(path))) return null
    const data = await readJSON<BoardSnapshot>(path)
    // Handle legacy v1 format migration
    if ((data as unknown as Record<string, unknown>).version !== 2) {
      return this.migrateLegacyBoard(data as unknown as Record<string, unknown>)
    }
    return data
  }

  async loadAllBoards(): Promise<Map<string, BoardSnapshot>> {
    const dir = `${this.workspacePath}/boards`
    const result = new Map<string, BoardSnapshot>()

    const batchResult = await readDirFiles(dir)
    if (batchResult) {
      for (const [filename, content] of Object.entries(batchResult)) {
        if (filename === '_manifest.json' || !filename.endsWith('.json')) continue
        const boardId = filename.replace('.json', '')
        try {
          const data = JSON.parse(content) as BoardSnapshot
          if ((data as unknown as Record<string, unknown>).version !== 2) {
            const migrated = this.migrateLegacyBoard(data as unknown as Record<string, unknown>)
            result.set(boardId, migrated)
          } else {
            result.set(boardId, data)
          }
        } catch { /* skip invalid */ }
      }
      return result
    }

    // Fallback
    if (!(await exists(dir))) return result
    const files = await readdir(dir)
    for (const file of files) {
      if (!file.endsWith('.json') || file === '_manifest.json') continue
      const boardId = file.replace('.json', '')
      try {
        const data = await readJSON<BoardSnapshot>(`${dir}/${file}`)
        if ((data as unknown as Record<string, unknown>).version !== 2) {
          result.set(boardId, this.migrateLegacyBoard(data as unknown as Record<string, unknown>))
        } else {
          result.set(boardId, data)
        }
      } catch { /* skip */ }
    }
    return result
  }

  async saveBoard(boardId: string, snapshot: BoardSnapshot): Promise<void> {
    await writeJSON(`${this.workspacePath}/boards/${boardId}.json`, snapshot)
  }

  // --- Cards ---

  async loadCard(cardId: string): Promise<CardFile | null> {
    const path = `${this.workspacePath}/cards/${cardId}.json`
    if (!(await exists(path))) return null
    return await readJSON<CardFile>(path)
  }

  async loadAllCards(): Promise<CardFile[]> {
    const dir = `${this.workspacePath}/cards`
    if (!(await exists(dir))) return []

    // Use batch read for better IPC performance
    const batchResult = await readDirFiles(dir)
    if (batchResult) {
      const cards: CardFile[] = []
      for (const [, content] of Object.entries(batchResult)) {
        try {
          const card = JSON.parse(content) as CardFile
          if (card && card.id) {
            cards.push(card)
          }
        } catch { /* skip invalid JSON */ }
      }
      return cards
    }

    // Fallback to individual reads if batch read not available
    const files = await readdir(dir)
    const jsonFiles = files.filter((f) => f.endsWith('.json'))
    const results = await Promise.all(
      jsonFiles.map(file =>
        readJSON<CardFile>(`${dir}/${file}`).catch(() => null)
      )
    )
    return results.filter((c): c is CardFile => c !== null)
  }

  async saveCard(card: CardFile): Promise<void> {
    const dir = `${this.workspacePath}/cards`
    if (!(await exists(dir))) await mkdir(dir)
    await writeJSON(`${dir}/${card.id}.json`, card)
  }

  async deleteCard(cardId: string): Promise<void> {
    const path = `${this.workspacePath}/cards/${cardId}.json`
    if (await exists(path)) {
      await deleteFile(path)
    }
  }

  // --- Trash ---

  async loadAllTrash(): Promise<TrashFile[]> {
    const dir = `${this.workspacePath}/trash`
    if (!(await exists(dir))) return []

    const batchResult = await readDirFiles(dir)
    if (batchResult) {
      const items: TrashFile[] = []
      for (const [filename, content] of Object.entries(batchResult)) {
        if (!filename.endsWith('.trash.json')) continue
        try {
          const item = JSON.parse(content) as TrashFile
          if (item && item.cardId) {
            items.push(item)
          }
        } catch { /* skip invalid JSON */ }
      }
      return items
    }

    const files = await readdir(dir)
    const jsonFiles = files.filter((f) => f.endsWith('.trash.json'))
    const results = await Promise.all(
      jsonFiles.map(file =>
        readJSON<TrashFile>(`${dir}/${file}`).catch(() => null)
      )
    )
    return results.filter((i): i is TrashFile => i !== null)
  }

  async cleanExpiredTrash(): Promise<number> {
    const dir = `${this.workspacePath}/trash`
    if (!(await exists(dir))) return 0
    const files = await readdir(dir)
    const now = Date.now()
    let cleaned = 0
    for (const file of files) {
      if (!file.endsWith('.trash.json')) continue
      try {
        const item = await readJSON<TrashFile>(`${dir}/${file}`)
        if (item.expiresAt <= now) {
          await deleteFile(`${dir}/${file}`)
          cleaned++
        }
      } catch {
        // If parsing fails, skip
      }
    }
    return cleaned
  }

  // --- Metadata ---

  async loadMetadata(): Promise<WorkspaceMetadata | null> {
    const path = `${this.workspacePath}/_metadata.json`
    if (!(await exists(path))) return null
    try {
      const data = await readJSON<WorkspaceMetadata>(path)
      if (data.version !== 1) {
        return null
      }
      return data
    } catch {
      return null
    }
  }

  async saveMetadata(metadata: WorkspaceMetadata): Promise<void> {
    await writeJSON(`${this.workspacePath}/_metadata.json`, metadata)
  }

  async validateConsistency(): Promise<{
    consistent: boolean
    metadata: WorkspaceMetadata | null
    actualCards: number
    actualBoards: number
    issues: string[]
    diffItems: ConflictDiffItem[]
  }> {
    const [metadata, cards, manifest] = await Promise.all([
      this.loadMetadata(),
      this.loadAllCards(),
      this.loadManifest(),
    ])

    const actualCards = cards.length
    const actualBoards = manifest.boards.length
    const issues: string[] = []
    const diffItems: ConflictDiffItem[] = []

    if (!metadata) {
      return {
        consistent: true,
        metadata: null,
        actualCards,
        actualBoards,
        issues,
        diffItems,
      }
    }

    // Build sets for diff computation
    const boardIdsInManifest = new Set(manifest.boards.map(b => b.id))

    // Cards: metadata records but missing from disk
    if (metadata.cardCount > actualCards) {
      // Some cards in metadata are missing from disk — we can't list their titles
      // since they're gone, but we record the count
    }

    // Cards: on disk but not counted in metadata
    const metadataCardIds = new Set<string>()
    if (metadata.cardCount !== actualCards) {
      // Record disk-extra cards (we have their data)
      for (const card of cards) {
        metadataCardIds.add(card.id)
      }
    }

    // Board diff: files on disk but not in manifest
    const boardsDir = `${this.workspacePath}/boards`
    const boardIdsOnDisk = new Set<string>()
    if (await exists(boardsDir)) {
      const boardFiles = await readdir(boardsDir)
      for (const file of boardFiles) {
        if (!file.endsWith('.json') || file === '_manifest.json') continue
        const boardId = file.replace('.json', '')
        boardIdsOnDisk.add(boardId)
        if (!boardIdsInManifest.has(boardId)) {
          issues.push(`Board file ${boardId}.json exists but not in manifest`)
          diffItems.push({
            id: boardId,
            title: `画板 ${boardId}`,
            type: 'board',
            diffType: 'extra',
          })
        }
      }
    }

    // Board diff: in manifest but file missing on disk
    for (const board of manifest.boards) {
      const boardPath = `${this.workspacePath}/boards/${board.id}.json`
      if (!(await exists(boardPath))) {
        issues.push(`Board ${board.id} in manifest but file missing`)
        diffItems.push({
          id: board.id,
          title: board.name || board.id,
          type: 'board',
          diffType: 'missing',
          updatedAt: board.updatedAt,
        })
      }
    }

    // Card diff: compute extra/missing based on metadata count vs actual
    if (metadata.cardCount !== actualCards) {
      // Cards on disk are "extra" relative to metadata if actual > expected
      if (actualCards > metadata.cardCount) {
        const extraCount = actualCards - metadata.cardCount
        // We can't easily know which cards are "extra" vs "expected"
        // but we can list the most recently modified ones as likely extras
        const sortedByTime = [...cards].sort((a, b) =>
          (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt)
        )
        for (let i = 0; i < Math.min(extraCount, sortedByTime.length); i++) {
          const c = sortedByTime[i]
          diffItems.push({
            id: c.id,
            title: c.title || c.id,
            type: 'card',
            diffType: 'extra',
            updatedAt: c.updatedAt ?? c.createdAt,
          })
        }
      }
      // Cards missing from disk if actual < expected
      if (actualCards < metadata.cardCount) {
        const missingCount = metadata.cardCount - actualCards
        diffItems.push({
          id: '__missing_cards',
          title: `${missingCount} 张卡片`,
          type: 'card',
          diffType: 'missing',
        })
      }
    }

    const consistent = metadata.cardCount === actualCards && metadata.boardCount === actualBoards && issues.length === 0

    return {
      consistent,
      metadata,
      actualCards,
      actualBoards,
      issues,
      diffItems,
    }
  }

  async repairConsistency(): Promise<{ repaired: boolean; actions: string[] }> {
    const manifest = await this.loadManifest()
    const actions: string[] = []
    const boardsDir = `${this.workspacePath}/boards`

    // 修复 manifest：删除文件缺失的 board 条目
    const validBoards = []
    for (const board of manifest.boards) {
      const boardPath = `${boardsDir}/${board.id}.json`
      if (await exists(boardPath)) {
        validBoards.push(board)
      } else {
        actions.push(`Removed board ${board.id} from manifest (file missing)`)
      }
    }

    // 添加孤立文件到 manifest
    if (await exists(boardsDir)) {
      const boardFiles = await readdir(boardsDir)
      for (const file of boardFiles) {
        if (!file.endsWith('.json') || file === '_manifest.json') continue
        const boardId = file.replace('.json', '')
        if (!validBoards.some(b => b.id === boardId)) {
          try {
            await readJSON<BoardSnapshot>(`${boardsDir}/${file}`)
            validBoards.push({
              id: boardId,
              name: `Recovered board ${boardId}`,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            })
            actions.push(`Added orphan board file ${boardId} to manifest`)
          } catch {
            actions.push(`Skipped invalid board file ${boardId}`)
          }
        }
      }
    }

    if (validBoards.length !== manifest.boards.length || actions.length > 0) {
      const cards = await this.loadAllCards()
      await this.saveManifest({ boards: validBoards })
      await this.saveMetadata({ version: 1, cardCount: cards.length, boardCount: validBoards.length, lastModified: Date.now() })
      return { repaired: true, actions }
    }

    return { repaired: false, actions }
  }

  // --- Legacy Migration ---

  private migrateLegacyBoard(_legacy: Record<string, unknown>): BoardSnapshot {
    // TODO: Implement legacy tldraw snapshot to BoardSnapshot migration
    return {
      version: 2,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    }
  }
}
