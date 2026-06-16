import { execCli } from '../cliExecutor'
import { loadConfig } from '../cliConfig'
import { log } from '../logger'
import type { ClipResult } from '../types'

export async function extractTwitter(url: string): Promise<ClipResult | null> {
  const config = loadConfig()

  const isArticle = /\/i\/article\//.test(url) || /\/article\//.test(url)
  const isTweet = /\/status\//.test(url)

  if (!isArticle && !isTweet) {
    log.info('twitter: URL is not an article or tweet, skipping CLI')
    return null
  }

  let args: string[]
  if (isArticle) {
    args = ['twitter', 'article', url, '-f', 'json']
  } else {
    const tweetId = extractTweetId(url)
    if (!tweetId) return null
    args = ['twitter', 'thread', tweetId, '-f', 'json']
  }

  const result = await execCli({
    command: config.opencli,
    args,
    timeout: 45000,
  })

  if (result.timedOut || result.exitCode !== 0) {
    log.warn(`opencli twitter failed (exit ${result.exitCode}): ${result.stderr.slice(0, 200)}`)
    return null
  }

  let data: any
  try {
    data = JSON.parse(result.stdout)
  } catch (err: any) {
    log.warn(`opencli twitter JSON parse failed: ${err.message}`)
    return null
  }

  const title = data.title || (isArticle ? 'Twitter Article' : `Tweet by ${data.author || data.user?.name || 'Unknown'}`)
  const author = data.author || data.user?.name || ''
  const content = data.content || data.text || data.full_text || ''
  const html = markdownToSimpleHtml(content)

  const imageUrls: string[] = []
  if (data.images) imageUrls.push(...data.images)
  if (data.media) {
    for (const m of data.media) {
      if (m.type === 'photo' && m.url) imageUrls.push(m.url)
    }
  }

  return {
    title,
    html,
    markdown: content,
    sourceUrl: url,
    sourceName: author ? `Twitter · @${author}` : 'Twitter/X',
    images: [],
    imageUrls,
  } as any
}

function extractTweetId(url: string): string | null {
  const match = url.match(/\/status\/(\d+)/)
  return match ? match[1] : null
}

function markdownToSimpleHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br>')
}
