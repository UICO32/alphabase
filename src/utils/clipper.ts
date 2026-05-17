import type { ClipResult } from '../../electron/clipper/types'

export async function clipUrl(url: string, workspacePath?: string): Promise<ClipResult> {
  const electronAPI = (window as any).electronAPI
  if (!electronAPI?.clipper?.clip) {
    throw Object.assign(new Error('剪藏功能仅在 Electron 桌面端可用'), { code: 'UNSUPPORTED_PLATFORM' })
  }

  try {
    return await electronAPI.clipper.clip(url, workspacePath)
  } catch (err: any) {
    const errorBody = { error: err.message || '未知错误', code: err.code || 'FETCH_ERROR' }
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
