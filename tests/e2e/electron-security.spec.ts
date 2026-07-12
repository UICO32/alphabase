import { test, expect, _electron as electron } from '@playwright/test'
import { execFileSync, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, parse, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const authorizedWorkspacesFile = join(rootDirectory, '.tmp', 'electron-dev-user-data', 'authorized-workspaces.json')
const electronCloseTimeoutMs = 5_000

async function waitForProcessExit(childProcess: ChildProcess) {
  if (childProcess.exitCode !== null) return
  await new Promise<void>((resolveWait) => {
    const onExit = () => {
      clearTimeout(timer)
      resolveWait()
    }
    const timer = setTimeout(() => {
      childProcess.removeListener('exit', onExit)
      resolveWait()
    }, electronCloseTimeoutMs)
    childProcess.once('exit', onExit)
  })
}

async function closeElectronApp(electronApp: Awaited<ReturnType<typeof electron.launch>>) {
  const childProcess = electronApp.process()
  let closeTimer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      electronApp.close(),
      new Promise<never>((_resolve, reject) => {
        closeTimer = setTimeout(() => reject(new Error('Electron app close timed out')), electronCloseTimeoutMs)
      }),
    ])
  } catch {
    try {
      if (childProcess.exitCode === null) childProcess.kill()
    } catch {
      // Cleanup continues even if the process has already exited.
    }
    await waitForProcessExit(childProcess)
  } finally {
    if (closeTimer) clearTimeout(closeTimer)
  }
}

test.describe('Electron workspace security', () => {
  test.beforeAll(() => {
    const command = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'pnpm'
    const args = process.platform === 'win32'
      ? ['/d', '/s', '/c', 'pnpm electron:build']
      : ['electron:build']
    execFileSync(command, args, { cwd: rootDirectory, stdio: 'inherit' })
  })

  test('limits renderer filesystem access to main-authorized real workspace paths', async () => {
    const testRoot = mkdtempSync(join(tmpdir(), 'hepta-electron-security-'))
    const workspace = join(testRoot, 'workspace')
    const cardsDirectory = join(workspace, 'cards')
    const validFile = join(cardsDirectory, 'safe.txt')
    const secretFile = join(testRoot, 'secret.txt')
    const traversalPath = `${workspace}${sep}..${sep}secret.txt`
    const previousAuthorization = existsSync(authorizedWorkspacesFile)
      ? readFileSync(authorizedWorkspacesFile, 'utf8')
      : undefined

    let electronApp: Awaited<ReturnType<typeof electron.launch>> | undefined

    try {
      mkdirSync(cardsDirectory, { recursive: true })
      writeFileSync(secretFile, 'secret')
      mkdirSync(dirname(authorizedWorkspacesFile), { recursive: true })
      writeFileSync(authorizedWorkspacesFile, JSON.stringify([]))

      electronApp = await electron.launch({ args: ['.'], cwd: rootDirectory })
      const page = await electronApp.firstWindow()

      await expect.poll(async () => page.evaluate(() => Boolean(window.electronAPI))).toBe(true)

      const rootPath = parse(workspace).root
      const registrationCapabilities = await page.evaluate(() => {
        const workspaceApi = (window.electronAPI as unknown as {
          workspace?: { registerPath?: unknown; unregisterPath?: unknown }
        }).workspace
        return {
          registerPath: typeof workspaceApi?.registerPath,
          unregisterPath: typeof workspaceApi?.unregisterPath,
        }
      })
      expect(registrationCapabilities).toEqual({
        registerPath: 'undefined',
        unregisterPath: 'undefined',
      })

      await expect(page.evaluate(async (rootPath) => {
        return window.electronAPI.fs.readFile(rootPath)
      }, rootPath)).rejects.toThrow(/Path outside workspace/)

      await expect(page.evaluate(async (traversalPath) => {
        return window.electronAPI.fs.readFile(traversalPath)
      }, traversalPath)).rejects.toThrow(/Path outside workspace/)

      await expect(page.evaluate(async (filePath) => {
        return window.electronAPI.fs.readFile(filePath)
      }, validFile)).rejects.toThrow(/Path outside workspace/)

      await electronApp.evaluate(async ({ dialog }, workspacePath) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [workspacePath] })
      }, workspace)
      await expect(page.evaluate(() => window.electronAPI.dialog.openDirectory())).resolves.toBe(workspace)

      const content = await page.evaluate(async (filePath) => {
        await window.electronAPI.fs.writeFile(filePath, 'safe')
        return new TextDecoder().decode(await window.electronAPI.fs.readFile(filePath))
      }, validFile)
      expect(content).toBe('safe')
    } finally {
      try {
        if (electronApp) await closeElectronApp(electronApp)
      } finally {
        try {
          if (previousAuthorization === undefined) rmSync(authorizedWorkspacesFile, { force: true })
          else writeFileSync(authorizedWorkspacesFile, previousAuthorization)
        } finally {
          rmSync(testRoot, { recursive: true, force: true })
        }
      }
    }
  })
})
