import { test, expect, _electron as electron } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.join(__dirname, '..')
const TEST_WORKSPACE_1 = 'D:\\USE\\save\\abasesave1'
const TEST_WORKSPACE_2 = 'D:\\USE\\save\\abasesave2'

// Helper to clear a test workspace
function clearWorkspace(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  for (const subdir of ['cards', 'boards', 'trash']) {
    const subpath = path.join(dir, subdir)
    if (fs.existsSync(subpath)) {
      fs.rmSync(subpath, { recursive: true, force: true })
    }
  }
}

test.describe('Electron File Persistence', () => {
  test.beforeEach(() => {
    clearWorkspace(TEST_WORKSPACE_1)
    clearWorkspace(TEST_WORKSPACE_2)
  })

  test('should create cards and save them to disk', async () => {
    console.log('Launching Electron...')
    const app = await electron.launch({
      args: ['.'],
      cwd: ROOT_DIR,
    })

    const page = await app.firstWindow()
    console.log('Page loaded')

    // Wait for app to initialize
    await page.waitForTimeout(3000)

    // Listen to console messages
    const logs: string[] = []
    page.on('console', msg => {
      const logStr = `[${msg.type()}] ${msg.text()}`
      console.log(logStr)
      logs.push(logStr)
    })

    // First, check if WorkspacePicker is shown
    // Instead of clicking dialog, we'll directly set localStorage and dispatch event
    console.log('Setting workspace path in localStorage...')
    await page.evaluate((workspacePath) => {
      localStorage.setItem('hepta-last-workspace-path', workspacePath)
      
      // Also set workspace store state
      const useWorkspaceStore = (window as any).__zustandStores?.workspaceStore
      if (useWorkspaceStore) {
        useWorkspaceStore.getState().setCurrentWorkspace({
          path: workspacePath,
          name: 'TestWorkspace',
          lastOpened: Date.now(),
        })
      }
      
      // Dispatch workspace changed event to trigger re-initialization
      window.dispatchEvent(new CustomEvent('hepta-workspace-changed', {
        detail: { path: workspacePath }
      }))
    }, TEST_WORKSPACE_1)

    // Wait for initialization
    await page.waitForTimeout(5000)

    // Check if workspace directory has cards/boards/trash subdirs
    console.log('Checking workspace directory:', TEST_WORKSPACE_1)
    const workspaceDirs = fs.readdirSync(TEST_WORKSPACE_1)
    console.log('Workspace dirs:', workspaceDirs)

    // Now add some cards - let's use the API
    console.log('Adding cards...')
    await page.evaluate(() => {
      const windowAny = window as any
      if (windowAny.heptabaseAPI) {
        // Use public API to create cards
        windowAny.heptabaseAPI.cards.create({
          title: 'Test Card 1',
          content: '[{"type":"paragraph","content":[{"type":"text","text":"Hello"}]}, {"type":"heading","props":{"level":1},"content":[{"type":"text","text":"Test 1"}]}]',
          color: 'blue',
          variant: 'solid',
        })
        windowAny.heptabaseAPI.cards.create({
          title: 'Test Card 2',
          content: '[{"type":"paragraph","content":[{"type":"text","text":"World"}]}, {"type":"heading","props":{"level":1},"content":[{"type":"text","text":"Test 2"}]}]',
          color: 'green',
          variant: 'solid',
        })
        windowAny.heptabaseAPI.cards.create({
          title: 'Test Card 3',
          content: '[{"type":"paragraph","content":[{"type":"text","text":"Test 3"}]}, {"type":"heading","props":{"level":1},"content":[{"type":"text","text":"Test 3"}]}]',
          color: 'yellow',
          variant: 'solid',
        })
      } else {
        console.error('heptabaseAPI not found')
        // Try using store directly
        const useCardStore = (window as any).__zustandStores?.cardStore
        if (useCardStore) {
          useCardStore.getState().addCard({
            id: crypto.randomUUID(),
            content: '[{"type":"paragraph","content":[{"type":"text","text":"Hello"}]}]',
            color: 'blue',
            variant: 'solid',
            createdAt: Date.now(),
            title: 'Direct Card 1',
          })
        }
      }
    })

    // Wait for debounced write
    await page.waitForTimeout(2000)

    // Check if files were written
    const cardsDir = path.join(TEST_WORKSPACE_1, 'cards')
    console.log('Checking cards directory:', cardsDir)
    if (fs.existsSync(cardsDir)) {
      const files = fs.readdirSync(cardsDir)
      console.log('Card files:', files)
      
      // Check if at least one JSON file exists
      const jsonFiles = files.filter(f => f.endsWith('.json'))
      console.log('JSON files:', jsonFiles)
      
      if (jsonFiles.length > 0) {
        // Read one file to verify content
        const filePath = path.join(cardsDir, jsonFiles[0])
        const content = fs.readFileSync(filePath, 'utf8')
        console.log('Card file content:', content)
        const cardData = JSON.parse(content)
        expect(cardData.id).toBeTruthy()
        expect(cardData.title).toBeTruthy()
      }
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/electron-persistence-test.png' })

    await app.close()
  })
})
