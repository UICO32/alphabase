export interface ClipRequest {
  url: string
  workspacePath?: string
}

export interface ImageInfo {
  originalUrl: string
  localFilename: string
  originalSize: number
  compressedSize: number
}

export interface ClipResult {
  title: string
  html: string
  markdown: string
  sourceUrl: string
  sourceName: string
  favicon?: string
  images: ImageInfo[]
  imageUrls?: string[] // internal: collected before download, deleted after
}

export interface ClipErrorBody {
  error: string
  code: 'TIMEOUT' | 'FETCH_ERROR' | 'PARSE_ERROR' | 'UNSUPPORTED_PLATFORM' | 'NO_CONTENT' | 'WECHAT_CAPTCHA'
}

export type Platform = 'xiaohongshu' | 'wechat' | 'generic'
