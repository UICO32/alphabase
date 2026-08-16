import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

const DEV_URL = 'http://localhost:5173'

function createTmpWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hepta-topic-'))
}

function cleanupTmpWorkspace(tmpDir: string) {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

/** 预置工作区：一个普通画板 b1 + 两张卡片 */
function seedWorkspace(tmpDir: string) {
  const boardsDir = path.join(tmpDir, 'boards')
  const cardsDir = path.join(tmpDir, 'cards')
  fs.mkdirSync(boardsDir, { recursive: true })
  fs.mkdirSync(cardsDir, { recursive: true })

  const now = Date.now()
  fs.writeFileSync(
    path.join(boardsDir, '_manifest.json'),
    JSON.stringify({ boards: [{ id: 'b1', name: '用户研究', createdAt: now, updatedAt: now }] }),
  )
  fs.writeFileSync(
    path.join(boardsDir, 'b1.json'),
    JSON.stringify({
      version: 2,
      nodes: [
        { id: 'card-a', type: 'card', position: { x: 120, y: 160 }, data: { cardId: 'card-a', color: 'white', width: 280, height: 200 }, width: 280, height: 200 },
        { id: 'card-b', type: 'card', position: { x: 480, y: 200 }, data: { cardId: 'card-b', color: 'blue', width: 280, height: 200 }, width: 280, height: 200 },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    }),
  )
  for (const [id, title, body] of [
    ['card-a', '访谈：不想承担试错', '用户更在意充电、保值与售后不确定性，而不是单一的续航数字。'],
    ['card-b', '竞品：参数式传播', '市场内容在讲产品规格，用户真正犹豫的是出了问题谁来接住我。'],
  ] as const) {
    fs.writeFileSync(
      path.join(cardsDir, `${id}.json`),
      JSON.stringify({
        id,
        title,
        color: id === 'card-b' ? 'blue' : 'white',
        createdAt: now,
        content: JSON.stringify([
          { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: title }] },
          { type: 'paragraph', content: [{ type: 'text', text: body }] },
        ]),
      }),
    )
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
    fs.mkdirSync(dirPath.replace(/\//g, path.sep), { recursive: true })
  })
  await page.exposeFunction('__testFS_exists', async (filePath: string) => {
    return fs.existsSync(filePath.replace(/\//g, path.sep))
  })
  await page.exposeFunction('__testFS_stat', async (filePath: string) => {
    const stat = fs.statSync(filePath.replace(/\//g, path.sep))
    return { isDirectory: stat.isDirectory(), size: stat.size, mtimeMs: stat.mtimeMs }
  })
  await page.exposeFunction('__testFS_rename', async (oldPath: string, newPath: string) => {
    fs.renameSync(oldPath.replace(/\//g, path.sep), newPath.replace(/\//g, path.sep))
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

async function readProjectFile(tmpDir: string): Promise<Record<string, unknown> | null> {
  const p = path.join(tmpDir, 'projects', 'b1.json')
  if (!fs.existsSync(p)) return null
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

test.describe('顶部主题栏', () => {
  let tmpDir = ''
  test.beforeEach(async ({ page }) => {
    tmpDir = createTmpWorkspace()
    seedWorkspace(tmpDir)
    await installTestFs(page, tmpDir)
    await page.goto(DEV_URL)
    await page.locator('#splash').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => undefined)
    await page.locator('.react-flow').first().waitFor({ state: 'visible', timeout: 20000 })
  })

  test.afterEach(() => cleanupTmpWorkspace(tmpDir))

  test('普通画布：新增主题 → 主题模式 → ★ 按钮标记成果', async ({ page }) => {
    // 悬浮图标按钮（普通画布）：新增主题
    const pill = page.getByRole('button', { name: '新增主题' })
    await expect(pill).toBeVisible()

    // 展开：默认 3 个问题词
    await pill.click()
    await expect(page.getByPlaceholder('问题 1')).toBeVisible()
    await expect(page.getByPlaceholder('问题 3')).toHaveValue('形成结论')

    // 创建主题 → 主题模式：浮层内问题 chips 出现（默认 3 个问题）
    await page.getByText('创建主题', { exact: true }).click()
    const panel = page.locator('[data-topic-drop]')
    await expect(panel).toBeVisible()
    await expect(panel.getByText('收集问题', { exact: true })).toBeVisible()

    // ★ 按钮标记卡片 A → 成果 1
    const cardA = page.locator('.react-flow__node').filter({ hasText: '访谈：不想承担试错' })
    await cardA.hover()
    const starBtn = page.getByTestId('outcome-menu-trigger').first()
    await expect(starBtn).toBeVisible()
    await starBtn.click()
    await page.getByText('标记为成果 · 选择问题').waitFor({ state: 'visible' })
    await page.getByRole('menuitem', { name: '收集问题' }).click()

    // 落盘断言：projects/b1.json 出现 1 个 outcome
    await expect.poll(async () => (await readProjectFile(tmpDir))?.outcomes?.length ?? 0).toBe(1)
    const project = await readProjectFile(tmpDir) as { outcomes: Array<{ nodeId: string; nodeType: string; questionId: string }>; questions: Array<{ id: string; title: string }> }
    expect(project.outcomes[0]).toMatchObject({ nodeId: 'card-a', nodeType: 'card' })
    expect(project.questions.map((q) => q.title)).toEqual(['收集问题', '拆解子问题', '形成结论'])

    // 展开面板：问题 1 下有该成果（标题 + 正文）
    await expect(panel.getByText('访谈：不想承担试错')).toBeVisible()
    await expect(panel.getByText('用户更在意充电、保值与售后不确定性')).toBeVisible()
  })

  test('拖拽卡片到主题栏面板 → 置入当前问题，原位置保留', async ({ page }) => {
    await page.getByRole('button', { name: '新增主题' }).click()
    await page.getByText('创建主题', { exact: true }).click()
    await expect(page.locator('[data-topic-drop]').getByText('收集问题', { exact: true })).toBeVisible()

    // 创建主题后面板保持展开（主题模式），面板即放置目标
    const panel = page.locator('[data-topic-drop]')
    await expect(panel).toBeVisible()

    // 拖拽卡片 B 到面板中心
    const cardB = page.locator('.react-flow__node').filter({ hasText: '竞品：参数式传播' })
    const handle = cardB.locator('.card-drag-handle')
    const srcBox = await handle.boundingBox()
    const dstBox = await panel.boundingBox()
    expect(srcBox).not.toBeNull()
    expect(dstBox).not.toBeNull()
    const before = await cardB.getAttribute('style')
    const beforeTransform = before?.match(/transform: [^;]+/)?.[0]
    // 拖动：down on drag-handle → 移动到面板 → up
    await page.mouse.move(srcBox!.x + srcBox!.width / 2, srcBox!.y + srcBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(dstBox!.x + dstBox!.width / 2, dstBox!.y + dstBox!.height / 2, { steps: 15 })
    // 命中检测：拖动经过面板时应出现"松开置入"高亮
    await expect(page.getByText(/松开置入/)).toBeVisible()
    await page.mouse.up()

    // 落盘：1 个 outcome（card-b，归属当前问题）
    await expect.poll(async () => (await readProjectFile(tmpDir))?.outcomes?.length ?? 0).toBe(1)
    const project = await readProjectFile(tmpDir) as { outcomes: Array<{ nodeId: string; nodeType: string }> }
    expect(project.outcomes[0]).toMatchObject({ nodeId: 'card-b', nodeType: 'card' })

    // 卡片 B 原位置保留（transform 未变化；z-index 提升是 React Flow 拖动后的正常状态）
    await expect.poll(async () => (await cardB.getAttribute('style'))?.match(/transform: [^;]+/)?.[0]).toBe(beforeTransform)
  })
})
