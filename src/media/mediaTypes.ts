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
