import { writeFile, mkdir } from 'fs/promises'
import { join, extname } from 'path'
import sharp from 'sharp'
import { log } from './logger'
import type { ImageInfo } from './types'

const JPEG_QUALITY = 85
const MAX_WIDTH = 1200
const SKIP_COMPRESS_THRESHOLD = 300 * 1024 // 300KB

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeUrl(url: string): string {
  if (url.startsWith('//')) return `https:${url}`
  return url
}

function getExtFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const ext = extname(pathname).toLowerCase().replace('.', '')
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif'].includes(ext)) return ext === 'svg' ? 'svg' : ext
  } catch {}
  return 'jpg'
}

async function downloadOne(
  url: string,
  index: number,
  mediaDir: string,
  sourceUrl?: string
): Promise<ImageInfo> {
  // 图片防盗链：微信/少数派等需要 Referer
  const referer = url.includes('mmbiz.qpic.cn') || url.includes('mmbiz.qlogo.cn')
    ? 'https://mp.weixin.qq.com/'
    : sourceUrl || url
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
      Referer: referer,
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  const originalSize = buffer.length
  const ext = getExtFromUrl(url)
  const localFilename = `${Date.now()}_${String(index).padStart(2, '0')}.${ext}`
  const localPath = join(mediaDir, localFilename)

  // SVG/GIF 不压缩
  if (ext === 'svg' || ext === 'gif') {
    await writeFile(localPath, buffer)
    return { originalUrl: url, localFilename, originalSize, compressedSize: originalSize }
  }

  // 低于 300KB 跳过压缩
  if (originalSize < SKIP_COMPRESS_THRESHOLD) {
    await writeFile(localPath, buffer)
    return { originalUrl: url, localFilename, originalSize, compressedSize: originalSize }
  }

  let pipeline = sharp(buffer).resize({ width: MAX_WIDTH, withoutEnlargement: true })
  let compressed: Buffer
  if (ext === 'png') compressed = await pipeline.png({ quality: JPEG_QUALITY }).toBuffer()
  else if (ext === 'webp') compressed = await pipeline.webp({ quality: JPEG_QUALITY }).toBuffer()
  else compressed = await pipeline.jpeg({ quality: JPEG_QUALITY }).toBuffer()

  await writeFile(localPath, compressed)
  log.debug(`image compressed: ${url} → ${localFilename} (${originalSize}→${compressed.length})`)

  return { originalUrl: url, localFilename, originalSize, compressedSize: compressed.length }
}

export async function downloadImages(
  imageUrls: string[],
  workspacePath: string,
  sourceUrl?: string
): Promise<ImageInfo[]> {
  const uniqueUrls = [...new Set(imageUrls)]
    .map(normalizeUrl)
    .filter((u) => u.startsWith('http'))

  if (uniqueUrls.length === 0) return []

  const mediaDir = join(workspacePath, 'media')
  await mkdir(mediaDir, { recursive: true })

  const results: ImageInfo[] = []
  for (let i = 0; i < uniqueUrls.length; i++) {
    try {
      const info = await downloadOne(uniqueUrls[i], results.length, mediaDir, sourceUrl)
      results.push(info)
    } catch (err: any) {
      log.warn(`image download failed: ${err.message}, keeping original URL`)
    }
  }

  log.info(`images downloaded: ${results.length}/${uniqueUrls.length}`)
  return results
}

export function replaceImageUrls(html: string, markdown: string, imageInfos: ImageInfo[], workspacePath: string): { html: string; markdown: string } {
  let newHtml = html
  let newMarkdown = markdown
  for (const info of imageInfos) {
    const slashPath = workspacePath.split('\\').join('/')
    const localUrl = `hepta-media://${info.localFilename}?workspace=${encodeURIComponent(slashPath)}`
    // HTML 中 URL 的 & 可能被编码为 &amp;，需要同时替换两种形式
    newHtml = newHtml.replace(new RegExp(escapeRegExp(info.originalUrl), 'g'), localUrl)
    const ampEncoded = info.originalUrl.replace(/&/g, '&amp;')
    if (ampEncoded !== info.originalUrl) {
      newHtml = newHtml.replace(new RegExp(escapeRegExp(ampEncoded), 'g'), localUrl)
    }
    newMarkdown = newMarkdown.replace(new RegExp(escapeRegExp(info.originalUrl), 'g'), localUrl)
  }
  return { html: newHtml, markdown: newMarkdown }
}
