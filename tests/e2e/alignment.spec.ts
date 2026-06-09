import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const DEV_URL = 'http://localhost:5173'

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
  await node.click({ modifiers: ['Control'] })
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
  test.beforeEach(async ({ page }) => {
    await page.goto(DEV_URL)
    await waitForCanvas(page)
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
