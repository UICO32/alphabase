export interface WorkspaceMeta {
  path: string
  name: string
  lastOpened: number
}

export interface WorkspaceSettings {
  theme: 'light' | 'dark'
  autoCollapseCards: boolean
  showCardLibrary: boolean
  confirmDelete: boolean
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
  type: 'card' | 'section'
  position: { x: number; y: number }
  data: {
    cardId?: string
    color?: string
    variant?: string
    collapsed?: boolean
    fixedHeight?: boolean
    width?: number
    height?: number
    name?: string
  }
  width?: number
  height?: number
}

export interface BoardEdge {
  id: string
  source: string
  target: string
  type: 'connection'
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

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  theme: 'light',
  autoCollapseCards: false,
  showCardLibrary: true,
  confirmDelete: true,
}
