import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'


function createTmpWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hepta-alignment-'))
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

function cardContent(title: string) {
  return JSON.stringify([
    {
      type: 'heading',
      props: { level: 2 },
      content: [{ type: 'text', text: title }],
    },
  ])
}

function seedWorkspace(tmpDir: string) {
  fs.mkdirSync(path.join(tmpDir, 'boards'), { recursive: true })
  fs.mkdirSync(path.join(tmpDir, 'cards'), { recursive: true })

  const boardId = 'board-default'
  const cards = [
    { id: 'card-align-1', title: 'Align One', x: 360, y: 100 },
    { id: 'card-align-2', title: 'Align Two', x: 760, y: 160 },
    { id: 'card-align-3', title: 'Align Three', x: 560, y: 420 },
  ]

  fs.writeFileSync(
    path.join(tmpDir, 'boards', '_manifest.json'),
    JSON.stringify({
      boards: [{ id: boardId, name: 'Alignment Board', createdAt: Date.now(), updatedAt: Date.now() }],
    }, null, 2),
    'utf-8',
  )

  fs.writeFileSync(
    path.join(tmpDir, 'boards', `${boardId}.json`),
    JSON.stringify({
      version: 2,
      nodes: cards.map((card) => ({
        id: card.id,
        type: 'card',
        position: { x: card.x, y: card.y },
        data: { cardId: card.id, color: 'blue', width: 280, height: 200 },
        width: 280,
        height: 200,
      })),
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    }, null, 2),
    'utf-8',
  )

  for (const card of cards) {
    fs.writeFileSync(
      path.join(tmpDir, 'cards', `${card.id}.json`),
      JSON.stringify({
        id: card.id,
        title: card.title,
        color: 'blue',
        createdAt: Date.now(),
        content: cardContent(card.title),
      }, null, 2),
      'utf-8',
    )
  }
}

interface NodePos {
  id: string
  x: number
  y: number
  width: number
  height: number
}

async function getNodePositions(page: Page): Promise<NodePos[]> {
  return page.evaluate(() => {
    const nodes = document.querySelectorAll('.react-flow__node')
    return Array.from(nodes).map(n => {
      const r = n.getBoundingClientRect()
      return {
        id: n.getAttribute('data-id') || '',
        x: Math.round(r.left),
        y: Math.round(r.top),
        width: Math.round(r.width),
        height: Math.round(r.height),
      }
    })
  })
}

async function selectCard(page: Page, nodeId: string) {
  const node = page.locator(`.react-flow__node[data-id="${nodeId}"]`)
  await node.click({ modifiers: ['Control'], force: true })
  // React Flow 受控模式下 selection 经 onNodesChange→React state→props 回写 store，
  // 连点太快时下一次点击发生在回写完成前，选中会被覆盖丢失（实测 <50ms 必失败、
  // ≥250ms 稳定成功）。toHaveClass 保证选中已渲染，额外等待保证 store 已同步。
  await expect(node).toHaveClass(/selected/)
  await page.waitForTimeout(250)
}

async function clickAlignButton(page: Page, title: string) {
  const btn = page.locator(`button[title="${title}"]`)
  await expect(btn).toBeVisible()
  await btn.click()
}

async function waitForCanvas(page: Page) {
  // Wait for and close any initial modal
  const modalClose = page.locator('.modal-backdrop button, [aria-label="Close"], .dialog-close, button:has-text("确定"), button:has-text("OK")')
  try {
    await modalClose.first().click({ timeout: 2000 })
  } catch { /* no modal */ }

  await page.waitForSelector('.react-flow__node')
  await page.waitForTimeout(500)
}

test.describe('Card Alignment', () => {
  let tmpDir: string

  test.beforeEach(async ({ page }) => {
    tmpDir = createTmpWorkspace()
    seedWorkspace(tmpDir)
    await installTestFs(page, tmpDir)
    await page.goto('/')
    await waitForCanvas(page)
  })

  test.afterEach(() => {
    cleanupTmpWorkspace(tmpDir)
  })

  test('toolbar appears when 2+ cards selected', async ({ page }) => {
    const positions = await getNodePositions(page)
    expect(positions.length).toBeGreaterThanOrEqual(2)

    await selectCard(page, positions[0].id)
    await selectCard(page, positions[1].id)

    const toolbar = page.locator('button[title="左对齐"]')
    await expect(toolbar).toBeVisible()
  })

  test('toolbar disappears when clicking blank area', async ({ page }) => {
    const positions = await getNodePositions(page)
    await selectCard(page, positions[0].id)
    await selectCard(page, positions[1].id)

    await expect(page.locator('button[title="左对齐"]')).toBeVisible()

    await page.locator('.react-flow__pane').click()
    await expect(page.locator('button[title="左对齐"]')).toBeHidden()
  })

  test('distribute buttons disabled with 2 cards', async ({ page }) => {
    const positions = await getNodePositions(page)
    await selectCard(page, positions[0].id)
    await selectCard(page, positions[1].id)

    const btnH = page.locator('button[title="水平等间距（需要至少 3 张卡片）"]')
    const btnV = page.locator('button[title="垂直等间距（需要至少 3 张卡片）"]')
    await expect(btnH).toBeDisabled()
    await expect(btnV).toBeDisabled()
  })

  test('distribute buttons enabled with 3+ cards', async ({ page }) => {
    const positions = await getNodePositions(page)
    if (positions.length < 3) return

    for (const p of positions) {
      await selectCard(page, p.id)
    }

    const btnH = page.locator('button[title="水平等间距"]')
    const btnV = page.locator('button[title="垂直等间距"]')
    await expect(btnH).toBeEnabled()
    await expect(btnV).toBeEnabled()
  })

  test('left align', async ({ page }) => {
    const positions = await getNodePositions(page)
    await selectCard(page, positions[0].id)
    await selectCard(page, positions[1].id)

    await clickAlignButton(page, '左对齐')

    const after = await getNodePositions(page)
    expect(after[0].x).toBe(after[1].x)
  })

  test('right align', async ({ page }) => {
    const positions = await getNodePositions(page)
    await selectCard(page, positions[0].id)
    await selectCard(page, positions[1].id)

    await clickAlignButton(page, '右对齐')

    const after = await getNodePositions(page)
    const right0 = after[0].x + after[0].width
    const right1 = after[1].x + after[1].width
    expect(right0).toBe(right1)
  })

  test('horizontal center align', async ({ page }) => {
    const positions = await getNodePositions(page)
    await selectCard(page, positions[0].id)
    await selectCard(page, positions[1].id)

    await clickAlignButton(page, '水平居中')

    const after = await getNodePositions(page)
    const center0 = after[0].x + after[0].width / 2
    const center1 = after[1].x + after[1].width / 2
    expect(Math.abs(center0 - center1)).toBeLessThan(2)
  })

  test('top align', async ({ page }) => {
    const positions = await getNodePositions(page)
    await selectCard(page, positions[0].id)
    await selectCard(page, positions[1].id)

    await clickAlignButton(page, '上对齐')

    const after = await getNodePositions(page)
    expect(after[0].y).toBe(after[1].y)
  })

  test('bottom align', async ({ page }) => {
    const positions = await getNodePositions(page)
    await selectCard(page, positions[0].id)
    await selectCard(page, positions[1].id)

    await clickAlignButton(page, '下对齐')

    const after = await getNodePositions(page)
    const bottom0 = after[0].y + after[0].height
    const bottom1 = after[1].y + after[1].height
    expect(bottom0).toBe(bottom1)
  })

  test('vertical center align', async ({ page }) => {
    const positions = await getNodePositions(page)
    await selectCard(page, positions[0].id)
    await selectCard(page, positions[1].id)

    await clickAlignButton(page, '垂直居中')

    const after = await getNodePositions(page)
    const center0 = after[0].y + after[0].height / 2
    const center1 = after[1].y + after[1].height / 2
    expect(Math.abs(center0 - center1)).toBeLessThan(2)
  })

  test('horizontal distribute', async ({ page }) => {
    const positions = await getNodePositions(page)
    if (positions.length < 3) return

    for (const p of positions) {
      await selectCard(page, p.id)
    }

    await clickAlignButton(page, '水平等间距')

    const after = await getNodePositions(page)
    after.sort((a, b) => a.x - b.x)

    const gap1 = after[1].x - (after[0].x + after[0].width)
    const gap2 = after[2].x - (after[1].x + after[1].width)
    expect(Math.abs(gap1 - gap2)).toBeLessThan(2)
  })

  test('vertical distribute', async ({ page }) => {
    const positions = await getNodePositions(page)
    if (positions.length < 3) return

    for (const p of positions) {
      await selectCard(page, p.id)
    }

    await clickAlignButton(page, '垂直等间距')

    const after = await getNodePositions(page)
    after.sort((a, b) => a.y - b.y)

    const gap1 = after[1].y - (after[0].y + after[0].height)
    const gap2 = after[2].y - (after[1].y + after[1].height)
    expect(Math.abs(gap1 - gap2)).toBeLessThan(2)
  })

  test('undo restores positions after alignment', async ({ page }) => {
    const positions = await getNodePositions(page)
    const id0 = positions[0].id
    const id1 = positions[1].id

    await selectCard(page, id0)
    await selectCard(page, id1)

    const beforeAlign = await getNodePositions(page)
    const beforeY0 = beforeAlign.find(p => p.id === id0)?.y ?? 0
    const beforeY1 = beforeAlign.find(p => p.id === id1)?.y ?? 0

    await clickAlignButton(page, '上对齐')

    // Press Ctrl+Z to undo
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(500)

    // After undo, nodes are deselected, so get fresh positions
    const afterUndo = await getNodePositions(page)
    const afterY0 = afterUndo.find(p => p.id === id0)?.y ?? 0
    const afterY1 = afterUndo.find(p => p.id === id1)?.y ?? 0

    expect(Math.abs(afterY0 - beforeY0)).toBeLessThan(2)
    expect(Math.abs(afterY1 - beforeY1)).toBeLessThan(2)
  })
})
