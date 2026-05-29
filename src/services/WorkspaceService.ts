import { readJSON, writeJSON, exists, readdir, mkdir, deleteFile } from '../utils/workspace/fs'
import type { BoardManifest, BoardSnapshot, CardFile, TrashFile, WorkspaceMetadata } from '../utils/workspace/types'

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
    const files = await readdir(dir)
    const jsonFiles = files.filter((f) => f.endsWith('.json'))
    const cards: CardFile[] = []
    for (const file of jsonFiles) {
      try {
        const card = await readJSON<CardFile>(`${dir}/${file}`)
        cards.push(card)
      } catch {
        // skip invalid card files
      }
    }
    return cards
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
    const files = await readdir(dir)
    const jsonFiles = files.filter((f) => f.endsWith('.trash.json'))
    const items: TrashFile[] = []
    for (const file of jsonFiles) {
      try {
        const item = await readJSON<TrashFile>(`${dir}/${file}`)
        items.push(item)
      } catch {
        // skip invalid trash files
      }
    }
    return items
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
  }> {
    const metadata = await this.loadMetadata()
    const cards = await this.loadAllCards()
    const manifest = await this.loadManifest()

    const actualCards = cards.length
    const actualBoards = manifest.boards.length

    if (!metadata) {
      return {
        consistent: true,
        metadata: null,
        actualCards,
        actualBoards,
      }
    }

    const consistent = metadata.cardCount === actualCards && metadata.boardCount === actualBoards

    return {
      consistent,
      metadata,
      actualCards,
      actualBoards,
    }
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
