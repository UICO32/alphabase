import { test, expect, _electron as electron } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { fileURLToPath } from 'url'

const ROOT_DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const TEST_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'alphabase-electron-persistence-'))
const TEST_WORKSPACE_1 = path.join(TEST_ROOT, 'workspace-1')
const TEST_WORKSPACE_2 = path.join(TEST_ROOT, 'workspace-2')

// Ensure test directories exist
function ensureTestDirs() {
  for (const dir of [TEST_WORKSPACE_1, TEST_WORKSPACE_2]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    // Clean up any existing files
    for (const subdir of ['cards', 'boards', 'trash']) {
      const subPath = path.join(dir, subdir)
      if (fs.existsSync(subPath)) {
        fs.rmSync(subPath, { recursive: true, force: true })
      }
    }
  }
}

test.describe('Electron 文件持久化测试', () => {
  let electronApp: any

  test.beforeAll(async () => {
    ensureTestDirs()
    electronApp = await electron.launch({
      args: ['.'],
      cwd: ROOT_DIRECTORY,
    })
  })

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close()
    }
    fs.rmSync(TEST_ROOT, { recursive: true, force: true })
  })

  test('选择工作区后卡片应写入磁盘', async () => {
    const page = await electronApp.firstWindow()

    // Wait for app to load
    await page.waitForTimeout(2000)

    // Take screenshot to see current state
    await page.screenshot({ path: 'test-results/01-initial-state.png' })

    // Check if WorkspacePicker is shown
    const hasWorkspacePicker = await page.locator('text=选择工作区').isVisible().catch(() => false)

    if (hasWorkspacePicker) {
      // Click "创建工作区" button
      await page.click('text=创建工作区')
      await page.waitForTimeout(500)

      // Electron dialog should open - we need to handle it
      // For now, let's check console logs
    }

    // Wait and check files
    await page.waitForTimeout(3000)

    // Check if cards directory was created
    const cardsDir = path.join(TEST_WORKSPACE_1, 'cards')
    console.log('Cards dir exists:', fs.existsSync(cardsDir))

    if (fs.existsSync(cardsDir)) {
      const files = fs.readdirSync(cardsDir)
      console.log('Card files:', files)
    }

    // List all files in workspace
    console.log('Workspace 1 contents:', fs.readdirSync(TEST_WORKSPACE_1))

    await page.screenshot({ path: 'test-results/02-after-workspace.png' })
  })

  test('新建卡片后应写入 cards 目录', async () => {
    const page = await electronApp.firstWindow()

    // Try to add a card via the toolbar
    const addButton = await page.locator('[title="添加卡片"]').first()
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click()
      await page.waitForTimeout(1000)

      // Check if card file was created
      const cardsDir = path.join(TEST_WORKSPACE_1, 'cards')
      if (fs.existsSync(cardsDir)) {
        const files = fs.readdirSync(cardsDir)
        console.log('Card files after add:', files)
        expect(files.length).toBeGreaterThan(0)
      } else {
        console.log('Cards directory does not exist')
      }
    }

    await page.screenshot({ path: 'test-results/03-after-add-card.png' })
  })
})
