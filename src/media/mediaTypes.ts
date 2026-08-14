export interface MediaRef {
  mediaId: string
  name?: string
}

export interface StoredMediaFile {
  id: string
  fileName: string
  mimeType: string
  size: number
  createdAt: number
  width?: number
  height?: number
}

export interface StoreMediaResult {
  ref: MediaRef
  url: string
  file: StoredMediaFile
}

export interface MediaVariant {
  width: number
  url: string
}

export interface StoredWorkspaceMedia {
  assetId: string
  kind: 'image' | 'video'
  mimeType: string
  name: string
  size: number
  url: string
  width?: number
  height?: number
  durationMs?: number
  posterUrl?: string
  variants: MediaVariant[]
}
