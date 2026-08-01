import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

const DEV_URL = 'http://localhost:5173'

function createTmpWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hepta-checkbox-'))
}

function cleanupTmpWorkspace(tmpDir: string) {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

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
    const oldNormalized = oldPath.replace(/\//g, path.sep)
    const newNormalized = newPath.replace(/\//g, path.sep)
    const dir = path.dirname(newNormalized)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.renameSync(oldNormalized, newNormalized)
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
      startup: {
        log: async () => undefined,
        notifyProgress: () => undefined,
        notifyDataReady: () => undefined,
      },
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

function seedWorkspace(tmpDir: string) {
  fs.mkdirSync(path.join(tmpDir, 'boards'), { recursive: true })
  fs.mkdirSync(path.join(tmpDir, 'cards'), { recursive: true })

  const boardId = 'board-default'
  const cardId = 'card-check-1'
  const content = JSON.stringify([
    {
      type: 'checkListItem',
      props: { checked: false, textAlignment: 'left', backgroundColor: 'default' },
      content: [{ type: 'text', text: '待办事项', styles: {} }],
    },
  ])

  fs.writeFileSync(
    path.join(tmpDir, 'boards', '_manifest.json'),
    JSON.stringify({ boards: [{ id: boardId, name: 'Checkbox Board', createdAt: Date.now(), updatedAt: Date.now() }] }, null, 2),
    'utf-8',
  )
  fs.writeFileSync(
    path.join(tmpDir, 'boards', `${boardId}.json`),
    JSON.stringify({
      version: 2,
      nodes: [{ id: cardId, type: 'card', position: { x: 700, y: 200 }, data: { cardId, color: 'white', width: 280, height: 200 }, width: 280, height: 200 }],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    }, null, 2),
    'utf-8',
  )
  fs.writeFileSync(
    path.join(tmpDir, 'cards', `${cardId}.json`),
    JSON.stringify({ id: cardId, title: '', color: 'white', createdAt: Date.now(), content }, null, 2),
    'utf-8',
  )
}

async function waitForCanvas(page: Page) {
  const modalClose = page.locator('.modal-backdrop button, [aria-label="Close"], .dialog-close, button:has-text("确定"), button:has-text("OK")')
  try {
    await modalClose.first().click({ timeout: 2000 })
  } catch { /* no modal */ }
  await page.waitForSelector('.react-flow__node')
  await page.waitForTimeout(500)
}

test.describe('Checkbox 单击切换', () => {
  let tmpDir: string

  test.beforeEach(async ({ page }) => {
    tmpDir = createTmpWorkspace()
    seedWorkspace(tmpDir)
    await installTestFs(page, tmpDir)
    await page.goto(DEV_URL)
    await waitForCanvas(page)
  })

  test.afterEach(() => {
    cleanupTmpWorkspace(tmpDir)
  })

  test('单击一次即切换 checked 且编辑器不退出', async ({ page }) => {
    const node = page.locator('.react-flow__node[data-id="card-check-1"]')
    await node.click()
    await page.waitForSelector('.card-blocknote-editor--editable input[type="checkbox"]', { timeout: 8000 })

    const checkbox = page.locator('.card-blocknote-editor--editable input[type="checkbox"]')
    await expect(checkbox).not.toBeChecked()

    // 单击一次（真实鼠标序列）
    await checkbox.click({ position: { x: 6, y: 6 } })
    await page.waitForTimeout(300)

    // 一次点击后应已勾选
    await expect(checkbox).toBeChecked()

    // 编辑器不应退出编辑态（焦点被保持，node view 重建不触发 onBlur）
    await expect(page.locator('.card-blocknote-editor--editable')).toBeVisible()

    // 再点击一次应切回未勾选（确认可连续切换）
    await checkbox.click({ position: { x: 6, y: 6 } })
    await page.waitForTimeout(300)
    await expect(checkbox).not.toBeChecked()
    await expect(page.locator('.card-blocknote-editor--editable')).toBeVisible()
  })
})
