export interface WorkspaceMeta {
  path: string
  name: string
  lastOpened: number
}

export interface WorkspaceSettings {
  theme: 'light' | 'dark'
  confirmDelete: boolean
  embeddingThreshold: number
}

export interface BoardMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  /** 项目画布标记：该画布同时是一个「项目」，配套 projects/<id>.json */
  isProject?: boolean
}

export interface BoardManifest {
  boards: BoardMeta[]
}

export interface BoardNode {
  id: string
  type: 'card' | 'frame' | 'media' | 'text'
  position: { x: number; y: number }
  data: Record<string, unknown>
  width?: number
  height?: number
}

export interface BoardEdge {
  id: string
  source: string
  target: string
  type: 'connection'
  sourceHandle?: string
  targetHandle?: string
}

export interface BoardViewport {
  x: number
  y: number
  zoom: number
}

export const DEFAULT_BOARD_VIEWPORT: BoardViewport = { x: 0, y: 0, zoom: 1 }

/**
 * Viewports written by older versions were always { x: 0, y: 0, zoom: 1 }.
 * Treat that value as "not visited yet" so existing boards get a content-fit
 * entry instead of reopening at the canvas origin.
 */
export function getPersistedBoardViewport(viewport: BoardViewport | null | undefined): BoardViewport | undefined {
  if (!viewport) return undefined
  if (!Number.isFinite(viewport.x) || !Number.isFinite(viewport.y) || !Number.isFinite(viewport.zoom) || viewport.zoom <= 0) {
    return undefined
  }
  if (viewport.x === 0 && viewport.y === 0 && viewport.zoom === 1) return undefined
  return { x: viewport.x, y: viewport.y, zoom: viewport.zoom }
}

export interface BoardSnapshot {
  version: 2
  nodes: BoardNode[]
  edges: BoardEdge[]
  viewport: BoardViewport
}

export interface CardFile {
  id: string
  title: string
  color: string
  variant?: string
  createdAt: number
  content: string
  enforceInitialHeading?: boolean
  fixedHeight?: boolean
  collapsed?: boolean
  tags?: string[]
  updatedAt?: number
  deletedAt?: number
  sourceUrl?: string
  flomoSlug?: string
}

export interface TrashFile {
  id: string
  cardId: string
  title: string
  deletedAt: number
  expiresAt: number
  content: string
  color: string
  variant?: string
  createdAt: number
  enforceInitialHeading?: boolean
  fixedHeight?: boolean
  collapsed?: boolean
  tags?: string[]
}

export interface WorkspaceMetadata {
  version: 1
  cardCount: number
  boardCount: number
  lastModified: number
}

export interface ConflictDiffItem {
  id: string
  title: string
  type: 'card' | 'board'
  diffType: 'extra' | 'missing'
  updatedAt?: number
}

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  theme: 'light',
  confirmDelete: true,
  embeddingThreshold: 0.75,
}

// ─── 项目画板（Project） ───
// 项目 = 一块带 isProject 标记的画布 + 一份元数据文件（projects/<boardId>.json）。
// 成果 = 指向画布节点（卡片或 frame）的锚点，归属显式的问题列表（questions）。
export interface ProjectQuestion {
  id: string
  title: string
}

export interface ProjectOutcome {
  id: string
  /** 画布节点 id：卡片节点即 cardId；frame 节点即 frameId */
  nodeId: string
  nodeType: 'card' | 'frame'
  questionId: string
  at: number
}

export interface ProjectData {
  version: 1
  boardId: string
  questions: ProjectQuestion[]
  outcomes: ProjectOutcome[]
  createdAt: number
  updatedAt: number
}
