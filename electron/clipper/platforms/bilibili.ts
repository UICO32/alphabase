import { execCli } from '../cliExecutor'
import { loadConfig } from '../cliConfig'
import { turndown } from '../turndown'
import { log } from '../logger'
import type { ClipResult } from '../types'

interface BiliVideoData {
  ok: boolean
  data: {
    video: {
      bvid: string
      title: string
      description: string
      duration: string
      url: string
      owner: { name: string }
      pic?: string
      stats: { view: number; like: number; danmaku: number; coin: number }
    }
    subtitle: {
      available: boolean
      text: string
    }
  }
}

export async function extractBilibili(url: string): Promise<ClipResult | null> {
  const bvMatch = url.match(/BV[\w]+/i)
  if (!bvMatch) {
    log.warn('bilibili: no BV ID found in URL')
    return null
  }

  const bvid = bvMatch[0]
  const config = loadConfig()

  const result = await execCli({
    command: config.bili,
    args: ['video', bvid, '--json'],
    timeout: 30000,
    env: { PYTHONIOENCODING: 'utf-8' },
  })

  if (result.timedOut || result.exitCode !== 0) {
    log.warn(`bili video failed (exit ${result.exitCode}, timedOut=${result.timedOut}): ${result.stderr.slice(0, 200)}`)
    return null
  }

  let data: BiliVideoData
  try {
    data = JSON.parse(result.stdout)
  } catch (err: any) {
    log.warn(`bili video JSON parse failed: ${err.message}`)
    return null
  }

  if (!data.ok || !data.data?.video) {
    log.warn('bili video: response not ok or missing video data')
    return null
  }

  const video = data.data.video
  const subtitle = data.data.subtitle

  const htmlParts: string[] = [`<h1>${esc(video.title)}</h1>`]
  if (video.owner?.name) htmlParts.push(`<p>UP主: ${esc(video.owner.name)}</p>`)
  if (video.duration) htmlParts.push(`<p>时长: ${esc(video.duration)}</p>`)
  if (video.description) htmlParts.push(`<p>${esc(video.description)}</p>`)

  if (subtitle?.available && subtitle.text) {
    htmlParts.push('<h2>字幕</h2>')
    htmlParts.push(`<p>${esc(subtitle.text).replace(/\n/g, '<br>')}</p>`)
  }

  const html = htmlParts.join('\n')
  const imageUrls = video.pic ? [video.pic] : []

  return {
    title: video.title,
    html,
    markdown: turndown(html),
    sourceUrl: url,
    sourceName: video.owner?.name ? `Bilibili · ${video.owner.name}` : 'Bilibili',
    images: [],
    imageUrls,
  } as any
}

export async function extractBilibiliSubtitle(bvid: string): Promise<string | null> {
  const config = loadConfig()
  if (!(await import('../cliExecutor')).cliExists(config.opencli)) return null

  try {
    const result = await execCli({
      command: config.opencli,
      args: ['bilibili', 'subtitle', bvid, '-f', 'json'],
      timeout: 30000,
    })
    if (result.exitCode === 0 && result.stdout) {
      return result.stdout
    }
  } catch { /* opencli not available */ }
  return null
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
