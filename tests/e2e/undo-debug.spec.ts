import { test, expect } from '@playwright/test'

test('debug: enter card edit, type text, exit, re-enter, check undo logs', async ({ page }) => {
  // Navigate to the app
  await page.goto('http://localhost:5173')
  await page.waitForTimeout(3000)

  // Take a snapshot to see what's on the page
  const snapshot = await page.accessibility.snapshot()
  console.log('Initial page state:', JSON.stringify(snapshot, null, 2)?.substring(0, 500))

  // Find a card node on the canvas
  const cardNodes = page.locator('.card-node-default')
  const cardCount = await cardNodes.count()
  console.log('Found cards:', cardCount)

  if (cardCount === 0) {
    // No cards exist, create one via double-click
    const canvas = page.locator('.react-flow')
    const box = await canvas.boundingBox()
    if (box) {
      await canvas.dblclick({ position: { x: box.width / 2, y: box.height / 2 } })
      await page.waitForTimeout(1000)
    }
  }

  // Get the first card
  const firstCard = cardNodes.first()
  await firstCard.click()
  await page.waitForTimeout(500)

  // Start capturing console logs
  const logs: string[] = []
  page.on('console', msg => {
    const text = msg.text()
    if (text.includes('[undo-debug]')) {
      logs.push(text)
      console.log('CONSOLE:', text)
    }
  })

  // Click again to enter edit mode
  await firstCard.click()
  await page.waitForTimeout(1000)

  // Type some text
  await page.keyboard.type('Hello test text')
  await page.waitForTimeout(500)

  // Press Escape to exit edit mode
  await page.keyboard.press('Escape')
  await page.waitForTimeout(2000)

  // Click on canvas background to deselect
  const canvasBg = page.locator('.react-flow__pane')
  await canvasBg.click({ position: { x: 10, y: 10 } })
  await page.waitForTimeout(1000)

  // Re-select the card
  await firstCard.click()
  await page.waitForTimeout(500)
  await firstCard.click() // second click to enter edit mode
  await page.waitForTimeout(1000)

  // Now try Ctrl+Z
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(1000)

  // Print all collected logs
  console.log('\n=== ALL UNDO DEBUG LOGS ===')
  for (const log of logs) {
    console.log(log)
  }
  console.log('=== END ===')
})
