import { spawn } from 'child_process'
import { access } from 'fs/promises'
import { log } from './logger'

export interface CliExecOptions {
  command: string
  args: string[]
  timeout?: number
  env?: Record<string, string>
}

export interface CliExecResult {
  stdout: string
  stderr: string
  exitCode: number | null
  timedOut: boolean
}

export async function cliExists(commandPath: string): Promise<boolean> {
  try { await access(commandPath); return true } catch { return false }
}

export async function execCli(options: CliExecOptions): Promise<CliExecResult> {
  const { command, args, timeout = 60000, env = {} } = options

  if (!(await cliExists(command))) {
    throw Object.assign(new Error(`CLI tool not found: ${command}`), { code: 'CLI_NOT_FOUND' })
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', ...env },
      windowsHide: true,
      shell: false,
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      proc.kill()
    }, timeout)

    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString('utf-8') })
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString('utf-8') })

    proc.on('close', (code) => {
      clearTimeout(timer)
      resolve({ stdout, stderr, exitCode: code, timedOut })
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      reject(Object.assign(new Error(`Failed to spawn ${command}: ${err.message}`), { code: 'CLI_ERROR' }))
    })
  })
}

export function throwIfCliFailed(result: CliExecResult, platform: string): void {
  if (result.timedOut) {
    throw Object.assign(new Error(`${platform} extraction timed out`), { code: 'CLI_TIMEOUT' })
  }
  if (result.exitCode !== 0) {
    log.warn(`${platform} CLI failed (exit ${result.exitCode}): ${result.stderr.slice(0, 200)}`)
    throw Object.assign(new Error(`${platform} CLI failed: ${result.stderr.slice(0, 100) || 'unknown error'}`), { code: 'CLI_ERROR' })
  }
}
