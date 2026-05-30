export {}

declare global {
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
      clipper: {
        clip: (url: string, workspacePath?: string) => Promise<{ title: string; html: string; markdown: string; sourceUrl: string; sourceName: string; favicon?: string; images: Array<{ originalUrl: string; localFilename: string; originalSize: number; compressedSize: number }> }>
      }
      flomo: {
        login: (email: string, password: string) => Promise<{ accessToken: string }>
        fetchMemos: (accessToken: string, lastSyncTime?: string) => Promise<{ memos: Array<{ slug: string; content: string; tags: Array<{ name: string }>; created_at: string; updated_at: string; files: Array<{ url: string; type: string }> }> }>
        downloadImg: (url: string, destPath: string) => Promise<{ success: boolean; error?: string }>
      }
      embedding: {
        init: (workspacePath: string) => Promise<{ initialized: boolean; error?: string }>
        indexAll: () => Promise<{ started: boolean; error?: string }>
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
        onProgress: (callback: (data: { current: number; total: number; indexed: number; skipped: number }) => void) => () => void
        onComplete: (callback: (data: { indexed: number; skipped: number }) => void) => () => void
        onError: (callback: (data: { message: string }) => void) => () => void
      }
      startup: {
        log: (data: any) => Promise<void>
      }
      onFlushBeforeClose: (callback: () => Promise<void>) => () => void
    }
  }
}