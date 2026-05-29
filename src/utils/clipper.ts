import type { ClipResult } from '../../electron/clipper/types'

export async function clipUrl(url: string, workspacePath?: string): Promise<ClipResult> {
  const electronAPI = (window as any).electronAPI
  if (!electronAPI?.clipper?.clip) {
    throw Object.assign(new Error('剪藏功能仅在 Electron 桌面端可用'), { code: 'UNSUPPORTED_PLATFORM' })
  }

  try {
    return await electronAPI.clipper.clip(url, workspacePath)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知错误'
    const code = (err as Record<string, unknown>)?.code || 'FETCH_ERROR'
    const errorBody = { error: message, code }
    throw Object.assign(new Error(errorBody.error), { code: errorBody.code })
  }
}

export function isValidHttpUrl(text: string): boolean {
  try {
    const url = new URL(text)
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}
