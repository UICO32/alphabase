import { useState, useEffect } from 'react'
import { Button } from '../shadcn/button'
import { Input } from '../shadcn/input'
import { SettingGroup, SettingRow, FieldLabel } from './SettingPrimitives'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../shadcn/select'

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string; label: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', label: 'OpenAI' },
  claude: { baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-20250514', label: 'Claude' },
  ollama: { baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5:2b', label: 'Ollama' },
}

type Provider = keyof typeof PROVIDER_DEFAULTS

export function AISettings() {
  const [provider, setProvider] = useState<Provider>('openai')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState(PROVIDER_DEFAULTS.openai.baseUrl)
  const [model, setModel] = useState(PROVIDER_DEFAULTS.openai.model)
  const [configured, setConfigured] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)

  useEffect(() => { loadConfig() }, [])

  async function loadConfig() {
    const electronAPI = (window as any).electronAPI
    if (!electronAPI?.ai?.getConfig) { setLoading(false); return }
    try {
      const config = await electronAPI.ai.getConfig()
      setProvider(config.provider || 'openai')
      setBaseUrl(config.baseUrl || PROVIDER_DEFAULTS[config.provider]?.baseUrl || '')
      setModel(config.model || PROVIDER_DEFAULTS[config.provider]?.model || '')
      setConfigured(config.configured || false)
    } catch { /* ignore */ }
    setLoading(false)
  }

  function handleProviderChange(newProvider: string) {
    const p = newProvider as Provider
    setProvider(p)
    setBaseUrl(PROVIDER_DEFAULTS[p].baseUrl)
    setModel(PROVIDER_DEFAULTS[p].model)
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true); setSaved(false); setTestResult(null)
    const electronAPI = (window as any).electronAPI
    if (!electronAPI?.ai?.setConfig) { setSaving(false); return }
    await electronAPI.ai.setConfig({ provider, apiKey, baseUrl, model })
    setConfigured(!!apiKey || configured)
    setSaving(false); setSaved(true)
  }

  async function handleTest() {
    setTesting(true); setTestResult(null)
    const electronAPI = (window as any).electronAPI
    if (!electronAPI?.ai?.testConnection) {
      setTestResult({ success: false, error: 'AI 功能不可用' })
      setTesting(false); return
    }
    const result = await electronAPI.ai.testConnection()
    setTestResult(result); setTesting(false)
  }

  if (loading) return null

  return (
    <>
      <SettingGroup title="AI 摘要设置">
        <SettingRow label="提供商">
          <Select value={provider} onValueChange={handleProviderChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PROVIDER_DEFAULTS).map(([key, val]) => (
                <SelectItem key={key} value={key}>{val.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <div className="py-2.5">
          <FieldLabel>API Key</FieldLabel>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); setSaved(false) }}
            placeholder={configured ? '已配置（留空保持不变）' : '输入 API Key'}
          />
        </div>
        <div className="py-2.5">
          <FieldLabel>Base URL</FieldLabel>
          <Input
            type="text"
            value={baseUrl}
            onChange={(e) => { setBaseUrl(e.target.value); setSaved(false) }}
            className="font-mono"
          />
        </div>
        <div className="py-2.5">
          <FieldLabel>模型</FieldLabel>
          <Input
            type="text"
            value={model}
            onChange={(e) => { setModel(e.target.value); setSaved(false) }}
            className="font-mono"
          />
        </div>
        <div className="py-2.5 flex gap-2">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? '保存中...' : saved ? '已保存' : '保存'}
          </Button>
          <Button onClick={handleTest} disabled={testing || !configured} variant="secondary" className="flex-1">
            {testing ? '检测中...' : '测试连接'}
          </Button>
        </div>
        {testResult && (
          <div
            className="py-2.5 text-sm"
            style={{
              color: testResult.success ? 'var(--color-green-600)' : 'var(--color-red-600)',
            }}
          >
            {testResult.success ? '连接成功' : `连接失败：${testResult.error}`}
          </div>
        )}
      </SettingGroup>

      <SettingGroup title="使用说明">
        <div className="space-y-2 text-xs text-fg-secondary py-2.5">
          <p>悬停卡片右上角出现 ✦ 图标，点击即可生成 AI 摘要。</p>
          <p>• OpenAI：支持 GPT-4o-mini、GPT-4o 等模型</p>
          <p>• Claude：支持 Claude Sonnet、Haiku 等模型</p>
          <p>• Ollama：本地部署模型，无需 API Key</p>
          <p>• 也可填入兼容 OpenAI API 格式的第三方服务地址</p>
        </div>
      </SettingGroup>
    </>
  )
}
