import type { Page } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

/**
 * 注入一个真实的临时工作区（页面内通过 exposeFunction 读写宿主磁盘）。
 *
 * 没有它时画布拿不到 fs adapter，React Flow 的 onInit 不触发、视口与持久化相关的
 * 逻辑都不会跑，性能/画板类用例必须先装这一层。
 */
export function createTempWorkspace(prefix = 'hepta-e2e-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

export async function installTestWorkspaceFs(page: Page, tmpDir: string) {
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
  await page.exposeFunction('__testFS_stat', async (filePath: string) => {
    const stat = fs.statSync(filePath.replace(/\//g, path.sep))
    return { isDirectory: stat.isDirectory(), size: stat.size, mtimeMs: stat.mtimeMs }
  })
  await page.exposeFunction('__testFS_exists', async (filePath: string) => fs.existsSync(filePath.replace(/\//g, path.sep)))
  await page.exposeFunction('__testFS_rename', async (oldPath: string, newPath: string) => {
    const newNormalized = newPath.replace(/\//g, path.sep)
    const dir = path.dirname(newNormalized)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.renameSync(oldPath.replace(/\//g, path.sep), newNormalized)
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

/** 长文本卡片内容模板（BlockNote JSON）：标题 + 多段行内样式 + 列表 + 表格。 */
export function buildLongTextContent(variant = 0): string {
  const text = (value: string, styles: Record<string, boolean> = {}) => ({ type: 'text', text: value, styles })
  const blocks: unknown[] = [{
    type: 'heading',
    props: { level: 2 },
    content: [text(`长文本样本 ${variant}`)],
    children: [],
  }]
  for (let index = 0; index < 8; index += 1) {
    blocks.push({
      type: 'paragraph',
      props: { textAlignment: 'left' },
      content: [
        text(`第 ${index} 段：`),
        text('加粗内容', { bold: true }),
        text('，以及 '),
        text('行内代码', { code: true }),
        text('。这段文字用于模拟真实的卡片正文长度，包含中英文混排 Mixed content、数字 12345 与标点符号。'),
      ],
      children: [],
    })
  }
  blocks.push({
    type: 'bulletListItem',
    props: {},
    content: [text('列表项')],
    children: [],
  })
  blocks.push({
    type: 'table',
    props: {},
    content: {
      type: 'tableContent',
      headerRows: 1,
      headerCols: 0,
      rows: Array.from({ length: 5 }, (_, rowIndex) => ({
        cells: Array.from({ length: 4 }, (_, cellIndex) => [text(`R${rowIndex}C${cellIndex} 表格单元格`)])
      })),
    },
    children: [],
  })
  return JSON.stringify(blocks)
}
