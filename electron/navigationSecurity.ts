function tryParse(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

export function isAllowedMainFrameNavigation(
  url: string,
  devServerUrl?: string,
  applicationEntryUrl?: string,
): boolean {
  const parsed = tryParse(url)
  if (!parsed) return false
  if (!devServerUrl) {
    const applicationEntry = applicationEntryUrl ? tryParse(applicationEntryUrl) : null
    if (applicationEntry === null || parsed.protocol !== 'file:' || applicationEntry.protocol !== 'file:') return false
    if (parsed.hostname !== applicationEntry.hostname || parsed.search !== applicationEntry.search) return false
    if (parsed.username || parsed.password || parsed.port) return false
    try {
      return normalize(fileURLToPath(parsed)) === normalize(fileURLToPath(applicationEntry))
    } catch {
      return false
    }
  }

  const devServer = tryParse(devServerUrl)
  return devServer !== null && parsed.origin === devServer.origin
}

export function isAllowedWebviewUrl(url: string): boolean {
  const parsed = tryParse(url)
  return parsed?.protocol === 'http:' || parsed?.protocol === 'https:'
}
import { normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
