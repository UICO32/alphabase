import { test, expect } from '@playwright/test'

const WORKSPACE = 'D:\\flaky-ws'

interface MockOptions {
  files: Record<string, string>
  failExists?: boolean
}

async function installMockFs(page: import('@playwright/test').Page, options: MockOptions) {
  await page.addInitScript(({ files, failExists, workspace }) => {
    const writes: string[] = []
    ;(window as unknown as { __writes: string[] }).__writes = writes

    const normalize = (path: string) => path.replace(/\\/g, '/').replace(/\/+$/, '')
    const workspaceKey = normalize(workspace)
    const dirs = ['cards', 'boards', 'trash', 'projects']

    const exists = async (path: string) => {
      if (failExists) throw new Error('EACCES: permission denied')
      const key = normalize(path)
      if (files[key] !== undefined) return true
      if (key === workspaceKey) return true
      return dirs.some(dir => key === `${workspaceKey}/${dir}`)
    }

    const listDir = (dirPath: string) => {
      const dir = normalize(dirPath)
      return Object.keys(files)
        .filter(key => key.startsWith(`${dir}/`))
        .map(key => key.slice(dir.length + 1))
        .filter(name => name.length > 0)
    }

    ;(window as unknown as { electronAPI: unknown }).electronAPI = {
      dialog: { openDirectory: async () => null },
      fs: {
        readFile: async (path: string) => {
          const key = normalize(path)
          const value = files[key]
          if (value === undefined) throw new Error(`ENOENT: ${path}`)
          return new TextEncoder().encode(value)
        },
        writeFile: async (path: string) => { writes.push(`write:${normalize(path)}`) },
        deleteFile: async (path: string) => { writes.push(`delete:${normalize(path)}`) },
        readdir: async (path: string) => listDir(path),
        readDirFiles: async (dirPath: string) => {
          const dir = normalize(dirPath)
          const result: Record<string, string> = {}
          for (const [key, value] of Object.entries(files)) {
            if (!key.startsWith(`${dir}/`)) continue
            const name = key.slice(dir.length + 1)
            if (name.includes('/')) continue
            result[name] = value
          }
          return result
        },
        mkdir: async (path: string) => { writes.push(`mkdir:${normalize(path)}`) },
        stat: async () => ({ isDirectory: true, size: 0, mtimeMs: 1000 }),
        exists,
        rename: async (from: string, to: string) => { writes.push(`rename:${normalize(from)}->${normalize(to)}`) },
        rmdir: async () => {},
      },
    }

    localStorage.setItem('hepta-last-workspace-path', workspace)
  }, { ...options, workspace: WORKSPACE })
}

test('cancelling a conflicted workspace writes nothing and shows a clear error state', async ({ page }) => {
  await installMockFs(page, {
    files: {
      'D:/flaky-ws/_metadata.json': JSON.stringify({ version: 1, cardCount: 5, boardCount: 1, lastModified: 1 }),
      'D:/flaky-ws/boards/_manifest.json': JSON.stringify({ boards: [{ id: 'board-1', name: '画板', createdAt: 1, updatedAt: 1 }] }),
    },
  })

  await page.goto('/')

  await expect(page.getByText('检测到工作区数据不完整')).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: '先不加载' }).click()

  await expect(page.getByText('工作区加载失败')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText(/已取消加载该工作区/)).toBeVisible()

  const writes = await page.evaluate(() => (window as unknown as { __writes: string[] }).__writes)
  expect(writes).toEqual([])
  await expect(page.locator('.react-flow')).toHaveCount(0)
})

test('a failed workspace load surfaces an error instead of demo cards', async ({ page }) => {
  await installMockFs(page, { files: {}, failExists: true })

  await page.goto('/')

  await expect(page.getByRole('heading', { name: '工作区加载失败' })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/EACCES/)).toBeVisible()
  await expect(page.getByText(/数据文件仍保留在原目录/)).toBeVisible()
  await expect(page.locator('.react-flow__node')).toHaveCount(0)

  const writes = await page.evaluate(() => (window as unknown as { __writes: string[] }).__writes)
  expect(writes).toEqual([])
})
