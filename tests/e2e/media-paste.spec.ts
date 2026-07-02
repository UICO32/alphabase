import { expect, test } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

function createTmpWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hepta-media-paste-'))
}

function cleanupTmpWorkspace(tmpDir: string) {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

async function installTestFs(page: Parameters<typeof test>[0]['page'], tmpDir: string) {
  await page.exposeFunction('__testFS_readFile', async (filePath: string) => {
    const normalized = filePath.replace(/\//g, path.sep)
    if (!fs.existsSync(normalized)) return []
    return Array.from(fs.readFileSync(normalized))
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

  await page.exposeFunction('__testFS_readDirFiles', async (dirPath: string) => {
    const normalized = dirPath.replace(/\//g, path.sep)
    if (!fs.existsSync(normalized)) return null
    const files = fs.readdirSync(normalized).filter((file) => file.endsWith('.json'))
    const result: Record<string, string> = {}
    for (const file of files) {
      result[file] = fs.readFileSync(path.join(normalized, file), 'utf-8')
    }
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
      workspace: {
        registerPath: async () => undefined,
        unregisterPath: async () => undefined,
      },
      startup: {
        log: async () => undefined,
        notifyProgress: () => undefined,
        notifyDataReady: () => undefined,
      },
      fs: {
        readFile: async (p: string) => new Uint8Array(await (window as any).__testFS_readFile(p)),
        writeFile: async (p: string, d: Uint8Array | string) => {
          if (d instanceof Uint8Array) {
            await (window as any).__testFS_writeFile(p, Array.from(d))
          } else {
            await (window as any).__testFS_writeFile(p, d)
          }
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

  const cardId = 'card-media-test'
  fs.writeFileSync(
    path.join(tmpDir, 'boards', '_manifest.json'),
    JSON.stringify({
      boards: [
        {
          id: 'board-default',
          name: 'Default Board',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    }, null, 2),
    'utf-8',
  )

  fs.writeFileSync(
    path.join(tmpDir, 'boards', 'board-default.json'),
    JSON.stringify({
      version: 2,
      nodes: [
        {
          id: 'node-media-test',
          type: 'card',
          position: { x: 480, y: 140 },
          data: { cardId, color: 'blue', width: 280, height: 200 },
          width: 280,
          height: 200,
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    }, null, 2),
    'utf-8',
  )

  fs.writeFileSync(
    path.join(tmpDir, 'cards', `${cardId}.json`),
    JSON.stringify({
      id: cardId,
      title: 'Media Paste Card',
      color: 'blue',
      createdAt: Date.now(),
      content: JSON.stringify([{ type: 'paragraph' }]),
    }, null, 2),
    'utf-8',
  )
}

test.describe('media paste smoke', () => {
  let tmpDir: string

  test.beforeEach(async ({ page }) => {
    tmpDir = createTmpWorkspace()
    seedWorkspace(tmpDir)
    await installTestFs(page, tmpDir)
  })

  test.afterEach(() => {
    cleanupTmpWorkspace(tmpDir)
  })

  test('image paste keeps editor responsive and persists after reload', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.react-flow__node', { timeout: 30000 })

    const firstNode = page.locator('.react-flow__node').first()
    await firstNode.dblclick({ force: true })
    await page.waitForSelector('.card-blocknote-editor--editable', { timeout: 10000 })

    const editable = page.locator('.card-blocknote-editor--editable').first()
    await editable.click()

    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='
    await page.evaluate(async ({ selector, url }) => {
      const target = document.querySelector(selector) as HTMLElement | null
      if (!target) throw new Error('editable target not found')
      target.focus()

      const blob = await fetch(url).then((response) => response.blob())
      const file = new File([blob], 'tiny.png', { type: 'image/png' })
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)
      const event = new ClipboardEvent('paste', { clipboardData: dataTransfer })
      target.dispatchEvent(event)
    }, { selector: '.card-blocknote-editor--editable', url: dataUrl })

    await expect(page.locator('.card-blocknote-editor--editable img').first()).toBeVisible({ timeout: 10000 })
    await page.reload()
    await page.waitForSelector('.react-flow__node', { timeout: 30000 })
    await page.locator('.react-flow__node').first().dblclick({ force: true })
    await expect(page.locator('.card-blocknote-editor--editable img').first()).toBeVisible({ timeout: 10000 })
  })
})
