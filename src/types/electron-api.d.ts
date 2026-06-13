export {}

declare global {
  const __APP_VERSION__: string
  const __DEV__: boolean
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
      dialog: {
        openDirectory: () => Promise<string | null>
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
          error?: string
        }>
        indexAll: () => Promise<{
          totalCards: number
          newIndexed: number
          skipped: number
          removed: number
          error?: string
        }>
        indexCard: (cardId: string) => Promise<{
          success: boolean
          error?: string
        }>
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
          modelDir: string
        }>
        checkModel: () => Promise<{ available: boolean }>
        setThreshold: (value: number) => Promise<{ success: boolean }>
        onProgress: (callback: (data: { current: number; total: number }) => void) => () => void
        onComplete: (callback: (data: { totalCards: number; newIndexed: number; skipped: number; removed: number }) => void) => () => void
        onError: (callback: (data: { message: string }) => void) => () => void
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
        registerPath: (path: string) => Promise<void>
        unregisterPath: (path: string) => Promise<void>
      }
    }
  }
}