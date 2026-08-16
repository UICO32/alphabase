import { test, expect } from '@playwright/test'

test('workspace picker: select folder and create a card', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as any).electronAPI = {
      dialog: { openDirectory: async () => 'D:\\test-workspace' },
      fs: {
        readFile: async () => new Uint8Array(),
        writeFile: async () => undefined,
        deleteFile: async () => undefined,
        readdir: async () => [],
        mkdir: async () => undefined,
        stat: async () => ({ isDirectory: true, size: 0, mtimeMs: Date.now() }),
        exists: async () => false,
        rename: async () => undefined,
        rmdir: async () => undefined,
      },
    }
  })
  await page.goto('/')

  // 1. 首次进入应弹出工作区选择器
  await expect(page.getByText('选择工作区', { exact: true })).toBeVisible({ timeout: 5000 })

  // 2. 点击"创建工作区"按钮触发预先安装的浏览器测试桥
  await page.getByText('创建工作区').click()

  // 3. 等待工作区选择器关闭
  await expect(page.getByText('选择工作区', { exact: true })).not.toBeVisible({ timeout: 3000 })

  // 4. 验证画布仍然可见
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 5000 })

  // 5. 创建新卡片
  const cards = page.locator('.react-flow__node')
  const initialCardCount = await cards.count()
  await page.getByRole('button', { name: '添加卡片' }).click()

  // 6. 等待卡片节点出现（React Flow 节点使用 .react-flow__node 类）
  await expect(cards).toHaveCount(initialCardCount + 1, { timeout: 5000 })

  // 7. 截图验证
  await page.screenshot({ path: 'test-results/workspace-card-test.png' })
})

test('workspace picker: should not show duplicate dialogs', async ({ page }) => {
  await page.goto('/')

  // 1. 首次进入应只弹出一个工作区选择器
  const picker = page.getByText('选择工作区', { exact: true })
  await expect(picker).toBeVisible({ timeout: 5000 })
  const pickerCount = await picker.count()
  expect(pickerCount).toBe(1)

  // 2. 确保没有多余的中间弹层
  const createDialogCount = await page.getByText('选择一个文件夹作为工作区').count()
  expect(createDialogCount).toBe(0)

  // 3. 通过稳定的无障碍入口关闭弹窗
  await page.getByRole('button', { name: '关闭工作区选择' }).click()
  await expect(page.locator('.ui-dialog-overlay')).toHaveCount(0)

  // 4. 关闭后不应再自动弹出
  const pickerCountAfter = await page.getByText('选择工作区', { exact: true }).count()
  expect(pickerCountAfter).toBe(0)

  // 5. 刷新页面应再次弹出（因为没有选择工作区）
  await page.reload()
  await expect(page.getByText('选择工作区', { exact: true })).toBeVisible({ timeout: 5000 })

  const pickerCountAfterReload = await page.getByText('选择工作区', { exact: true }).count()
  expect(pickerCountAfterReload).toBe(1)
})

test('workspace picker: click workspace name to reopen picker', async ({ page }) => {
  await page.goto('/')

  // 1. 点击遮罩层关闭初始弹窗
  await page.locator('.ui-dialog-overlay').first().click({ position: { x: 10, y: 10 } })
  await expect(page.getByText('选择工作区', { exact: true })).not.toBeVisible()

  // 2. 点击左侧面板的工作区名称
  await page.getByText('未选择工作区').click()

  // 3. 工作区选择器应重新打开
  await expect(page.getByText('选择工作区', { exact: true })).toBeVisible({ timeout: 3000 })
})
