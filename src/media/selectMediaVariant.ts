import type { MediaVariant } from './mediaTypes'

export function selectMediaVariant(
  originalUrl: string,
  variants: MediaVariant[] | undefined,
  targetWidth: number,
) {
  if (!variants?.length || !Number.isFinite(targetWidth) || targetWidth <= 0) return originalUrl
  const sorted = [...variants].sort((a, b) => a.width - b.width)
  return sorted.find((variant) => variant.width >= targetWidth)?.url ?? originalUrl
}
