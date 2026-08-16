import { test, expect, type Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

// 与其他 e2e 一致：注入测试 fs + workspace，使 React Flow 完成 viewport 初始化
//（无 fs 时 onInit 不触发，reactFlowInstance 为空，smoothWheel 无法工作，progress 恒为 0）
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
  await page.exposeFunction('__testFS_exists', async (filePath: string) => {
    return fs.existsSync(filePath.replace(/\//g, path.sep))
  })
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

async function enterDensityOverview(page: Page) {
  const flow = page.locator('.react-flow')
  const box = await flow.boundingBox()
  if (!box) throw new Error('React Flow canvas has no bounding box')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await page.mouse.wheel(0, 900)
    const progress = Number(await page.locator('.density-overview-enabled').getAttribute('data-density-overview-progress'))
    if (progress >= 0.99) break
  }
  await expect.poll(async () => Number(
    await page.locator('.density-overview-enabled').getAttribute('data-density-overview-progress'),
  )).toBeGreaterThanOrEqual(0.99)
  await expect(page.getByTestId('density-overview-layer')).toHaveAttribute('data-progress', '1.000')
}

test.beforeEach(async ({ page }) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hepta-density-'))
  await installTestFs(page, tmpDir)
  await page.goto('/')
  await page.waitForSelector('.react-flow', { timeout: 30000 })
  const workspacePicker = page.locator('.fixed.inset-0.z-50')
  if (await workspacePicker.isVisible()) {
    await workspacePicker.locator('button').first().click()
  }
  // #splash 启动画面（z-index 99999 全屏）在无 fs 注入时不会被 dismiss，
  // 会一直盖住画布吃掉滚轮/点击。直接移除。
  await page.evaluate(() => document.getElementById('splash')?.remove())
})

test('zoom reveals a board-local density field and pinned cluster drawer', async ({ page }) => {
  const errors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })

  const seeded = await page.evaluate(() => {
    const api = (window as any).heptabaseAPI
    const result = api.canvas.seedPerformanceBoard({ count: 5, columns: 3, prefix: 'density-e2e' })
    api.cards.update('density-e2e-card-0', { tags: ['alpha'] })
    api.cards.update('density-e2e-card-1', { tags: ['alpha'] })
    api.cards.update('density-e2e-card-2', { tags: ['beta'] })
    api.cards.update('density-e2e-card-3', { tags: ['beta'] })
    return result
  })
  expect(seeded.success, seeded.error).toBe(true)
  await page.waitForSelector('[data-id="density-e2e-card-0"]')

  await enterDensityOverview(page)
  await expect(page.getByTestId('density-overview-layer')).toHaveAttribute('data-group-count', '2')

  const canvasMetrics = await page.locator('.density-overview-canvas').evaluate((canvas: HTMLCanvasElement) => ({
    width: canvas.width,
    height: canvas.height,
    renderMs: Number(canvas.parentElement?.dataset.renderMs || Number.NaN),
  }))
  expect(canvasMetrics.width).toBeGreaterThan(0)
  expect(canvasMetrics.height).toBeGreaterThan(0)
  expect(canvasMetrics.renderMs).toBeGreaterThanOrEqual(0)

  const source = await page.locator('[data-id="density-e2e-card-0"]').boundingBox()
  if (!source) throw new Error('Source card is not rendered')
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await expect(page.getByRole('complementary', { name: /semantic cluster/i })).toBeVisible()
  await page.mouse.click(source.x + source.width / 2, source.y + source.height / 2)

  const drawer = page.getByRole('complementary', { name: /semantic cluster/i })
  await expect(drawer).toHaveClass(/is-pinned/)
  await expect(drawer.getByRole('button')).toHaveCount(2)
  await expect(page.locator('.density-overview-connectors path')).toHaveCount(2)

  await drawer.getByRole('button').first().click()
  await expect.poll(async () => Number(
    await page.locator('.density-overview-enabled').getAttribute('data-density-overview-progress'),
  )).toBeLessThan(0.72)
  await expect(drawer).toHaveCount(0)
  expect(errors.filter(error => !error.includes('ResizeObserver'))).toEqual([])
})

test('orphan fields stay visible without opening a semantic drawer', async ({ page }) => {
  const seeded = await page.evaluate(() => {
    const api = (window as any).heptabaseAPI
    const result = api.canvas.seedPerformanceBoard({ count: 3, columns: 3, prefix: 'density-orphan' })
    api.cards.update('density-orphan-card-0', { tags: ['paired'] })
    api.cards.update('density-orphan-card-1', { tags: ['paired'] })
    return result
  })
  expect(seeded.success, seeded.error).toBe(true)
  await page.waitForSelector('[data-id="density-orphan-card-2"]')
  await enterDensityOverview(page)

  const orphan = await page.locator('[data-id="density-orphan-card-2"]').boundingBox()
  if (!orphan) throw new Error('Orphan card is not rendered')
  await page.mouse.move(orphan.x + orphan.width / 2, orphan.y + orphan.height / 2)
  await page.waitForTimeout(180)
  await expect(page.getByRole('complementary')).toHaveCount(0)
  await expect(page.locator('.density-overview-canvas')).toBeVisible()
})
