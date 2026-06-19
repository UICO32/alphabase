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
    | 'CLI_NOT_FOUND' | 'CLI_TIMEOUT' | 'CLI_ERROR'
}

export type Platform = 'xiaohongshu' | 'wechat' | 'generic'
  | 'twitter' | 'bilibili' | 'youtube' | 'xiaoyuzhou'

export interface AgentReachBrowseRequest {
  platform: 'twitter' | 'bilibili' | 'youtube' | 'xiaohongshu'
  action: 'search' | 'hot' | 'rank' | 'trending'
  query?: string
  limit?: number
  workspacePath?: string
}

export interface AgentReachBrowseItem {
  id: string
  title: string
  author?: string
  url: string
  thumbnail?: string
  description?: string
  stats?: Record<string, string | number>
  duration?: string
}

export interface AgentReachBrowseResult {
  items: AgentReachBrowseItem[]
  hasMore: boolean
}
