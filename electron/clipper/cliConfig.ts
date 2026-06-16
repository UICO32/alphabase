import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { log } from './logger'

export interface AgentReachConfig {
  bili: string
  opencli: string
  ytDlp: string
  agentReach: string
  groqApiKey?: string
}

const DEFAULTS: AgentReachConfig = {
  bili: 'C:\\Users\\Administrator\\.local\\bin\\bili',
  opencli: 'C:\\Users\\Administrator\\AppData\\Roaming\\npm\\opencli',
  ytDlp: 'C:\\Users\\Administrator\\.agent-reach-venv\\Scripts\\yt-dlp.exe',
  agentReach: 'C:\\Users\\Administrator\\.agent-reach-venv\\Scripts\\agent-reach.exe',
}

let cached: AgentReachConfig | null = null

export function loadConfig(workspacePath?: string): AgentReachConfig {
  if (cached) return cached

  const configPath = process.env.HEPTA_AGENT_REACH_CONFIG
    || (workspacePath ? join(workspacePath, '.hepta', 'agent-reach.json') : undefined)

  let fileConfig: Partial<AgentReachConfig> = {}
  if (configPath && existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(readFileSync(configPath, 'utf-8'))
      log.info(`loaded agent-reach config from ${configPath}`)
    } catch (err: any) {
      log.warn(`failed to read agent-reach config: ${err.message}`)
    }
  }

  cached = { ...DEFAULTS, ...fileConfig }
  return cached
}

export function resetConfig() {
  cached = null
}
