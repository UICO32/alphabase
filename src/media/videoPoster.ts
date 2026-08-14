export async function captureVideoPoster(file: File): Promise<{
  width: number
  height: number
  durationMs?: number
  blob?: Blob
} | null> {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return null
  const objectUrl = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true
  video.playsInline = true

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('Video metadata timed out')), 8000)
      video.onloadedmetadata = () => {
        window.clearTimeout(timeout)
        resolve()
      }
      video.onerror = () => {
        window.clearTimeout(timeout)
        reject(new Error('Video metadata could not be decoded'))
      }
      video.src = objectUrl
    })

    const width = video.videoWidth
    const height = video.videoHeight
    if (!width || !height) return null
    const durationMs = Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : undefined

    if (Number.isFinite(video.duration) && video.duration > 0) {
      await new Promise<void>((resolve) => {
        const timeout = window.setTimeout(resolve, 3000)
        video.onseeked = () => {
          window.clearTimeout(timeout)
          resolve()
        }
        video.currentTime = Math.min(1, Math.max(0, video.duration * 0.1))
      })
    }

    const targetWidth = Math.min(width, 1024)
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = Math.max(1, Math.round(targetWidth * height / width))
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | undefined>((resolve) => canvas.toBlob(
      (value) => resolve(value ?? undefined),
      'image/webp',
      0.82,
    ))
    return { width, height, durationMs, blob }
  } catch {
    return null
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(objectUrl)
  }
}
