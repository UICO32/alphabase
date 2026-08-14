export {}

declare global {
  const __APP_VERSION__: string
  const __DEV__: boolean
  interface BackupSummary {
    path: string
    timestamp: string
    createdAt: number
    cardCount: number
    boardCount: number
    trashCount: number
    mediaCount: number
    format: 'current' | 'legacy'
    warnings: string[]
  }
  interface BackupOperationResult {
    success: boolean
    stage?: 'selection' | 'validation' | 'safety-backup' | 'staging' | 'replacement' | 'reload' | 'export'
    error?: string
    path?: string
    safetyBackupPath?: string
    summary?: BackupSummary
  }
  interface StoredWorkspaceMedia {
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
    variants: Array<{ width: number; url: string }>
  }
  interface Window {
    electronAPI: {
      fs: {
        readFile: (path: string) => Promise<Uint8Array>
        writeFile: (path: string, data: string) => Promise<void>
        deleteFile: (path: string) => Promise<void>
        readdir: (path: string) => Promise<string[]>
        readDirFiles: (dirPath: string) => Promise<Record<string, string> | null>
        mkdir: (path: string) => Promise<void>
        stat: (path: string) => Promise<{ isDirectory: boolean; size: number; mtimeMs: number }>
        exists: (path: string) => Promise<boolean>
        rename: (oldPath: string, newPath: string) => Promise<void>
        rmdir: (path: string) => Promise<void>
      }
      media: {
        store: (workspacePath: string, input: {
          bytes: Uint8Array
          mimeType: string
          name: string
        }) => Promise<StoredWorkspaceMedia>
      }
      dialog: {
        openDirectory: () => Promise<string | null>
      }
      backup: {
        selectExternal: () => Promise<BackupOperationResult | null>
        createAutomatic: (workspacePath: string) => Promise<BackupOperationResult>
        listRecent: (workspacePath: string) => Promise<BackupSummary[]>
        exportCurrent: (workspacePath: string) => Promise<BackupOperationResult>
        exportRecent: (workspacePath: string, timestamp: string) => Promise<BackupOperationResult>
        restoreExternal: (workspacePath: string, sourcePath: string) => Promise<BackupOperationResult>
        restoreRecent: (workspacePath: string, timestamp: string) => Promise<BackupOperationResult>
        openExportDirectory: (directoryPath: string) => Promise<void>
      }
      shell: {
        openExternal: (url: string) => Promise<void>
      }
      window: {
        minimize: () => Promise<void>
        maximize: () => Promise<void>
        close: () => Promise<void>
        isMaximized: () => Promise<boolean>
      }
      clipper: {
        clip: (url: string, workspacePath?: string) => Promise<{ title: string; html: string; markdown: string; sourceUrl: string; sourceName: string; favicon?: string; images: Array<{ originalUrl: string; localFilename: string; originalSize: number; compressedSize: number }> }>
        agentReachBrowse: (req: {
          platform: 'twitter' | 'bilibili' | 'youtube' | 'xiaohongshu'
          action: 'search' | 'hot' | 'rank' | 'trending'
          query?: string
          limit?: number
          workspacePath?: string
        }) => Promise<{
          items: Array<{
            id: string
            title: string
            author?: string
            url: string
            thumbnail?: string
            description?: string
            stats?: Record<string, string | number>
            duration?: string
          }>
          hasMore: boolean
        }>
      }
      flomo: {
        login: (email: string, password: string) => Promise<{ accessToken: string }>
        fetchMemos: (accessToken: string, lastSyncTime?: string) => Promise<{ memos: Array<{ slug: string; content: string; tags: Array<{ name: string }>; created_at: string; updated_at: string; files: Array<{ url: string; type: string }> }> }>
        downloadImg: (url: string, destPath: string) => Promise<{ success: boolean; error?: string }>
      }
      embedding: {
        init: (workspacePath: string) => Promise<{
          modelLoaded: boolean
          storeLoaded: boolean
          docCount: number
          totalCards: number
          error?: string
        }>
        indexAll: () => Promise<{
          totalCards: number
          indexedCount: number
          newIndexed: number
          skipped: number
          empty: number
          failed: number
          removed: number
          error?: string
        }>
        retryInit: () => Promise<{
          modelLoaded: boolean
          storeLoaded: boolean
          docCount: number
          totalCards: number
          error?: string
        }>
        indexCard: (cardId: string) => Promise<{
          success: boolean
          indexed?: boolean
          changed?: boolean
          reason?: 'empty' | 'missing'
          error?: string
        }>
        removeVector: (cardId: string) => Promise<{ success: boolean; error?: string }>
        cluster: (minClusterSize?: number, clusterThreshold?: number) => Promise<{
          clusters: Array<{
            id: string
            label: string
            centroid: number[]
            cardIds: string[]
            cohesion: number
            cardSimilarities: Record<string, number>
          }>
          orphanCards: string[]
          computedAt: number
          error?: string
        }>
        search: (cardId: string, topK?: number) => Promise<{ results: Array<{ cardId: string; score: number; modality: string }> }>
        searchByText: (query: string, topK?: number) => Promise<{ results: Array<{ cardId: string; score: number; modality: string }>; error?: string }>
        cancel: () => Promise<{ cancelled: boolean }>
        getStatus: () => Promise<{
          initialized: boolean
          modelAvailable: boolean
          indexing: boolean
          docCount: number
          totalCards: number
          modelDir: string
          initializationError?: string | null
        }>
        checkModel: () => Promise<{ available: boolean }>
        setThreshold: (value: number) => Promise<{ success: boolean }>
        downloadModel: () => Promise<{ success?: boolean; error?: string }>
        cancelDownload: () => Promise<{ cancelled: boolean }>
        getDownloadConfig: () => Promise<{ configured: boolean; modelDir: string }>
        onProgress: (callback: (data: { current: number; total: number }) => void) => () => void
        onComplete: (callback: (data: { totalCards: number; indexedCount: number; newIndexed: number; skipped: number; empty: number; failed: number; removed: number }) => void) => () => void
        onError: (callback: (data: { message: string }) => void) => () => void
        onDownloadProgress: (callback: (data: { progress: number; currentFile: string }) => void) => () => void
        onDownloadComplete: (callback: (data: { success: boolean }) => void) => () => void
        onDownloadError: (callback: (data: { message: string; cancelled?: boolean }) => void) => () => void
      }
      startup: {
        log: (data: any) => Promise<void>
        notifyProgress: (data: { step: string; progress: number; total: number }) => void
        notifyDataReady: () => void
      }
      onFlushBeforeClose: (callback: () => Promise<void>) => () => void
      app: {
        readChangelog: () => Promise<string>
      }
      workspace: {
        auditEvent: (payload: {
          level?: 'info' | 'warn' | 'error'
          action: string
          workspacePath?: string
          path?: string
          ok?: boolean
          details?: Record<string, unknown>
          error?: string
        }) => Promise<void>
      }
    }
  }
}
