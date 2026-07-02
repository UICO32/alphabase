import type { MediaRef } from './mediaTypes'

const MEDIA_PROTOCOL = 'hepta-media://'

export function formatMediaUrl(mediaId: string, name?: string) {
  const encodedId = encodeURIComponent(mediaId)
  if (!name) return `${MEDIA_PROTOCOL}${encodedId}`
  return `${MEDIA_PROTOCOL}${encodedId}/${encodeURIComponent(name)}`
}

export function isMediaUrl(value: string | undefined | null) {
  return typeof value === 'string' && value.startsWith(MEDIA_PROTOCOL) && value.length > MEDIA_PROTOCOL.length
}

export function parseMediaUrl(value: string | undefined | null): MediaRef | null {
  if (!isMediaUrl(value)) return null

  const mediaUrl = value as string
  const rest = mediaUrl.slice(MEDIA_PROTOCOL.length).split('?')[0] ?? ''
  const slashIndex = rest.indexOf('/')
  const rawId = slashIndex >= 0 ? rest.slice(0, slashIndex) : rest
  const rawName = slashIndex >= 0 ? rest.slice(slashIndex + 1) : ''
  if (!rawId) return null

  return {
    mediaId: decodeURIComponent(rawId),
    name: rawName ? decodeURIComponent(rawName) : undefined,
  }
}
