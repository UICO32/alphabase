import { ipcMain, app, BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'fs'
import { homedir } from 'os'

const CONFIG_FILENAME = 'ai-config.json'

let _aiLogPath: string | null = null
function aiLogPath(): string {
  if (!_aiLogPath) {
    const dir = app.isReady()
      ? join(app.getPath('userData'), 'logs')
      : join(homedir(), 'AppData', 'Roaming', 'heptabase-canvas-v2', 'logs')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    _aiLogPath = join(dir, 'ai.log')
  }
  return _aiLogPath
}

function aiLog(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  console.log(line.trimEnd())
  try { appendFileSync(aiLogPath(), line) } catch { /* best-effort log; ignore write failures */ }
}

interface AIConfig {
  provider: 'openai' | 'claude' | 'ollama'
  apiKey: string
  baseUrl: string
  model: string
}

const DEFAULT_CONFIG: AIConfig = {
  provider: 'openai',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
}

function getConfigPath(): string {
  return join(app.getPath('userData'), CONFIG_FILENAME)
}

function loadConfig(): AIConfig {
  const path = getConfigPath()
  if (!existsSync(path)) return DEFAULT_CONFIG
  try {
    const raw = readFileSync(path, 'utf-8')
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_CONFIG
  }
}

function getMainWindow(): BrowserWindow | null {
  return BrowserWindow.getAllWindows()[0] ?? null
}

const SYSTEM_PROMPT = `你是摘要助手。读取卡片内容，用 Markdown 格式输出简洁摘要。

规则：
1. 只基于原文，不添加评价
2. 数值精确，不估算
3. 简体中文
4. 不输出思考过程，直接给结果`

type SummaryFormat = 'concise' | 'list' | 'table' | 'custom'

const FORMAT_PROMPTS: Record<Exclude<SummaryFormat, 'custom'>, string> = {
  concise: `摘要以下卡片内容，严格按此结构输出：

### 摘要

> ⏱ 预计阅读：约X分钟（按300字/分钟估算）

（150字内概要段落，关键词用==包围==标记高亮，涵盖核心事件+关键决策+结论）

### 要点

（3-5条bullet，每条不超过30字，按重要性排列）

卡片内容：
{content}`,

  list: `摘要以下卡片内容，严格按此结构输出：

### 摘要

> ⏱ 预计阅读：约X分钟

（150字内概要段落，关键词用==包围==标记高亮）

### 要点

（5-8条bullet）

卡片内容：
{content}`,

  table: `摘要以下卡片内容，严格按此结构输出：

### 摘要

> ⏱ 预计阅读：约X分钟

（150字内概要段落，关键词用==包围==标记高亮）

### 要点

（用表格呈现，列：类别 | 关键信息 | 数值/细节）

卡片内容：
{content}`,
}

function buildMessages(content: string, format: SummaryFormat, customQuestion?: string): Array<{role: string; content: string}> {
  let userPrompt: string
  if (format === 'custom' && customQuestion) {
    userPrompt = `${customQuestion}\n\n卡片内容：\n---\n${content}\n---`
  } else {
    const template = format === 'custom' ? FORMAT_PROMPTS.concise : (FORMAT_PROMPTS[format] || FORMAT_PROMPTS.concise)
    userPrompt = template.replace('{content}', content)
  }
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]
}

async function callOpenAICompatible(
  config: AIConfig,
  content: string,
  onChunk: (chunk: string) => void,
  format: SummaryFormat,
  customQuestion?: string,
  stream: boolean = true,
): Promise<string> {
  const messages = buildMessages(content, format, customQuestion)
  const url = `${config.baseUrl}/chat/completions`
  const bodyObj: Record<string, unknown> = {
    model: config.model,
    messages,
    max_tokens: 16384,
    ...(stream ? { stream: true } : {}),
  }

  aiLog(`request: ${stream ? 'stream' : 'non-stream'} POST ${url} model=${config.model} msgs=${messages.length} contentLen=${content.length}`)

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify(bodyObj),
  })

  aiLog(`response: ${resp.status} ${resp.headers.get('content-type')}`)

  if (!resp.ok) {
    const text = await resp.text()
    aiLog(`error response: ${text.slice(0, 500)}`)
    throw new Error(`API error: ${resp.status} ${text.slice(0, 200)}`)
  }

  // Non-streaming: parse complete response
  if (!stream) {
    const data = await resp.json()
    aiLog(`non-stream keys: ${Object.keys(data).join(',')}`)
    const msg = data.choices?.[0]?.message
    const text = msg?.content
    const reasoning = msg?.reasoning_content
    if (!text && !reasoning) {
      aiLog(`non-stream: no content or reasoning, full: ${JSON.stringify(data).slice(0, 500)}`)
      throw new Error('模型返回空内容')
    }
    const result = text || reasoning!
    aiLog(`non-stream result: ${result.length} chars (from ${text ? 'content' : 'reasoning'})`)
    onChunk(result)
    return result.trim()
  }

  // Streaming: parse SSE with line buffer (TCP may split SSE events across chunks)
  const reader = resp.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let fullContent = ''
  let reasoningContent = ''
  let hasAnswer = false
  let gotFirstContent = false
  let chunkCount = 0
  let lineBuf = ''

  const FIRST_CHUNK_TIMEOUT = 10_000
  const STREAM_TIMEOUT = 90_000
  const startTime = Date.now()

  while (true) {
    const elapsed = Date.now() - startTime
    const timeout = gotFirstContent ? STREAM_TIMEOUT : FIRST_CHUNK_TIMEOUT
    if (elapsed > timeout) {
      aiLog(`stream timeout after ${elapsed}ms, gotFirstContent: ${gotFirstContent}, chunks: ${chunkCount}`)
      reader.cancel()
      if (!gotFirstContent) throw new Error('STREAM_NO_CONTENT')
      break
    }

    const readResult = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('READ_TIMEOUT')), timeout - elapsed),
      ),
    ]).catch(err => {
      if (err.message === 'READ_TIMEOUT') return { done: true, value: undefined } as const
      throw err
    })

    if (readResult.done) break
    if (!readResult.value) continue

    chunkCount++
    lineBuf += decoder.decode(readResult.value, { stream: true })

    // Split on newlines, keep the last incomplete line in lineBuf
    const lines = lineBuf.split('\n')
    lineBuf = lines.pop()!

    if (chunkCount === 1) {
      aiLog(`first chunk: lineBuf=${lineBuf.length} bytes, ${lines.length} lines, preview: ${lineBuf.slice(0, 200)}`)
    }

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) continue

      const data = trimmed.slice(6).trim()
      if (data === '[DONE]') {
        aiLog(`[DONE] after ${chunkCount} chunks, content: ${fullContent.length} chars`)
        continue
      }
      try {
        const parsed = JSON.parse(data)
        const choice = parsed.choices?.[0]
        if (choice) {
          const delta = choice.delta
          if (delta) {
            const reasoning = delta.reasoning_content
            const text = delta.content
            if (reasoning) {
              reasoningContent += reasoning
              gotFirstContent = true
            }
            if (text) {
              fullContent += text
              gotFirstContent = true
              hasAnswer = true
              onChunk(text)
            }
          }
          if (choice.finish_reason === 'length' && !fullContent && !reasoningContent) {
            throw new Error('模型 token 用尽，未生成摘要。请增大 max_tokens 或关闭推理模式。')
          }
        }
      } catch (e) {
        if (e instanceof Error && e.message.startsWith('模型 token')) throw e
        aiLog(`SSE parse error: ${(e as Error).message}, data: ${data.slice(0, 100)}`)
      }
    }
  }

  aiLog(`stream ended: ${chunkCount} chunks, content: ${fullContent.length} chars, reasoning: ${reasoningContent.length} chars, hasAnswer: ${hasAnswer}`)

  // If model only produced reasoning (thinking) but no formal content, strip <think> tags and use as result
  if (!fullContent && reasoningContent) {
    aiLog(`no content but has reasoning (${reasoningContent.length} chars), using reasoning as summary`)
    onChunk(reasoningContent)
    return reasoningContent.trim()
  }

  // Stream ended but no content parsed at all
  if (!fullContent) {
    throw new Error('STREAM_NO_CONTENT')
  }

  return fullContent.trim()
}

async function callClaudeStreaming(
  config: AIConfig,
  content: string,
  onChunk: (chunk: string) => void,
  format: SummaryFormat,
  customQuestion?: string,
): Promise<string> {
  const messages = buildMessages(content, format, customQuestion)
  const systemMsg = messages.find(m => m.role === 'system')!
  const userMessages = messages.filter(m => m.role !== 'system')

  const resp = await fetch(`${config.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 16384,
      system: systemMsg.content,
      messages: userMessages,
      stream: true,
    }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Claude API error: ${resp.status} ${text.slice(0, 200)}`)
  }

  const reader = resp.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let fullContent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n').filter(line => line.startsWith('data: '))

    for (const line of lines) {
      const data = line.slice(6).trim()
      try {
        const parsed = JSON.parse(data)
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          fullContent += parsed.delta.text
          onChunk(parsed.delta.text)
        }
      } catch {
        // Skip
      }
    }
  }

  return fullContent.trim()
}

let registered = false

export function registerAISummaryIPC(): void {
  if (registered) return
  registered = true

  ipcMain.handle('ai:generateSummary', async (_event, content: string, format?: string, customQuestion?: string) => {
    const config = loadConfig()
    aiLog(`generateSummary: provider=${config.provider} model=${config.model} baseUrl=${config.baseUrl} hasKey=${!!config.apiKey} contentLen=${content.length} format=${format}`)

    if (!config.apiKey && config.provider !== 'ollama') {
      const win = getMainWindow()
      win?.webContents.send('ai:summary-error', { message: '请先在设置中配置 AI API Key' })
      return { error: 'API key not configured' }
    }

    const fmt: SummaryFormat = (format as SummaryFormat) || 'concise'
    const win = getMainWindow()

    try {
      const onChunk = (chunk: string) => {
        win?.webContents.send('ai:summary-chunk', { chunk })
      }

      let summary: string
      if (config.provider === 'claude') {
        summary = await callClaudeStreaming(config, content, onChunk, fmt, customQuestion)
      } else {
        try {
          summary = await callOpenAICompatible(config, content, onChunk, fmt, customQuestion, true)
        } catch (err: any) {
          if (err.message === 'STREAM_NO_CONTENT') {
            aiLog('stream failed → fallback to non-stream')
            summary = await callOpenAICompatible(config, content, onChunk, fmt, customQuestion, false)
          } else {
            throw err
          }
        }
      }

      aiLog(`summary complete: ${summary.length} chars`)
      win?.webContents.send('ai:summary-complete', { summary })
      return { summary }
    } catch (err: any) {
      aiLog(`generateSummary FAILED: ${err.message}`)
      win?.webContents.send('ai:summary-error', { message: err.message })
      return { error: err.message }
    }
  })

  ipcMain.handle('ai:getConfig', async () => {
    const config = loadConfig()
    return {
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl,
      configured: !!config.apiKey,
    }
  })

  ipcMain.handle('ai:testConnection', async () => {
    const config = loadConfig()
    if (!config.apiKey && config.provider !== 'ollama') {
      return { success: false, error: 'API Key 未配置' }
    }

    try {
      const testMessages = [
        { role: 'user', content: 'Hi' },
      ]

      if (config.provider === 'claude') {
        const resp = await fetch(`${config.baseUrl}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: 5,
            messages: testMessages,
          }),
        })
        if (!resp.ok) {
          const text = await resp.text()
          return { success: false, error: `HTTP ${resp.status}: ${text.slice(0, 150)}` }
        }
        return { success: true }
      }

      // OpenAI compatible (includes Ollama)
      const resp = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: config.model,
          messages: testMessages,
          max_tokens: 5,
        }),
      })
      if (!resp.ok) {
        const text = await resp.text()
        return { success: false, error: `HTTP ${resp.status}: ${text.slice(0, 150)}` }
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('ai:setConfig', async (_event, newConfig: Partial<AIConfig>) => {
    const config = { ...loadConfig(), ...newConfig }
    writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8')
    return { success: true }
  })

  // Generate a short cluster name from card titles using LLM
  ipcMain.handle('ai:generateClusterName', async (_event, titles: string[]) => {
    const config = loadConfig()
    if (!config.apiKey && config.provider !== 'ollama') {
      return { name: null, error: 'API key not configured' }
    }

    const prompt = `以下是一组相关卡片的标题，请为这组卡片生成一个简洁的中文主题名称（2-6个字），直接返回名称，不要解释。

卡片标题：
${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

主题名称：`

    try {
      let name: string
      if (config.provider === 'claude') {
        const resp = await fetch(`${config.baseUrl}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: 20,
            messages: [{ role: 'user', content: prompt }],
          }),
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json()
        name = data.content?.[0]?.text?.trim() || ''
      } else {
        const resp = await fetch(`${config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: config.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 20,
          }),
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json()
        name = data.choices?.[0]?.message?.content?.trim() || ''
      }

      // Clean up: remove quotes, numbering, extra text
      name = name.replace(/^["'"]+|["'"]+$/g, '').replace(/^\d+\.\s*/, '').trim()
      if (name.length > 20) name = name.slice(0, 20)
      return { name: name || null }
    } catch (err: any) {
      aiLog(`generateClusterName FAILED: ${err.message}`)
      return { name: null, error: err.message }
    }
  })
}
