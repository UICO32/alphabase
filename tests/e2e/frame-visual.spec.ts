import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

function createTmpWorkspace(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hepta-frame-test-'))
  return tmpDir
}

function cleanupTmpWorkspace(tmpDir: string) {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

test.describe('Frame 视觉与交互截图测试', () => {
  let tmpDir: string

  test.beforeEach(async ({ page }) => {
    tmpDir = createTmpWorkspace()

    await page.exposeFunction('__testFS_readFile', async (filePath: string) => {
      const normalized = filePath.replace(/\//g, path.sep)
      if (!fs.existsSync(normalized)) return []
      const buf = fs.readFileSync(normalized)
      return Array.from(buf)
    })

    await page.exposeFunction('__testFS_writeFile', async (filePath: string, data: string | number[]) => {
      const normalized = filePath.replace(/\//g, path.sep)
      const dir = path.dirname(normalized)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      if (Array.isArray(data)) {
        fs.writeFileSync(normalized, Buffer.from(data))
      } else {
        fs.writeFileSync(normalized, data, 'utf-8')
      }
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

    await page.exposeFunction('__testFS_mkdir', async (dirPath: string) => {
      const normalized = dirPath.replace(/\//g, path.sep)
      fs.mkdirSync(normalized, { recursive: true })
    })

    await page.exposeFunction('__testFS_stat', async (filePath: string) => {
      const normalized = filePath.replace(/\//g, path.sep)
      const stat = fs.statSync(normalized)
      return { isDirectory: stat.isDirectory(), size: stat.size, mtimeMs: stat.mtimeMs }
    })

    await page.exposeFunction('__testFS_exists', async (filePath: string) => {
      const normalized = filePath.replace(/\//g, path.sep)
      return fs.existsSync(normalized)
    })

    await page.exposeFunction('__testFS_rename', async (oldPath: string, newPath: string) => {
      const oldN = oldPath.replace(/\//g, path.sep)
      const newN = newPath.replace(/\//g, path.sep)
      const dir = path.dirname(newN)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.renameSync(oldN, newN)
    })

    await page.exposeFunction('__testFS_rmdir', async (dirPath: string) => {
      const normalized = dirPath.replace(/\//g, path.sep)
      if (fs.existsSync(normalized)) fs.rmSync(normalized, { recursive: true, force: true })
    })

    page.addInitScript(({ tmpDir }) => {
      localStorage.setItem('hepta-last-workspace-path', tmpDir)
      ;(window as any).electronAPI = {
        dialog: { openDirectory: async () => null },
        fs: {
          readFile: async (p: string) => {
            const arr = await (window as any).__testFS_readFile(p)
            return new Uint8Array(arr)
          },
          writeFile: async (p: string, d: Uint8Array | string) => {
            if (d instanceof Uint8Array) {
              await (window as any).__testFS_writeFile(p, Array.from(d))
            } else {
              await (window as any).__testFS_writeFile(p, d)
            }
          },
          deleteFile: async (p: string) => (window as any).__testFS_deleteFile(p),
          readdir: async (p: string) => (window as any).__testFS_readdir(p),
          mkdir: async (p: string) => (window as any).__testFS_mkdir(p),
          stat: async (p: string) => (window as any).__testFS_stat(p),
          exists: async (p: string) => (window as any).__testFS_exists(p),
          rename: async (o: string, n: string) => (window as any).__testFS_rename(o, n),
          rmdir: async (p: string) => (window as any).__testFS_rmdir(p),
        },
      }
    }, { tmpDir })
  })

  test.afterEach(() => {
    cleanupTmpWorkspace(tmpDir)
  })

  test('frame 标签位置与缩放正确性', async ({ page }) => {
    // 1. 打开应用，等待 React Flow 加载
    await page.goto('/')
    await page.waitForSelector('main', { timeout: 15000 })
    await page.waitForTimeout(3000)

    // 2. Use the public UI contract instead of relying on a private React Flow
    // instance on window (the application deliberately does not expose one).
    const addCard = page.getByRole('button', { name: '添加卡片' })
    const cardNodes = page.locator('.react-flow__node')
    const initialCardCount = await cardNodes.count()
    for (let i = 0; i < 3; i++) await addCard.click()

    // 确认卡片已创建
    await expect(cardNodes).toHaveCount(initialCardCount + 3)

    // 3. 进入框选模式
    const frameTool = page.getByRole('button', { name: '框选创建 Frame' })
    await frameTool.click()
    await expect(frameTool).toHaveAttribute('aria-pressed', 'true')

    // 4. 用鼠标拖拽框选所有卡片
    const pane = page.locator('.react-flow__pane')
    const box = await pane.boundingBox()
    if (!box) throw new Error('Canvas pane not found')

    const startX = box.x + 50
    const startY = box.y + 50
    const endX = box.x + box.width - 50
    const endY = box.y + box.height - 50

    await page.evaluate(({ x, y }) => {
      window.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: x, clientY: y }))
    }, { x: startX, y: startY })
    await page.waitForTimeout(100)
    await page.evaluate(({ x, y }) => {
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, button: 0, clientX: x, clientY: y }))
    }, { x: endX, y: endY })
    await page.waitForTimeout(100)
    await page.evaluate(({ x, y }) => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0, clientX: x, clientY: y }))
    }, { x: endX, y: endY })

    // 5. 等待 frame 创建完成
    const frameNode = page.locator('.react-flow__node-frame')
    await expect(frameNode.first()).toBeVisible({ timeout: 8000 })
    await page.waitForTimeout(500)

    // 6. 截图：默认缩放级别
    await page.screenshot({ path: 'test-results/frame-default-zoom.png', fullPage: false })

    // 7. 放大截图
    await page.getByRole('button', { name: '放大' }).click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: 'test-results/frame-zoom-in.png', fullPage: false })

    // 8. 再放大一次
    await page.getByRole('button', { name: '放大' }).click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: 'test-results/frame-zoom-in-2x.png', fullPage: false })

    // 9. 缩小截图
    await page.getByRole('button', { name: '缩小' }).click()
    await page.getByRole('button', { name: '缩小' }).click()
    await page.getByRole('button', { name: '缩小' }).click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: 'test-results/frame-zoom-out.png', fullPage: false })

    // 10. Fit view 截图
    await page.getByRole('button', { name: '适应视图' }).click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: 'test-results/frame-fit-view.png', fullPage: false })
  })
})
