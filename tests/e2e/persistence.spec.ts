import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

function createTmpWorkspace(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hepta-inttest-'))
  return tmpDir
}

function cleanupTmpWorkspace(tmpDir: string) {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

test.describe('文件持久化集成测试', () => {
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

  test('创建卡片后文件写入磁盘', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('main', { timeout: 15000 })
    await page.waitForTimeout(3000)

    const cardId = await page.evaluate(() => {
      const api = (window as any).heptabaseAPI
      const result = api.cards.create({
        content: '[{"type":"heading","props":{"level":2},"content":[{"type":"text","text":"持久化测试"}]}]',
        color: 'blue',
        variant: 'solid',
        title: '持久化测试',
      })
      return result.data?.id || result.error
    })

    expect(typeof cardId).toBe('string')

    // Wait for syncEngine debounce (500ms) + write + margin
    await page.waitForTimeout(2000)

    const cardFile = path.join(tmpDir, 'cards', `${cardId}.json`)
    expect(fs.existsSync(cardFile)).toBe(true)

    const content = JSON.parse(fs.readFileSync(cardFile, 'utf-8'))
    expect(content.id).toBe(cardId)
    expect(content.color).toBe('blue')
    expect(content.variant).toBe('solid')
    expect(content.title).toBe('持久化测试')
  })

  test('softDelete后trash文件和card文件同时存在', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('main', { timeout: 15000 })
    await page.waitForTimeout(3000)

    const cardId = await page.evaluate(() => {
      const api = (window as any).heptabaseAPI
      const result = api.cards.create({
        content: '[]',
        color: 'pink',
        variant: 'outline',
        title: '删除测试',
      })
      return result.data.id
    })

    await page.waitForTimeout(2000)

    await page.evaluate((id) => {
      (window as any).heptabaseAPI.cards.softDelete(id)
    }, cardId)

    await page.waitForTimeout(2000)

    // Card file should exist with deletedAt
    const cardFile = path.join(tmpDir, 'cards', `${cardId}.json`)
    expect(fs.existsSync(cardFile)).toBe(true)
    const cardContent = JSON.parse(fs.readFileSync(cardFile, 'utf-8'))
    expect(cardContent.deletedAt).toBeDefined()
    expect(cardContent.color).toBe('pink')

    // Trash file should exist
    const trashFile = path.join(tmpDir, 'trash', `${cardId}.trash.json`)
    expect(fs.existsSync(trashFile)).toBe(true)
    const trashContent = JSON.parse(fs.readFileSync(trashFile, 'utf-8'))
    expect(trashContent.cardId).toBe(cardId)
    expect(trashContent.color).toBe('pink')
    expect(trashContent.title).toBe('删除测试')
    expect(trashContent.expiresAt).toBeDefined()
  })

  test('恢复后trash文件删除且card文件更新', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('main', { timeout: 15000 })
    await page.waitForTimeout(3000)

    const cardId = await page.evaluate(() => {
      const api = (window as any).heptabaseAPI
      const result = api.cards.create({
        content: '[]',
        color: 'green',
        variant: 'glass',
        title: '恢复测试',
      })
      return result.data.id
    })

    await page.waitForTimeout(2000)

    // Soft delete
    await page.evaluate((id) => {
      (window as any).heptabaseAPI.cards.softDelete(id)
    }, cardId)

    await page.waitForTimeout(2000)

    // Restore
    await page.evaluate((id) => {
      (window as any).heptabaseAPI.cards.restore(id)
    }, cardId)

    await page.waitForTimeout(2000)

    // Card file should have no deletedAt
    const cardFile = path.join(tmpDir, 'cards', `${cardId}.json`)
    expect(fs.existsSync(cardFile)).toBe(true)
    const cardContent = JSON.parse(fs.readFileSync(cardFile, 'utf-8'))
    expect(cardContent.deletedAt).toBeUndefined()
    expect(cardContent.color).toBe('green')
    expect(cardContent.title).toBe('恢复测试')

    // Trash file should be deleted
    const trashFile = path.join(tmpDir, 'trash', `${cardId}.trash.json`)
    expect(fs.existsSync(trashFile)).toBe(false)
  })

  test('永久删除后文件全部清除', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('main', { timeout: 15000 })
    await page.waitForTimeout(3000)

    const cardId = await page.evaluate(() => {
      const api = (window as any).heptabaseAPI
      const result = api.cards.create({
        content: '[]',
        color: 'red',
        variant: 'solid',
        title: '永久删除测试',
      })
      return result.data.id
    })

    await page.waitForTimeout(2000)

    // Soft delete then permanent delete
    await page.evaluate((id) => {
      const api = (window as any).heptabaseAPI
      api.cards.softDelete(id)
    }, cardId)

    await page.waitForTimeout(2000)

    await page.evaluate((id) => {
      (window as any).heptabaseAPI.trash.permanentDelete(id)
    }, cardId)

    await page.waitForTimeout(2000)

    // Both files should be gone
    const cardFile = path.join(tmpDir, 'cards', `${cardId}.json`)
    expect(fs.existsSync(cardFile)).toBe(false)

    const trashFile = path.join(tmpDir, 'trash', `${cardId}.trash.json`)
    expect(fs.existsSync(trashFile)).toBe(false)
  })

  test('重启应用后数据从磁盘恢复', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('main', { timeout: 15000 })
    await page.waitForTimeout(3000)

    // Phase 1: Create cards and manipulate them
    const ids = await page.evaluate(() => {
      const api = (window as any).heptabaseAPI
      const card1 = api.cards.create({
        content: '[{"type":"heading","props":{"level":2},"content":[{"type":"text","text":"保留的卡片"}]}]',
        color: 'blue',
        variant: 'solid',
        title: '保留的卡片',
      })
      const card2 = api.cards.create({
        content: '[{"type":"heading","props":{"level":2},"content":[{"type":"text","text":"将删除的卡片"}]}]',
        color: 'red',
        variant: 'outline',
        title: '将删除的卡片',
      })
      return { card1Id: card1.data.id, card2Id: card2.data.id }
    })

    // Wait for initial card writes
    await page.waitForTimeout(2000)

    // Soft delete card2
    await page.evaluate((card2Id) => {
      (window as any).heptabaseAPI.cards.softDelete(card2Id)
    }, ids.card2Id)

    // Wait for trash write
    await page.waitForTimeout(2000)

    // Verify files exist on disk before reload
    const card1File = path.join(tmpDir, 'cards', `${ids.card1Id}.json`)
    const card2File = path.join(tmpDir, 'cards', `${ids.card2Id}.json`)
    const trash2File = path.join(tmpDir, 'trash', `${ids.card2Id}.trash.json`)

    expect(fs.existsSync(card1File)).toBe(true)
    expect(fs.existsSync(card2File)).toBe(true)
    expect(fs.existsSync(trash2File)).toBe(true)

    // Verify card2 has deletedAt in file
    const card2Content = JSON.parse(fs.readFileSync(card2File, 'utf-8'))
    expect(card2Content.deletedAt).toBeDefined()

    // Verify trash file content
    const trashContent = JSON.parse(fs.readFileSync(trash2File, 'utf-8'))
    expect(trashContent.cardId).toBe(ids.card2Id)
    expect(trashContent.color).toBe('red')
    expect(trashContent.title).toBe('将删除的卡片')

    // Phase 2: "Restart" - reload the page
    // The init script will re-set localStorage and electronAPI,
    // so the app will reinitialize and load data from the real disk files
    await page.reload()
    await page.waitForSelector('main', { timeout: 15000 })
    // Extra wait for async file loading
    await page.waitForTimeout(4000)

    // Phase 3: Verify store data recovered from disk
    const result = await page.evaluate((expectedIds) => {
      const api = (window as any).heptabaseAPI

      const card1 = api.cards.get(expectedIds.card1Id)
      const card2 = api.cards.get(expectedIds.card2Id)
      const trash = api.trash.list()
      const trashItem = trash.data?.find((i: any) => i.cardId === expectedIds.card2Id)

      return {
        card1Exists: !!card1?.data,
        card1Color: card1?.data?.color,
        card1Title: card1?.data?.title,
        card2Exists: !!card2?.data,
        card2HasDeletedAt: card2?.data?.deletedAt !== undefined,
        card2Color: card2?.data?.color,
        card2Title: card2?.data?.title,
        trashHasCard2: !!trashItem,
        trashColor: trashItem?.color,
        trashTitle: trashItem?.title,
      }
    }, ids)

    // Card1 should be intact
    expect(result.card1Exists).toBe(true)
    expect(result.card1Color).toBe('blue')
    expect(result.card1Title).toBe('保留的卡片')

    // Card2 should still exist but marked as deleted
    expect(result.card2Exists).toBe(true)
    expect(result.card2HasDeletedAt).toBe(true)
    expect(result.card2Color).toBe('red')
    expect(result.card2Title).toBe('将删除的卡片')

    // Trash should have card2 entry with full data
    expect(result.trashHasCard2).toBe(true)
    expect(result.trashColor).toBe('red')
    expect(result.trashTitle).toBe('将删除的卡片')
  })
})