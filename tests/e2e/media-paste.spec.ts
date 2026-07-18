import { expect, test, type Page } from '@playwright/test'
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
      content: JSON.stringify([
        {
          type: 'heading',
          props: { level: 2 },
          content: [{ type: 'text', text: 'Media Paste Card' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Editor continuity sentinel' }],
        },
      ]),
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

  async function openSideEditor(page: Page) {
    const node = page.locator('.react-flow__node').first()
    await node.hover()
    await page.getByRole('heading', { name: 'Media Paste Card' }).first().click({ force: true })
    await node.locator('button.action-icon-btn').nth(3).click({ force: true })
    await page.waitForSelector('.card-blocknote-editor--editable', { timeout: 10000 })
  }

  async function startEntryContinuityProbe(page: Page) {
    await page.evaluate(() => {
      const sentinel = 'Editor continuity sentinel'
      const samples: Array<{ phase: string | null; hasSentinel: boolean }> = []
      const inspect = () => {
        document.querySelectorAll<HTMLElement>('.card-editor-entry').forEach((entry) => {
          samples.push({
            phase: entry.dataset.editorEntryPhase ?? null,
            hasSentinel: entry.textContent?.includes(sentinel) ?? false,
          })
        })
      }
      const observer = new MutationObserver(inspect)
      observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true })
      ;(window as any).__stopEditorEntryProbe = () => {
        inspect()
        observer.disconnect()
        return samples
      }
    })
  }

  async function stopEntryContinuityProbe(page: Page) {
    return page.evaluate(() => (window as any).__stopEditorEntryProbe() as Array<{
      phase: string | null
      hasSentinel: boolean
    }>)
  }

  async function expectContinuousEntry(page: Page) {
    await expect(page.locator('.card-editor-entry[data-editor-entry-phase="interactive"]')).toBeVisible({ timeout: 10000 })
    const samples = await stopEntryContinuityProbe(page)
    expect(samples.length).toBeGreaterThan(0)
    expect(samples.filter((sample) => !sample.hasSentinel)).toEqual([])
  }

  test('canvas editor preserves content until the focused editor is interactive', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.react-flow__node', { timeout: 30000 })
    await startEntryContinuityProbe(page)

    await page.locator('.react-flow__node').first().getByText('Editor continuity sentinel', { exact: true }).click()
    await expectContinuousEntry(page)
    await expect(page.locator('.card-blocknote-editor--editable .ProseMirror')).toBeFocused()
  })

  test('canvas editor keeps the insertion point at the clicked character boundary', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.react-flow__node', { timeout: 30000 })
    const expectedOffsetWithinText = 11
    const canvasNode = page.locator('.react-flow__node').first()
    const clickPoint = await canvasNode.evaluate((node, offset) => {
      const preview = node.querySelector('.card-preview-native')
      if (!preview) throw new Error('card preview not found')
      const walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT)
      let consumedText = 0
      let textNode: Text | null
      while ((textNode = walker.nextNode() as Text | null)) {
        if (textNode.textContent === 'Editor continuity sentinel') {
          const range = document.createRange()
          range.setStart(textNode, offset - 1)
          range.setEnd(textNode, offset)
          const rect = range.getBoundingClientRect()
          return {
            x: rect.right,
            y: (rect.top + rect.bottom) / 2,
            expectedDocumentOffset: consumedText + offset,
          }
        }
        consumedText += textNode.textContent?.length ?? 0
      }
      throw new Error('sentinel text node not found')
    }, expectedOffsetWithinText)

    await canvasNode.getByText('Editor continuity sentinel', { exact: true }).dispatchEvent('click', {
      bubbles: true,
      button: 0,
      clientX: clickPoint.x,
      clientY: clickPoint.y,
    })
    await expect(page.locator('.card-editor-entry[data-editor-entry-phase="interactive"]')).toBeVisible({ timeout: 10000 })
    const actualOffset = await page.evaluate(() => {
      const selection = window.getSelection()
      const anchorNode = selection?.anchorNode
      if (!selection || !anchorNode) return -1
      const editorRoot = (anchorNode.nodeType === Node.ELEMENT_NODE
        ? anchorNode as Element
        : anchorNode.parentElement)?.closest('.ProseMirror')
      if (!editorRoot) return -1
      const prefix = document.createRange()
      prefix.selectNodeContents(editorRoot)
      prefix.setEnd(anchorNode, selection.anchorOffset)
      return prefix.toString().length
    })
    expect(actualOffset).toBe(clickPoint.expectedDocumentOffset)
  })

  test('side editor preserves content while its BlockNote instance mounts', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.react-flow__node', { timeout: 30000 })
    await startEntryContinuityProbe(page)

    await openSideEditor(page)
    await expectContinuousEntry(page)
  })

  test('card dialog preserves content while the dialog and editor appear', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.react-flow__node', { timeout: 30000 })
    const leftPanelViewSwitch = page.locator('.segmented').first()
    await leftPanelViewSwitch.locator('button').nth(1).click()
    await expect(page.getByRole('heading', { name: '卡片库' })).toBeVisible({ timeout: 10000 })
    await startEntryContinuityProbe(page)

    await page.getByText('Media Paste Card', { exact: true }).first().click()
    await expectContinuousEntry(page)
  })

  test('image paste keeps editor responsive and persists after reload', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.react-flow__node', { timeout: 30000 })

    await openSideEditor(page)

    const editable = page.locator('.card-blocknote-editor--editable .ProseMirror').first()
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
      const event = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
      })
      target.dispatchEvent(event)
    }, { selector: '.card-blocknote-editor--editable .ProseMirror', url: dataUrl })
    await expect(page.locator('.card-blocknote-editor--editable img').first()).toBeVisible({ timeout: 10000 })
    await expect.poll(() => {
      const cardFile = path.join(tmpDir, 'cards', 'card-media-test.json')
      return fs.existsSync(cardFile) ? fs.readFileSync(cardFile, 'utf-8') : ''
    }, { timeout: 5000 }).toContain('data:image/png')

    await page.reload()
    await page.waitForSelector('.react-flow__node', { timeout: 30000 })
    await openSideEditor(page)
    await expect(page.locator('.card-blocknote-editor--editable img').first()).toBeVisible({ timeout: 10000 })
  })
})
