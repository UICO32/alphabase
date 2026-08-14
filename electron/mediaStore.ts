import { createHash } from 'crypto'
import { access, mkdir, rename, writeFile } from 'fs/promises'
import { basename, extname, join } from 'path'
import sharp from 'sharp'

export interface StoreWorkspaceMediaInput {
  bytes: Uint8Array | number[]
  mimeType: string
  name: string
}

export interface StoredWorkspaceMediaResult {
  assetId: string
  kind: 'image' | 'video'
  mimeType: string
  name: string
  size: number
  url: string
  width?: number
  height?: number
  durationMs?: number
  variants: Array<{ width: number; url: string }>
}

const IMAGE_VARIANT_WIDTHS = [512, 1024, 2048] as const
const MAX_IMAGE_BYTES = 100 * 1024 * 1024
const MAX_VIDEO_BYTES = 1024 * 1024 * 1024

const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

const EXTENSION_MIMES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
}

function mediaUrl(assetId: string, fileName: string) {
  return `hepta-media://${encodeURIComponent(assetId)}/${encodeURIComponent(fileName)}`
}

async function pathExists(path: string) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function atomicWrite(path: string, data: Buffer) {
  if (await pathExists(path)) return
  const tempPath = `${path}.${process.pid}-${Date.now()}.tmp`
  await writeFile(tempPath, data)
  try {
    await rename(tempPath, path)
  } catch (error) {
    if (!(await pathExists(path))) throw error
  }
}

export function normalizeMediaMimeType(mimeType: string, name: string) {
  const normalized = mimeType.trim().toLowerCase()
  if (MIME_EXTENSIONS[normalized]) return normalized
  return EXTENSION_MIMES[extname(name).toLowerCase()] ?? ''
}

export function getContentAssetId(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex')
}

export async function storeWorkspaceMedia(
  workspacePath: string,
  input: StoreWorkspaceMediaInput,
): Promise<StoredWorkspaceMediaResult> {
  const bytes = Uint8Array.from(input.bytes)
  const mimeType = normalizeMediaMimeType(input.mimeType, input.name)
  const extension = MIME_EXTENSIONS[mimeType]
  if (!extension) throw new Error('Unsupported media type')

  const kind = mimeType.startsWith('video/') ? 'video' : 'image'
  const maxBytes = kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  if (bytes.byteLength === 0) throw new Error('Media file is empty')
  if (bytes.byteLength > maxBytes) throw new Error(`${kind === 'video' ? 'Video' : 'Image'} file is too large`)

  const assetId = getContentAssetId(bytes)
  const mediaDir = join(workspacePath, 'media')
  await mkdir(mediaDir, { recursive: true })

  const originalFileName = `${assetId}.${extension}`
  await atomicWrite(join(mediaDir, originalFileName), Buffer.from(bytes))

  const result: StoredWorkspaceMediaResult = {
    assetId,
    kind,
    mimeType,
    name: basename(input.name || originalFileName),
    size: bytes.byteLength,
    url: mediaUrl(assetId, originalFileName),
    variants: [],
  }

  if (kind !== 'image' || mimeType === 'image/svg+xml' || mimeType === 'image/gif') return result

  const metadata = await sharp(bytes, { animated: false }).rotate().metadata()
  result.width = metadata.autoOrient.width ?? metadata.width
  result.height = metadata.autoOrient.height ?? metadata.height
  if (!result.width || !result.height) return result

  for (const width of IMAGE_VARIANT_WIDTHS) {
    if (width >= result.width) continue
    const variantFileName = `${assetId}.w${width}.webp`
    const variantPath = join(mediaDir, variantFileName)
    if (!(await pathExists(variantPath))) {
      const variant = await sharp(bytes, { animated: false })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 84, effort: 4 })
        .toBuffer()
      await atomicWrite(variantPath, variant)
    }
    result.variants.push({ width, url: mediaUrl(assetId, variantFileName) })
  }

  return result
}
