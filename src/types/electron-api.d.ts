export {}

declare global {
  interface Window {
    electronAPI: {
      fs: {
        readFile: (path: string) => Promise<Uint8Array>
        writeFile: (path: string, data: string) => Promise<void>
        deleteFile: (path: string) => Promise<void>
        readdir: (path: string) => Promise<string[]>
        mkdir: (path: string) => Promise<void>
        stat: (path: string) => Promise<{ isDirectory: boolean; size: number; mtimeMs: number }>
        exists: (path: string) => Promise<boolean>
        rename: (oldPath: string, newPath: string) => Promise<void>
        rmdir: (path: string) => Promise<void>
      }
      dialog: {
        openDirectory: () => Promise<string | null>
      }
      clipper: {
        clip: (url: string, workspacePath?: string) => Promise<any>
      }
      flomo: {
        login: (email: string, password: string) => Promise<{ accessToken: string }>
        fetchMemos: (accessToken: string, lastSyncTime?: string) => Promise<{ memos: any[] }>
        downloadImg: (url: string, destPath: string) => Promise<{ success: boolean; error?: string }>
      }
      embedding: {
        init: (workspacePath: string) => Promise<{ initialized: boolean; error?: string }>
        indexAll: () => Promise<{ started: boolean; error?: string }>
        search: (cardId: string, topK?: number) => Promise<{ results: Array<{ cardId: string; score: number; modality: string }> }>
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
    }
  }
}