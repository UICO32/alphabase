import { useState, useEffect } from 'react'

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
  const [testResult, setTestResult] = useState<{success: boolean; error?: string} | null>(null)

  useEffect(() => {
    loadConfig()
  }, [])

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

  function handleProviderChange(newProvider: Provider) {
    setProvider(newProvider)
    setBaseUrl(PROVIDER_DEFAULTS[newProvider].baseUrl)
    setModel(PROVIDER_DEFAULTS[newProvider].model)
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setTestResult(null)
    const electronAPI = (window as any).electronAPI
    if (!electronAPI?.ai?.setConfig) { setSaving(false); return }
    await electronAPI.ai.setConfig({ provider, apiKey, baseUrl, model })
    setConfigured(!!apiKey || configured)
    setSaving(false)
    setSaved(true)
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    const electronAPI = (window as any).electronAPI
    if (!electronAPI?.ai?.testConnection) {
      setTestResult({ success: false, error: 'AI 功能不可用' })
      setTesting(false)
      return
    }
    const result = await electronAPI.ai.testConnection()
    setTestResult(result)
    setTesting(false)
  }

  if (loading) return null

  return (
    <>
      <div className="mb-8">
        <h3 className="text-sm font-medium mb-4 text-text-primary">
          AI 摘要设置
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs mb-1 block text-text-secondary">提供商</label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as Provider)}
              className="w-full p-3 rounded-lg text-sm bg-surface-panel-hover text-text-primary border-none outline-none"
            >
              {Object.entries(PROVIDER_DEFAULTS).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs mb-1 block text-text-secondary">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setSaved(false) }}
              placeholder={configured ? '已配置（留空保持不变）' : '输入 API Key'}
              className="w-full p-3 rounded-lg text-sm bg-surface-panel-hover text-text-primary border-none outline-none"
            />
          </div>

          <div>
            <label className="text-xs mb-1 block text-text-secondary">Base URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => { setBaseUrl(e.target.value); setSaved(false) }}
              className="w-full p-3 rounded-lg text-sm bg-surface-panel-hover text-text-primary border-none outline-none font-mono"
            />
          </div>

          <div>
            <label className="text-xs mb-1 block text-text-secondary">模型</label>
            <input
              type="text"
              value={model}
              onChange={(e) => { setModel(e.target.value); setSaved(false) }}
              className="w-full p-3 rounded-lg text-sm bg-surface-panel-hover text-text-primary border-none outline-none font-mono"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 p-3 rounded-lg text-sm bg-text-primary text-text-inverse hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? '保存中...' : saved ? '已保存' : '保存'}
            </button>
            <button
              onClick={handleTest}
              disabled={testing || !configured}
              className="flex-1 flex items-center justify-center gap-2 p-3 rounded-lg text-sm bg-surface-panel-hover text-text-primary hover:bg-surface-card-active transition-colors disabled:opacity-50"
            >
              {testing ? '检测中...' : '测试连接'}
            </button>
          </div>

          {testResult && (
            <div
              className="p-3 rounded-lg text-sm"
              style={{
                backgroundColor: testResult.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                color: testResult.success ? '#16a34a' : '#dc2626',
              }}
            >
              {testResult.success ? '连接成功' : `连接失败：${testResult.error}`}
            </div>
          )}
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-medium mb-4 text-text-primary">
          使用说明
        </h3>
        <div className="space-y-2 text-xs text-text-secondary">
          <p>悬停卡片右上角出现 ✦ 图标，点击即可生成 AI 摘要。</p>
          <p>• OpenAI：支持 GPT-4o-mini、GPT-4o 等模型</p>
          <p>• Claude：支持 Claude Sonnet、Haiku 等模型</p>
          <p>• Ollama：本地部署模型，无需 API Key</p>
          <p>• 也可填入兼容 OpenAI API 格式的第三方服务地址</p>
        </div>
      </div>
    </>
  )
}
