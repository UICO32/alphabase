import { ipcMain, app, BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'

const CONFIG_FILENAME = 'ai-config.json'

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

const SYSTEM_PROMPT = `你是一个卡片摘要助手。你的任务是读取卡片内容，提取核心信息，生成简洁的摘要。

严格要求：
1. 摘要必须基于原文内容，不添加原文没有的信息或评价
2. 数值必须精确，不能四舍五入或估算
3. 不遗漏关键信息，但可以省略次要细节
4. 表达流畅、逻辑清晰、无冗余
5. 必须体现因果关系和核心观点
6. 使用简体中文
7. 在关键句前用 {{ref:0}} 标记引用位置，0 表示原文第1个重要段落，依次递增。仅标记最关键的 2-3 个句子`

type SummaryFormat = 'concise' | 'list' | 'table' | 'custom'

const FORMAT_PROMPTS: Record<Exclude<SummaryFormat, 'custom'>, string> = {
  concise: `请为以下卡片内容生成摘要。提取核心观点、关键决策、量化成果和待解决问题。

卡片内容：
---
{content}
---

摘要格式：
- 核心事件（1句话）
- 关键要点（2-4条，每条不超过30字）
- 重要数据（如果有）
- 待解决问题（如果有，最多2条）

/no_think`,

  list: `请为以下卡片内容生成要点列表摘要。每条要点简洁明了。

卡片内容：
---
{content}
---

格式要求：
- 每条以 "• " 开头
- 核心事件放第一条
- 后续按重要性排列关键要点
- 量化数据用括号附在要点后
- 总共 5-8 条要点

/no_think`,

  table: `请为以下卡片内容提取关键数据，用表格格式呈现。

卡片内容：
---
{content}
---

格式要求：
- 用 Markdown 表格
- 列名：类别 | 关键信息 | 数值/细节
- 按类别分：概要、决策、数据、风险
- 如果原文没有明确数据，类别列标注"定性"

/no_think`,
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

async function callOpenAICompatibleStreaming(
  config: AIConfig,
  content: string,
  onChunk: (chunk: string) => void,
  format: SummaryFormat,
  customQuestion?: string,
): Promise<string> {
  const messages = buildMessages(content, format, customQuestion)
  const resp = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: 4096,
      chat_template_kwargs: { enable_thinking: false },
      stream: true,
    }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`API error: ${resp.status} ${text.slice(0, 200)}`)
  }

  const reader = resp.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let fullContent = ''
  let hasAnswer = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n').filter(line => line.startsWith('data: '))

    for (const line of lines) {
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue
      try {
        const parsed = JSON.parse(data)
        const choice = parsed.choices?.[0]
        if (choice) {
          const delta = choice.delta
          if (delta) {
            const thinking = delta.reasoning_content
            const text = delta.content
            if (thinking) {
              fullContent += thinking
              onChunk(thinking)
            }
            if (text) {
              fullContent += text
              hasAnswer = true
              onChunk(text)
            }
          }
          if (choice.finish_reason === 'length' && !hasAnswer) {
            throw new Error('模型 token 用尽，未生成摘要。请增大 max_tokens 或关闭推理模式。')
          }
        }
      } catch (e) {
        if (e instanceof Error && e.message.startsWith('模型 token')) throw e
      }
    }
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
      max_tokens: 4096,
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
    if (!config.apiKey) {
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
        summary = await callOpenAICompatibleStreaming(config, content, onChunk, fmt, customQuestion)
      }

      win?.webContents.send('ai:summary-complete', { summary })
      return { summary }
    } catch (err: any) {
      console.error('[ai] generateSummary failed:', err.message)
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
            'Authorization': `Bearer ${config.apiKey}`,
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
      console.error('[ai] generateClusterName failed:', err.message)
      return { name: null, error: err.message }
    }
  })
}
