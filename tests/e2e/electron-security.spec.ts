import { test, expect, _electron as electron, type Page } from '@playwright/test'
import { execFileSync, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, parse, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const authorizedWorkspacesFile = join(rootDirectory, '.tmp', 'electron-dev-user-data', 'authorized-workspaces.json')
const electronCloseTimeoutMs = 5_000
const securityEventStabilityMs = 250

async function observeUnexpectedMainFrameNavigation(
  page: Page,
  originalUrl: string,
  trigger: () => Promise<unknown>,
): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let finish: ((url: string | null) => void) | undefined
  const observation = new Promise<string | null>((resolveObservation) => {
    finish = resolveObservation
    timer = setTimeout(() => resolveObservation(null), securityEventStabilityMs)
  })
  const onFrameNavigated = (frame: ReturnType<Page['mainFrame']>) => {
    if (frame === page.mainFrame() && frame.url() !== originalUrl) finish?.(frame.url())
  }
  page.on('framenavigated', onFrameNavigated)
  try {
    await trigger()
    return await observation
  } finally {
    if (timer) clearTimeout(timer)
    page.off('framenavigated', onFrameNavigated)
  }
}

async function waitForProcessExit(childProcess: ChildProcess): Promise<boolean> {
  if (childProcess.exitCode !== null) return true
  return new Promise<boolean>((resolveWait) => {
    const onExit = () => {
      clearTimeout(timer)
      resolveWait(true)
    }
    const timer = setTimeout(() => {
      childProcess.removeListener('exit', onExit)
      resolveWait(childProcess.exitCode !== null)
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
    if (!await waitForProcessExit(childProcess)) throw new Error('Electron app did not exit after close')
  } catch (closeError) {
    try {
      if (childProcess.exitCode === null && childProcess.pid !== undefined) {
        if (process.platform === 'win32') {
          execFileSync('taskkill', ['/PID', String(childProcess.pid), '/T', '/F'], { stdio: 'ignore' })
        } else {
          childProcess.kill('SIGKILL')
        }
      }
    } catch {
      // The process may have exited between the status check and forced termination.
    }
    if (!await waitForProcessExit(childProcess)) {
      throw new Error(`Electron process ${childProcess.pid ?? 'unknown'} survived forced termination`, { cause: closeError })
    }
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

  test('blocks malicious top-level navigation', async () => {
    test.setTimeout(60_000)
    const electronApp = await electron.launch({ args: ['.'], cwd: rootDirectory })
    try {
      const page = await electronApp.firstWindow()
      await expect.poll(async () => page.evaluate(() => Boolean(window.electronAPI))).toBe(true)
      const originalUrl = page.url()

      await test.step('rejects untrusted HTTP navigation', async () => {
        const unexpectedUrl = await observeUnexpectedMainFrameNavigation(page, originalUrl, () => (
          page.evaluate(() => { window.location.href = 'https://evil.example/?next=localhost' })
        ))
        expect(unexpectedUrl).toBeNull()
        expect(page.url()).toBe(originalUrl)
      })

      await test.step('rejects javascript navigation without executing it', async () => {
        const unexpectedUrl = await observeUnexpectedMainFrameNavigation(page, originalUrl, () => (
          page.evaluate(() => { window.location.href = 'javascript:globalThis.__compromised=true' })
        ))
        expect(unexpectedUrl).toBeNull()
        expect(page.url()).toBe(originalUrl)
        expect(await page.evaluate(() => '__compromised' in globalThis)).toBe(false)
      })

      await test.step('rejects the application media protocol as a top-level URL', async () => {
        const unexpectedUrl = await observeUnexpectedMainFrameNavigation(page, originalUrl, () => (
          page.evaluate(() => { window.location.href = 'hepta-media://image/card.png' })
        ))
        expect(unexpectedUrl).toBeNull()
        expect(page.url()).toBe(originalUrl)
      })

      await test.step('rejects file navigation', async () => {
        const unexpectedUrl = await observeUnexpectedMainFrameNavigation(page, originalUrl, () => (
          page.evaluate(() => { window.location.href = 'file:///C:/Windows/System32/drivers/etc/hosts' })
        ))
        expect(unexpectedUrl).toBeNull()
        expect(page.url()).toBe(originalUrl)
      })
    } finally {
      await closeElectronApp(electronApp)
    }
  })

  test('blocks malicious popups, permissions, webviews, and external URLs', async () => {
    test.setTimeout(60_000)
    const electronApp = await electron.launch({ args: ['.'], cwd: rootDirectory })
    try {
      const page = await electronApp.firstWindow()
      const criticalErrors: string[] = []
      page.on('pageerror', error => criticalErrors.push(error.message))
      page.on('console', message => {
        if (message.type() === 'error' && /content security policy|refused to (?:load|execute)/i.test(message.text())) {
          criticalErrors.push(message.text())
        }
      })
      await expect.poll(async () => page.evaluate(() => Boolean(window.electronAPI))).toBe(true)
      await expect(page.locator('#splash')).toHaveCount(0, { timeout: 5_000 })
      expect(criticalErrors).toEqual([])

      await test.step('rejects popups', async () => {
        let timer: ReturnType<typeof setTimeout> | undefined
        const newWindow = new Promise<Page | null>((resolveWindow) => {
          const onWindow = (windowPage: Page) => {
            if (timer) clearTimeout(timer)
            electronApp.off('window', onWindow)
            resolveWindow(windowPage)
          }
          electronApp.on('window', onWindow)
          timer = setTimeout(() => {
            electronApp.off('window', onWindow)
            resolveWindow(null)
          }, securityEventStabilityMs)
        })
        await page.evaluate(() => window.open('https://evil.example', '_blank'))
        expect(await newWindow).toBeNull()
        expect(electronApp.windows()).toHaveLength(1)
      })

      await test.step('denies permission requests without waiting indefinitely', async () => {
        // Product policy is deny-by-default: no renderer origin is currently trusted for media permissions.
        const permissionResult = await page.evaluate(() => Promise.race([
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then(() => 'granted', () => 'denied'),
          new Promise<string>(resolvePermission => setTimeout(() => resolvePermission('timed-out'), 2_000)),
        ]))
        expect(permissionResult).toBe('denied')
      })

      await test.step('rejects unsafe webview sources', async () => {
        const unsafeWebviewsAttached = await page.evaluate(async () => {
          const results: boolean[] = []
          for (const src of ['file:///C:/secret.txt', 'javascript:document.body.textContent="owned"']) {
            const webview = document.createElement('webview') as Electron.WebviewTag
            webview.src = src
            document.body.appendChild(webview)
            await new Promise(resolveWait => setTimeout(resolveWait, 100))
            try {
              results.push(webview.getWebContentsId() > 0)
            } catch {
              results.push(false)
            }
            webview.remove()
          }
          return results
        })
        expect(unsafeWebviewsAttached).toEqual([false, false])
      })

      await test.step('only opens safe external URLs', async () => {
        await electronApp.evaluate(({ shell }) => {
          const state = globalThis as typeof globalThis & { __openedExternalUrls?: string[] }
          state.__openedExternalUrls = []
          shell.openExternal = async (url: string) => { state.__openedExternalUrls?.push(url) }
        })
        await expect(page.evaluate(() => window.electronAPI.shell.openExternal('javascript:alert(1)')))
          .rejects.toThrow(/Invalid or disallowed URL/)
        expect(await electronApp.evaluate(() => {
          return (globalThis as typeof globalThis & { __openedExternalUrls?: string[] }).__openedExternalUrls
        })).toEqual([])
        await expect(page.evaluate(() => window.electronAPI.shell.openExternal('https://example.com/path')))
          .resolves.toBeUndefined()
        expect(await electronApp.evaluate(() => {
          return (globalThis as typeof globalThis & { __openedExternalUrls?: string[] }).__openedExternalUrls
        })).toEqual(['https://example.com/path'])
      })
    } finally {
      await closeElectronApp(electronApp)
    }
  })
})
