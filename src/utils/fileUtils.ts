export const COMPRESS_MAX_WIDTH = 1600
export const COMPRESS_QUALITY = 0.85
export const COMPRESS_SKIP_THRESHOLD = 300 * 1024

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Failed to read file as data URL'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export async function fileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) return readFileAsDataUrl(file)
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return readFileAsDataUrl(file)
  if (file.size < COMPRESS_SKIP_THRESHOLD) return readFileAsDataUrl(file)

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const { width, height } = img
      if (width <= COMPRESS_MAX_WIDTH) {
        URL.revokeObjectURL(img.src)
        readFileAsDataUrl(file).then(resolve)
        return
      }
      const scale = COMPRESS_MAX_WIDTH / width
      const canvas = document.createElement('canvas')
      canvas.width = COMPRESS_MAX_WIDTH
      canvas.height = Math.round(height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(img.src)
        readFileAsDataUrl(file).then(resolve)
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(img.src)
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
      resolve(canvas.toDataURL(outputType, COMPRESS_QUALITY))
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      readFileAsDataUrl(file).then(resolve)
    }
    img.src = URL.createObjectURL(file)
  })
}

export function isImageFile(file: File) {
  if (file.type.toLowerCase().startsWith('image/')) return true
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif|heic|heif)$/i.test(file.name)
}

export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
