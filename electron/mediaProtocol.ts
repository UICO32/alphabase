import { createReadStream } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { protocol } from 'electron'
import {
  getRegisteredWorkspacePaths,
  isMediaFilenameSafe,
  isRegisteredWorkspaceRoot,
} from './workspacePaths'

export interface ByteRange {
  start: number
  end: number
}

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  bmp: 'image/bmp',
  mp4: 'video/mp4',
  webm: 'video/webm',
}

export function mediaMimeType(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase() || ''
  return MIME_BY_EXTENSION[extension] || 'application/octet-stream'
}

export function parseByteRange(value: string | null, size: number): ByteRange | null | 'invalid' {
  if (!value) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim())
  if (!match || size <= 0) return 'invalid'

  const [, rawStart, rawEnd] = match
  if (!rawStart && !rawEnd) return 'invalid'

  if (!rawStart) {
    const suffixLength = Number(rawEnd)
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return 'invalid'
    return { start: Math.max(0, size - suffixLength), end: size - 1 }
  }

  const start = Number(rawStart)
  const requestedEnd = rawEnd ? Number(rawEnd) : size - 1
  if (
    !Number.isSafeInteger(start)
    || !Number.isSafeInteger(requestedEnd)
    || start < 0
    || requestedEnd < start
    || start >= size
  ) return 'invalid'

  return { start, end: Math.min(requestedEnd, size - 1) }
}

async function resolveMediaPath(filename: string, requestedWorkspacePath: string): Promise<string | null> {
  if (!isMediaFilenameSafe(filename)) return null
  if (requestedWorkspacePath && !isRegisteredWorkspaceRoot(requestedWorkspacePath)) return null

  const candidateWorkspaces = requestedWorkspacePath
    ? [requestedWorkspacePath]
    : getRegisteredWorkspacePaths()

  for (const workspacePath of candidateWorkspaces) {
    const resolvedMediaDir = resolve(join(workspacePath, 'media'))
    const candidate = resolve(join(resolvedMediaDir, filename))
    if (!candidate.startsWith(`${resolvedMediaDir}/`) && !candidate.startsWith(`${resolvedMediaDir}\\`)) continue
    try {
      await access(candidate)
      return candidate
    } catch {
      // Try the next authorized workspace.
    }
  }
  return null
}

function streamBody(path: string, range?: ByteRange): BodyInit {
  const source = range
    ? createReadStream(path, { start: range.start, end: range.end })
    : createReadStream(path)
  return Readable.toWeb(source) as unknown as BodyInit
}

export function registerMediaProtocol(): void {
  protocol.handle('hepta-media', async (request) => {
    try {
      const url = new URL(request.url)
      const filename = decodeURIComponent(url.pathname.replace(/^\/+/, '') || url.hostname)
      const requestedWorkspacePath = (url.searchParams.get('workspace') || '').split('/').join('\\')
      if (!isMediaFilenameSafe(filename)) return new Response('Forbidden', { status: 403 })

      const resolvedFilePath = await resolveMediaPath(filename, requestedWorkspacePath)
      if (!resolvedFilePath) return new Response('Not found', { status: 404 })

      const fileStat = await stat(resolvedFilePath)
      if (!fileStat.isFile()) return new Response('Not found', { status: 404 })

      const range = parseByteRange(request.headers.get('range'), fileStat.size)
      const commonHeaders = {
        'accept-ranges': 'bytes',
        'cache-control': 'public, max-age=31536000, immutable',
        'content-type': mediaMimeType(filename),
      }
      if (range === 'invalid') {
        return new Response(null, {
          status: 416,
          headers: { ...commonHeaders, 'content-range': `bytes */${fileStat.size}` },
        })
      }

      if (range) {
        const contentLength = range.end - range.start + 1
        return new Response(request.method === 'HEAD' ? null : streamBody(resolvedFilePath, range), {
          status: 206,
          headers: {
            ...commonHeaders,
            'content-length': String(contentLength),
            'content-range': `bytes ${range.start}-${range.end}/${fileStat.size}`,
          },
        })
      }

      return new Response(request.method === 'HEAD' ? null : streamBody(resolvedFilePath), {
        status: 200,
        headers: { ...commonHeaders, 'content-length': String(fileStat.size) },
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}
