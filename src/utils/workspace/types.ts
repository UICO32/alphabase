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
}

export interface BoardManifest {
  boards: BoardMeta[]
}

export interface BoardNode {
  id: string
  type: 'card' | 'frame' | 'media'
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

export interface BoardSnapshot {
  version: 2
  nodes: BoardNode[]
  edges: BoardEdge[]
  viewport: { x: number; y: number; zoom: number }
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
