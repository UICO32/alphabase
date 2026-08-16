import { test, expect } from '@playwright/test'

test.describe('卡片删除与回收站数据持久化', () => {
  async function setupDemoMode(page: import('@playwright/test').Page) {
    await page.evaluate(() => {
      localStorage.removeItem('hepta-last-workspace-path')
      ;(window as any).electronAPI = {
        dialog: { openDirectory: async () => null },
        fs: {
          readFile: async () => new Uint8Array(0),
          writeFile: async () => {},
          deleteFile: async () => {},
          readdir: async () => [] as string[],
          mkdir: async () => {},
          stat: async () => ({ isDirectory: false, size: 0, mtimeMs: Date.now() }),
          exists: async () => false,
          rename: async () => {},
          rmdir: async () => {},
        },
      }
    })
    await page.reload()
    // 等待应用加载 - 使用更通用的选择器
    await page.waitForSelector('main', { timeout: 15000 })
    // 等待 React Flow 初始化完成
    await page.waitForTimeout(2000)
  }

  test('softDelete 后 trashStore 包含完整卡片数据', async ({ page }) => {
    await page.goto('/')
    await setupDemoMode(page)

    const testResult = await page.evaluate(() => {
      const api = (window as any).heptabaseAPI

      const createResult = api.cards.create({
        content: '[{"type":"heading","props":{"level":2},"content":[{"type":"text","text":"同步测试"}]}]',
        color: 'blue',
        variant: 'solid',
      })
      if (!createResult.success) return { error: createResult.error }
      const cardId = createResult.data.id

      const softDeleteResult = api.cards.softDelete(cardId)
      if (!softDeleteResult.success) return { error: softDeleteResult.error }

      const trashResult = api.trash.list()
      if (!trashResult.success) return { error: trashResult.error }

      const trashItem = trashResult.data.find((i: any) => i.cardId === cardId)

      return {
        trashHasItem: !!trashItem,
        trashCardId: trashItem?.cardId,
        trashColor: trashItem?.color,
        trashVariant: trashItem?.variant,
        trashTitle: trashItem?.title,
        trashHasContent: !!trashItem?.content,
        trashCreatedAt: !!trashItem?.createdAt,
        trashExpiresAt: !!trashItem?.expiresAt,
        cardDeletedAt: !!createResult.data?.deletedAt || api.cards.get(cardId)?.data?.deletedAt !== undefined,
      }
    })

    expect(testResult.trashHasItem).toBe(true)
    expect(testResult.trashCardId).toBeTruthy()
    expect(testResult.trashColor).toBe('blue')
    expect(testResult.trashVariant).toBe('solid')
    expect(testResult.trashHasContent).toBe(true)
    expect(testResult.trashCreatedAt).toBe(true)
    expect(testResult.trashExpiresAt).toBe(true)
  })

  test('恢复卡片后 deletedAt 清除且 trashStore 项移除', async ({ page }) => {
    await page.goto('/')
    await setupDemoMode(page)

    const testResult = await page.evaluate(() => {
      const api = (window as any).heptabaseAPI

      const createResult = api.cards.create({
        content: '[{"type":"heading","props":{"level":2},"content":[{"type":"text","text":"恢复测试"}]}]',
        color: 'pink',
        variant: 'outline',
      })
      if (!createResult.success) return { error: createResult.error }
      const cardId = createResult.data.id

      api.cards.update(cardId, {
        title: '恢复测试',
        enforceInitialHeading: true,
        fixedHeight: true,
      })

      api.cards.softDelete(cardId)

      const restoreResult = api.cards.restore(cardId)
      if (!restoreResult.success) return { error: restoreResult.error }

      const cardAfter = api.cards.get(cardId).data
      const trashAfter = api.trash.list().data
      const trashItemForCard = trashAfter.find((i: any) => i.cardId === cardId)

      return {
        cardExists: !!cardAfter,
        deletedAtCleared: cardAfter?.deletedAt === undefined,
        colorPreserved: cardAfter?.color === 'pink',
        variantPreserved: cardAfter?.variant === 'outline',
        titlePreserved: cardAfter?.title === '恢复测试',
        enforceInitialHeadingPreserved: cardAfter?.enforceInitialHeading === true,
        fixedHeightPreserved: cardAfter?.fixedHeight === true,
        trashItemRemoved: !trashItemForCard,
      }
    })

    expect(testResult.cardExists).toBe(true)
    expect(testResult.deletedAtCleared).toBe(true)
    expect(testResult.colorPreserved).toBe(true)
    expect(testResult.variantPreserved).toBe(true)
    expect(testResult.titlePreserved).toBe(true)
    expect(testResult.enforceInitialHeadingPreserved).toBe(true)
    expect(testResult.fixedHeightPreserved).toBe(true)
    expect(testResult.trashItemRemoved).toBe(true)
  })

  test('永久删除后卡片和回收站记录均移除', async ({ page }) => {
    await page.goto('/')
    await setupDemoMode(page)

    const testResult = await page.evaluate(() => {
      const api = (window as any).heptabaseAPI

      const createResult = api.cards.create({
        content: '[]',
        color: 'green',
        variant: 'glass',
      })
      if (!createResult.success) return { error: createResult.error }
      const cardId = createResult.data.id

      api.cards.softDelete(cardId)

      api.trash.permanentDelete(cardId)

      const cardAfter = api.cards.get(cardId).data
      const trashAfter = api.trash.list().data
      const trashItemForCard = trashAfter.find((i: any) => i.cardId === cardId)

      return {
        cardGone: !cardAfter,
        trashGone: !trashItemForCard,
      }
    })

    expect(testResult.cardGone).toBe(true)
    expect(testResult.trashGone).toBe(true)
  })
})