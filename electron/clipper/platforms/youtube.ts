import { execCli } from '../cliExecutor'
import { loadConfig } from '../cliConfig'
import { turndown } from '../turndown'
import { log } from '../logger'
import type { ClipResult } from '../types'

export async function extractYouTube(url: string): Promise<ClipResult | null> {
  const config = loadConfig()

  const result = await execCli({
    command: config.ytDlp,
    args: ['--dump-json', '--no-download', '--js-runtimes', 'node', url],
    timeout: 30000,
  })

  if (result.timedOut) {
    log.warn('yt-dlp timed out')
    return null
  }

  if (result.exitCode !== 0) {
    log.warn(`yt-dlp failed (exit ${result.exitCode}): ${result.stderr.slice(0, 200)}`)
    return null
  }

  let meta: any
  try {
    meta = JSON.parse(result.stdout)
  } catch (err: any) {
    log.warn(`yt-dlp JSON parse failed: ${err.message}`)
    return null
  }

  const title = meta.title || 'YouTube Video'
  const author = meta.uploader || meta.channel || ''
  const description = meta.description || ''
  const durationStr = meta.duration_string || ''
  const thumbnail = meta.thumbnail || ''

  let subtitleText = ''
  try {
    subtitleText = await fetchYouTubeSubtitle(meta)
  } catch (err: any) {
    log.info(`subtitle fetch skipped: ${err.message}`)
  }

  const htmlParts: string[] = [`<h1>${esc(title)}</h1>`]
  if (author) htmlParts.push(`<p>频道: ${esc(author)}</p>`)
  if (durationStr) htmlParts.push(`<p>时长: ${esc(durationStr)}</p>`)
  if (description) htmlParts.push(`<p>${esc(description).replace(/\n/g, '<br>')}</p>`)
  if (subtitleText) {
    htmlParts.push('<h2>字幕</h2>')
    htmlParts.push(`<p>${esc(subtitleText).replace(/\n/g, '<br>')}</p>`)
  }

  const html = htmlParts.join('\n')
  const imageUrls = thumbnail ? [thumbnail] : []

  return {
    title,
    html,
    markdown: turndown(html),
    sourceUrl: url,
    sourceName: author ? `YouTube · ${author}` : 'YouTube',
    images: [],
    imageUrls,
  } as any
}

async function fetchYouTubeSubtitle(meta: any): Promise<string> {
  const subtitleSources = [
    ...(meta.automatic_captions?.['zh-Hans'] || []),
    ...(meta.automatic_captions?.['zh'] || []),
    ...(meta.subtitles?.['zh-Hans'] || []),
    ...(meta.subtitles?.['en'] || []),
  ]

  const srtEntry = subtitleSources.find((s: any) => s.ext === 'srt' || s.ext === 'vtt')
  if (!srtEntry?.url) return ''

  const response = await fetch(srtEntry.url, {
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) return ''

  const raw = await response.text()
  return cleanSubtitleText(raw)
}

function cleanSubtitleText(raw: string): string {
  return raw
    .replace(/^\d+\s*\n/gm, '')
    .replace(/^\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->.*$/gm, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
