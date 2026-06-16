import { execCli } from '../cliExecutor'
import { loadConfig } from '../cliConfig'
import { turndown } from '../turndown'
import { log } from '../logger'
import type { ClipResult } from '../types'

export async function extractXiaoyuzhou(url: string): Promise<ClipResult | null> {
  const config = loadConfig()

  let title = '播客节目'
  let podcastName = ''
  let metaHtml = ''

  // 获取页面元数据（小宇宙是 SSR，HTML 中有完整信息）
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    })
    if (response.ok) {
      metaHtml = await response.text()
      const titleMatch = metaHtml.match(/<title[^>]*>([^<]+)<\/title>/i)
      if (titleMatch) title = titleMatch[1].trim()
      const podcastMatch = metaHtml.match(/"podcast":\s*\{[^}]*"title"\s*:\s*"([^"]+)"/)
      if (podcastMatch) podcastName = podcastMatch[1]
    }
  } catch (err: any) {
    log.warn(`xiaoyuzhou meta fetch failed: ${err.message}`)
  }

  // 转录音频
  let transcript = ''
  try {
    const env: Record<string, string> = { PYTHONIOENCODING: 'utf-8' }
    if (config.groqApiKey) env.GROQ_API_KEY = config.groqApiKey

    const result = await execCli({
      command: config.agentReach,
      args: ['transcribe', url],
      timeout: 300000,
      env,
    })

    if (result.exitCode === 0 && result.stdout) {
      transcript = result.stdout.trim()
    }
  } catch (err: any) {
    if (err.code === 'CLI_TIMEOUT') {
      transcript = '（转录超时，音频较长，请稍后重试）'
    } else {
      log.warn(`xiaoyuzhou transcribe failed: ${err.message}`)
    }
  }

  const htmlParts: string[] = [`<h1>${esc(title)}</h1>`]
  if (podcastName) htmlParts.push(`<p>播客: ${esc(podcastName)}</p>`)
  if (transcript) {
    htmlParts.push('<h2>转录</h2>')
    htmlParts.push(`<p>${esc(transcript).replace(/\n/g, '<br>')}</p>`)
  }

  const html = htmlParts.join('\n')

  return {
    title,
    html,
    markdown: turndown(html),
    sourceUrl: url,
    sourceName: podcastName ? `小宇宙 · ${podcastName}` : '小宇宙',
    images: [],
    imageUrls: [],
  } as any
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
