import { readJSON, writeJSON, exists, readdir, mkdir } from '../utils/workspace/fs'
import type { BoardManifest, BoardSnapshot, CardFile } from '../utils/workspace/types'

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
      const empty: BoardManifest = { boards: [] }
      await writeJSON(path, empty)
      return empty
    }
    return await readJSON<BoardManifest>(path)
  }

  async saveManifest(manifest: BoardManifest): Promise<void> {
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
      } catch (e) {
        console.warn(`Failed to load card ${file}:`, e)
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
      const { deleteFile } = await import('../utils/workspace/fs')
      await deleteFile(path)
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
