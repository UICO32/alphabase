function tryParse(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

export function isAllowedMainFrameNavigation(url: string, devServerUrl?: string): boolean {
  const parsed = tryParse(url)
  if (!parsed) return false
  if (parsed.protocol === 'hepta-media:') return true
  if (!devServerUrl) return false

  const devServer = tryParse(devServerUrl)
  return devServer !== null && parsed.origin === devServer.origin
}

export function isAllowedWebviewUrl(url: string): boolean {
  const parsed = tryParse(url)
  return parsed?.protocol === 'http:' || parsed?.protocol === 'https:'
}
