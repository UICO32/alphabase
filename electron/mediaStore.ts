import { createHash } from 'crypto'
import { createReadStream, createWriteStream } from 'fs'
import { access, mkdir, rename, stat, unlink, writeFile } from 'fs/promises'
import { basename, extname, join } from 'path'
import { pipeline } from 'stream/promises'
import sharp from 'sharp'

export interface StoreWorkspaceMediaInput {
  bytes: Uint8Array | number[]
  mimeType: string
  name: string
}

export interface StoreWorkspaceMediaPathInput {
  sourcePath: string
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

function tempPathFor(destinationPath: string) {
  return `${destinationPath}.${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.tmp`
}

async function atomicWrite(path: string, data: Buffer) {
  if (await pathExists(path)) return
  const tempPath = tempPathFor(path)
  await writeFile(tempPath, data)
  try {
    await rename(tempPath, path)
  } catch (error) {
    if (!(await pathExists(path))) throw error
  }
}

async function atomicCopy(sourcePath: string, destinationPath: string) {
  if (await pathExists(destinationPath)) return
  const tempPath = tempPathFor(destinationPath)
  try {
    await pipeline(createReadStream(sourcePath), createWriteStream(tempPath, { flags: 'wx' }))
    try {
      await rename(tempPath, destinationPath)
    } catch (error) {
      if (!(await pathExists(destinationPath))) throw error
      await unlink(tempPath).catch(() => {})
    }
  } catch (error) {
    await unlink(tempPath).catch(() => {})
    throw error
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

export async function getFileContentAssetId(sourcePath: string) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(sourcePath)) hash.update(chunk)
  return hash.digest('hex')
}

function validateMediaSize(kind: 'image' | 'video', byteLength: number) {
  const maxBytes = kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  if (byteLength === 0) throw new Error('Media file is empty')
  if (byteLength > maxBytes) throw new Error(`${kind === 'video' ? 'Video' : 'Image'} file is too large`)
}

async function addImageMetadataAndVariants(
  result: StoredWorkspaceMediaResult,
  input: Buffer | string,
  mediaDir: string,
) {
  if (result.kind !== 'image' || result.mimeType === 'image/svg+xml' || result.mimeType === 'image/gif') return result

  const metadata = await sharp(input, { animated: false }).rotate().metadata()
  result.width = metadata.autoOrient.width ?? metadata.width
  result.height = metadata.autoOrient.height ?? metadata.height
  if (!result.width || !result.height) return result

  for (const width of IMAGE_VARIANT_WIDTHS) {
    if (width >= result.width) continue
    const variantFileName = `${result.assetId}.w${width}.webp`
    const variantPath = join(mediaDir, variantFileName)
    if (!(await pathExists(variantPath))) {
      const variant = await sharp(input, { animated: false })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 84, effort: 4 })
        .toBuffer()
      await atomicWrite(variantPath, variant)
    }
    result.variants.push({ width, url: mediaUrl(result.assetId, variantFileName) })
  }
  return result
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
  validateMediaSize(kind, bytes.byteLength)

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

  return addImageMetadataAndVariants(result, Buffer.from(bytes), mediaDir)
}

export async function storeWorkspaceMediaFromPath(
  workspacePath: string,
  input: StoreWorkspaceMediaPathInput,
): Promise<StoredWorkspaceMediaResult> {
  if (!input.sourcePath) throw new Error('Media source path is missing')
  const sourceStat = await stat(input.sourcePath)
  if (!sourceStat.isFile()) throw new Error('Media source must be a file')

  const mimeType = normalizeMediaMimeType(input.mimeType, input.name || input.sourcePath)
  const extension = MIME_EXTENSIONS[mimeType]
  if (!extension) throw new Error('Unsupported media type')
  const kind = mimeType.startsWith('video/') ? 'video' : 'image'
  validateMediaSize(kind, sourceStat.size)

  const assetId = await getFileContentAssetId(input.sourcePath)
  const mediaDir = join(workspacePath, 'media')
  await mkdir(mediaDir, { recursive: true })
  const originalFileName = `${assetId}.${extension}`
  const destinationPath = join(mediaDir, originalFileName)
  await atomicCopy(input.sourcePath, destinationPath)

  // TOCTOU 兜底：复制完成后核对大小。源文件若在 hash 与复制之间被修改，丢弃已存文件并报错，
  // 避免 media/ 内容与 assetId（按复制前内容计算）不一致。
  const storedStat = await stat(destinationPath)
  if (storedStat.size !== sourceStat.size) {
    await unlink(destinationPath).catch(() => {})
    throw new Error('Media source file changed during copy')
  }

  const result: StoredWorkspaceMediaResult = {
    assetId,
    kind,
    mimeType,
    name: basename(input.name || input.sourcePath),
    size: storedStat.size,
    url: mediaUrl(assetId, originalFileName),
    variants: [],
  }
  // 变体基于已存储的原文件生成，避免源文件在读取期间变化导致内容与 assetId 不符
  return addImageMetadataAndVariants(result, destinationPath, mediaDir)
}
