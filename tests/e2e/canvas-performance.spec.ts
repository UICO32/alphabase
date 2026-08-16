import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

/** 注入空 workspace，使 React Flow 完成 viewport 初始化（无 fs 时 onInit 不触发，progress 恒 0） */
async function installTestFs(page: Page, tmpDir: string) {
  await page.exposeFunction('__testFS_readFile', async (filePath: string) => {
    const normalized = filePath.replace(/\//g, path.sep)
    if (!fs.existsSync(normalized)) return []
    return Array.from(fs.readFileSync(normalized))
  })
  await page.exposeFunction('__testFS_writeFile', async (filePath: string, data: string | number[]) => {
    const normalized = filePath.replace(/\//g, path.sep)
    const dir = path.dirname(normalized)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    if (Array.isArray(data)) fs.writeFileSync(normalized, Buffer.from(data))
    else fs.writeFileSync(normalized, data, 'utf-8')
  })
  await page.exposeFunction('__testFS_deleteFile', async (filePath: string) => {
    const normalized = filePath.replace(/\//g, path.sep)
    if (fs.existsSync(normalized)) fs.unlinkSync(normalized)
  })
  await page.exposeFunction('__testFS_readdir', async (dirPath: string) => {
    const normalized = dirPath.replace(/\//g, path.sep)
    if (!fs.existsSync(normalized)) return []
    return fs.readdirSync(normalized)
  })
  await page.exposeFunction('__testFS_readDirFiles', async (dirPath: string) => {
    const normalized = dirPath.replace(/\//g, path.sep)
    if (!fs.existsSync(normalized)) return null
    const files = fs.readdirSync(normalized).filter((file) => file.endsWith('.json'))
    const result: Record<string, string> = {}
    for (const file of files) result[file] = fs.readFileSync(path.join(normalized, file), 'utf-8')
    return result
  })
  await page.exposeFunction('__testFS_mkdir', async (dirPath: string) => {
    fs.mkdirSync(dirPath.replace(/\//g, path.sep), { recursive: true })
  })
  await page.exposeFunction('__testFS_stat', async (filePath: string) => {
    const stat = fs.statSync(filePath.replace(/\//g, path.sep))
    return { isDirectory: stat.isDirectory(), size: stat.size, mtimeMs: stat.mtimeMs }
  })
  await page.exposeFunction('__testFS_exists', async (filePath: string) => fs.existsSync(filePath.replace(/\//g, path.sep)))
  await page.exposeFunction('__testFS_rename', async (oldPath: string, newPath: string) => {
    const newNormalized = newPath.replace(/\//g, path.sep)
    const dir = path.dirname(newNormalized)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.renameSync(oldPath.replace(/\//g, path.sep), newNormalized)
  })
  await page.exposeFunction('__testFS_rmdir', async (dirPath: string) => {
    const normalized = dirPath.replace(/\//g, path.sep)
    if (fs.existsSync(normalized)) fs.rmSync(normalized, { recursive: true, force: true })
  })
  page.addInitScript(({ workspacePath }) => {
    localStorage.setItem('hepta-last-workspace-path', workspacePath)
    ;(window as any).electronAPI = {
      dialog: { openDirectory: async () => null },
      workspace: { registerPath: async () => undefined, unregisterPath: async () => undefined },
      startup: { log: async () => undefined, notifyProgress: () => undefined, notifyDataReady: () => undefined },
      fs: {
        readFile: async (p: string) => new Uint8Array(await (window as any).__testFS_readFile(p)),
        writeFile: async (p: string, d: Uint8Array | string) => {
          if (d instanceof Uint8Array) await (window as any).__testFS_writeFile(p, Array.from(d))
          else await (window as any).__testFS_writeFile(p, d)
        },
        deleteFile: async (p: string) => (window as any).__testFS_deleteFile(p),
        readdir: async (p: string) => (window as any).__testFS_readdir(p),
        readDirFiles: async (p: string) => (window as any).__testFS_readDirFiles(p),
        mkdir: async (p: string) => (window as any).__testFS_mkdir(p),
        stat: async (p: string) => (window as any).__testFS_stat(p),
        exists: async (p: string) => (window as any).__testFS_exists(p),
        rename: async (o: string, n: string) => (window as any).__testFS_rename(o, n),
        rmdir: async (p: string) => (window as any).__testFS_rmdir(p),
      },
    }
  }, { workspacePath: tmpDir })
}

test('canvas remains usable after startup', async ({ page }) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hepta-perf-'))
  await installTestFs(page, tmpDir)
  await page.goto('/')
  await page.waitForSelector('.react-flow', { timeout: 30000 })

  const nodeCount = await page.locator('.react-flow__node').count()
  expect(nodeCount).toBeGreaterThanOrEqual(0)

  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  await page.mouse.wheel(0, 400)
  await page.mouse.wheel(0, -400)
  await page.waitForTimeout(200)

  expect(errors.filter(error => !error.includes('ResizeObserver'))).toEqual([])
})

test.describe('canvas large-board baselines', () => {
  for (const cardCount of [1000, 5000]) {
    test(`canvas remains responsive with ${cardCount} cards`, async ({ page }) => {
      test.slow()
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hepta-perf-'))
      await installTestFs(page, tmpDir)
      await page.goto('/')
      await page.waitForSelector('.react-flow', { timeout: 30000 })

      const errors: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
      })

      const seed = await page.evaluate((count) => {
        const api = (window as any).heptabaseAPI
        return api.canvas.seedPerformanceBoard({
          count,
          columns: Math.ceil(Math.sqrt(count)),
          prefix: `e2e-perf-${count}`,
        })
      }, cardCount)

      expect(seed.success, seed.error).toBe(true)
      expect(seed.data.cardCount).toBe(cardCount)

      await page.waitForFunction(
        () => document.querySelectorAll('.react-flow__node').length > 0,
        undefined,
        { timeout: 30000 },
      )

      const interaction = await page.evaluate(async () => {
        const start = performance.now()
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        return Math.round(performance.now() - start)
      })

      await page.mouse.wheel(0, 600)
      await expect.poll(async () => Number(
        await page.locator('.density-overview-enabled').getAttribute('data-density-overview-progress'),
      )).toBeGreaterThan(0)

      const densityMetrics = await page.locator('.density-overview-layer').evaluate((layer) => ({
        spacing: Number((layer as HTMLElement).dataset.gridSpacing || Number.NaN),
        renderMs: Number((layer as HTMLElement).dataset.renderMs || Number.NaN),
        canvasWidth: (layer.querySelector('canvas') as HTMLCanvasElement | null)?.width ?? 0,
      }))
      expect(densityMetrics.canvasWidth).toBeGreaterThan(0)
      expect(densityMetrics.renderMs).toBeGreaterThanOrEqual(0)
      if (cardCount === 1000) {
        expect(densityMetrics.spacing).toBe(18)
        expect(densityMetrics.renderMs).toBeLessThan(100)
      } else {
        expect(densityMetrics.spacing).toBeGreaterThan(18)
      }

      await page.mouse.wheel(0, -600)
      await page.waitForTimeout(200)

      const visibleNodeCount = await page.locator('.react-flow__node').count()
      console.log(JSON.stringify({
        cardCount,
        seedDurationMs: seed.data.durationMs,
        twoFrameLatencyMs: interaction,
        visibleNodeCount,
        densityRenderMs: densityMetrics.renderMs,
        densityGridSpacing: densityMetrics.spacing,
      }))

      expect(visibleNodeCount).toBeGreaterThan(0)
      expect(interaction).toBeLessThan(1000)
      expect(errors.filter(error => !error.includes('ResizeObserver'))).toEqual([])
    })
  }
})
