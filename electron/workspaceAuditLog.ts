import { app } from 'electron'
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const MAX_LOG_BYTES = 5 * 1024 * 1024

let auditLogPath: string | null = null

export interface WorkspaceAuditEvent {
  level?: 'info' | 'warn' | 'error'
  source: 'main' | 'renderer'
  action: string
  workspacePath?: string
  path?: string
  oldPath?: string
  newPath?: string
  caller?: string
  ok?: boolean
  details?: Record<string, unknown>
  error?: string
}

function getAuditLogPath(): string {
  if (!auditLogPath) {
    const appName = 'heptabase-canvas-v2'
    const baseDir = app.isReady()
      ? app.getPath('userData')
      : join(homedir(), 'AppData', 'Roaming', appName)
    const logDir = join(baseDir, 'logs')
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true })
    auditLogPath = join(logDir, 'workspace-audit.log')
  }
  return auditLogPath
}

function rotateIfNeeded(path: string): void {
  try {
    if (!existsSync(path)) return
    if (statSync(path).size < MAX_LOG_BYTES) return
    const rotatedPath = `${path}.1`
    if (existsSync(rotatedPath)) {
      renameSync(rotatedPath, `${path}.2`)
    }
    renameSync(path, rotatedPath)
  } catch {
    // Audit logging must never interrupt the workspace data path.
  }
}

function safeDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!details) return undefined
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === 'string' && value.length > 500) {
      result[key] = `${value.slice(0, 500)}...`
    } else {
      result[key] = value
    }
  }
  return result
}

export function auditWorkspaceEvent(event: WorkspaceAuditEvent): void {
  try {
    const path = getAuditLogPath()
    rotateIfNeeded(path)
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level: event.level ?? 'info',
      ...event,
      details: safeDetails(event.details),
    })
    appendFileSync(path, `${line}\n`, 'utf8')
  } catch {
    // Best effort only.
  }
}
