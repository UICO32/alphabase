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

const home = process.env.USERPROFILE || process.env.HOME || ''
const appData = process.env.APPDATA || join(home, 'AppData', 'Roaming')

const DEFAULTS: AgentReachConfig = {
  bili: join(home, '.local', 'bin', 'bili'),
  opencli: join(appData, 'npm', 'opencli'),
  ytDlp: join(home, '.agent-reach-venv', 'Scripts', 'yt-dlp.exe'),
  agentReach: join(home, '.agent-reach-venv', 'Scripts', 'agent-reach.exe'),
}

const cache = new Map<string, AgentReachConfig>()

export function loadConfig(workspacePath?: string): AgentReachConfig {
  const key = workspacePath || '__default__'
  const hit = cache.get(key)
  if (hit) return hit

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

  const merged = { ...DEFAULTS, ...fileConfig }
  cache.set(key, merged)
  return merged
}

export function resetConfig() {
  cache.clear()
}
