import { app } from 'electron'
import { join } from 'path'
import { appendFileSync, mkdirSync, existsSync } from 'fs'
import { homedir } from 'os'

let logPath: string | null = null

function getLogPath(): string {
  if (!logPath) {
    let dir: string
    if (app.isReady()) {
      dir = join(app.getPath('userData'), 'logs')
    } else {
      // Fallback before app.ready: use standard Electron userData location
      const appName = 'heptabase-canvas-v2'
      dir = join(homedir(), 'AppData', 'Roaming', appName, 'logs')
    }
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    logPath = join(dir, 'startup.log')
  }
  return logPath
}

export function startupLog(message: string): void {
  const ts = new Date().toISOString()
  const line = `[${ts}] ${message}\n`
  try {
    appendFileSync(getLogPath(), line)
  } catch {
    // Best effort — don't crash if logging fails
  }
}
