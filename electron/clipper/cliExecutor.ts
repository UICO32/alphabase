import { spawn, execFile } from 'child_process'
import { access } from 'fs/promises'

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

const execFileAsync = (cmd: string, args: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    execFile(cmd, args, (err) => err ? reject(err) : resolve())
  })

export async function cliExists(commandPath: string): Promise<boolean> {
  // 带路径分隔符视为文件路径，直接检查
  if (commandPath.includes('/') || commandPath.includes('\\')) {
    try { await access(commandPath); return true } catch { return false }
  }
  // 裸命令名：在 PATH 中查找 (which / where)
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    await execFileAsync(cmd, [commandPath])
    return true
  } catch {
    return false
  }
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
