import { parseMediaUrl } from './mediaUrl'

export function resolveMediaUrlForDisplay(url: string, workspacePath: string | null) {
  const ref = parseMediaUrl(url)
  if (!ref || !workspacePath) return url

  const normalizedWorkspacePath = workspacePath.replace(/\\/g, '/')
  const fileName = ref.name ?? `${ref.mediaId}.bin`
  return `hepta-media://${fileName}?workspace=${encodeURIComponent(normalizedWorkspacePath)}`
}
