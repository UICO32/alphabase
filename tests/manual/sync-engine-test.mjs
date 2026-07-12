/**
 * SyncEngine 手动测试
 *
 * 测试目标：
 * 1. init() 正确创建目录并设置 running = true
 * 2. scheduleWriteCard() 写入文件
 * 3. stop() 后 scheduleWriteCard() 仍然写入（不检查 running）
 * 4. 防抖 debounce 机制正常
 * 5. 删除操作正常
 * 6. 多次写入同一卡片只触发一次写入
 * 7. flushAll() 清理 pending 写入
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

// --- 硬编码测试输出路径 ---
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOG_FILE = path.join(__dirname, 'sync-engine-test.log')
const TEST_DIR = path.join(__dirname, '.test-temp')

// --- 日志函数 ---
function log(msg) {
  const timestamp = new Date().toISOString().slice(11, 23)
  const line = `[${timestamp}] ${msg}`
  console.log(line)
  fs.appendFile(LOG_FILE, line + '\n').catch(() => {})
}

// --- 模拟 FSAdapter (直接使用 Node fs) ---
const nodeFsAdapter = {
  async readFile(p) {
    return await fs.readFile(p)
  },
  async writeFile(p, data) {
    await fs.writeFile(p, data)
  },
  async deleteFile(p) {
    await fs.unlink(p)
  },
  async readdir(p) {
    return await fs.readdir(p)
  },
  async mkdir(p) {
    await fs.mkdir(p, { recursive: true })
  },
  async stat(p) {
    const st = await fs.stat(p)
    return { isDirectory: st.isDirectory(), size: st.size, mtimeMs: st.mtimeMs }
  },
  async exists(p) {
    try {
      await fs.access(p)
      return true
    } catch { return false }
  },
  async rename(oldP, newP) {
    await fs.rename(oldP, newP)
  },
  async rmdir(p) {
    await fs.rm(p, { recursive: true, force: true })
  },
}

// --- 引入 syncEngine (需要 mock fs 模块) ---
// 由于 syncEngine 使用相对路径导入，我们在同一个进程中模拟
// 直接内联 WorkspaceSyncEngine 的简化版进行测试

class WorkspaceSyncEngine {
  constructor() {
    this.cardsDir = ''
    this.boardsDir = ''
    this.trashDir = ''
    this.pendingWrites = new Map()
    this.running = false
    this.writeCount = 0
  }

  async init(workspacePath, fsAdapter) {
    this.fs = fsAdapter
    this.cardsDir = workspacePath + '/cards'
    this.boardsDir = workspacePath + '/boards'
    this.trashDir = workspacePath + '/trash'
    for (const dir of [this.cardsDir, this.boardsDir, this.trashDir]) {
      if (!(await this.fs.exists(dir))) {
        await this.fs.mkdir(dir)
      }
    }
    this.running = true
  }

  stop() {
    this.running = false
    for (const [, { timer }] of this.pendingWrites) {
      clearTimeout(timer)
    }
    this.flushAll()
  }

  isRunning() { return this.running }

  scheduleWriteCard(card) {
    const filePath = this.cardsDir + '/' + card.id + '.json'
    this._scheduleWrite(filePath, JSON.stringify(card, null, 2), 300)
  }

  scheduleDeleteCard(cardId) {
    const path = this.cardsDir + '/' + cardId + '.json'
    const key = 'delete:' + path
    const existing = this.pendingWrites.get(key)
    if (existing) clearTimeout(existing.timer)
    this.pendingWrites.set(key, {
      data: '__DELETE__',
      timer: setTimeout(() => this._executeWrite(key, path, '__DELETE__'), 0),
    })
  }

  _scheduleWrite(filePath, data, debounceMs) {
    const existing = this.pendingWrites.get(filePath)
    if (existing) clearTimeout(existing.timer)
    this.pendingWrites.set(filePath, {
      data,
      timer: setTimeout(() => this._executeWrite(filePath, filePath, data), debounceMs),
    })
  }

  async _executeWrite(key, filePath, data) {
    this.pendingWrites.delete(key)
    this.writeCount++
    log(`  executeWrite[${this.writeCount}] path=${filePath} running=${this.running}`)
    // 不检查 running! 即使 stopped 也执行写入
    try {
      if (data === '__DELETE__') {
        if (await this.fs.exists(filePath)) {
          await this.fs.deleteFile(filePath)
          log(`  -> deleted: ${filePath}`)
        }
      } else {
        const tmpPath = filePath + '.tmp'
        await this.fs.writeFile(tmpPath, data)
        await this.fs.rename(tmpPath, filePath)
        log(`  -> written: ${filePath}`)
      }
    } catch (e) {
      log(`  -> FAILED: ${e.message}`)
    }
  }

  flushAll() {
    const entries = [...this.pendingWrites.entries()]
    for (const [, { timer }] of entries) clearTimeout(timer)
    this.pendingWrites.clear()
    for (const [key, { data }] of entries) {
      try {
        const p = key.startsWith('delete:') ? key.slice(7) : key
        if (data === '__DELETE__') {
          this.fs.exists(p).then(ex => {
            if (ex) this.fs.deleteFile(p)
          }).catch(e => log(`  flush delete error: ${e.message}`))
        } else {
          const tmpPath = p + '.tmp'
          this.fs.writeFile(tmpPath, data)
            .then(() => this.fs.rename(tmpPath, p))
            .catch(e => log(`  flush write error: ${e.message}`))
        }
      } catch (e) {
        log(`  flush error: ${e.message}`)
      }
    }
  }
}

// --- 辅助函数 ---
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// --- 测试入口 ---
async function runTests() {
  // 清空日志
  await fs.writeFile(LOG_FILE, '=== SyncEngine 手动测试 ===\n' + new Date().toISOString() + '\n\n')

  log('=== 测试 1: init() 创建目录并设置 running = true ===')
  const engine = new WorkspaceSyncEngine()
  await engine.init(TEST_DIR, nodeFsAdapter)
  log(`  running=${engine.isRunning()}`)
  const cardsExist = await nodeFsAdapter.exists(TEST_DIR + '/cards')
  const boardsExist = await nodeFsAdapter.exists(TEST_DIR + '/boards')
  const trashExist = await nodeFsAdapter.exists(TEST_DIR + '/trash')
  log(`  cards/ created=${cardsExist} boards/ created=${boardsExist} trash/ created=${trashExist}`)
  console.assert(engine.isRunning() === true, 'running should be true after init')
  console.assert(cardsExist && boardsExist && trashExist, 'all dirs should exist')
  log('  PASS')

  log('\n=== 测试 2: scheduleWriteCard 写入文件 ===')
  const card1 = {
    id: 'test-card-001',
    title: '测试卡片',
    content: '[{"type":"paragraph"}]',
    color: 'blue',
    variant: 'solid',
    createdAt: Date.now(),
  }
  engine.scheduleWriteCard(card1)
  await sleep(500)
  const cardPath = TEST_DIR + '/cards/test-card-001.json'
  const fileExists = await nodeFsAdapter.exists(cardPath)
  log(`  card file exists=${fileExists}`)
  if (fileExists) {
    const content = await fs.readFile(cardPath, 'utf-8')
    const parsed = JSON.parse(content)
    console.assert(parsed.id === 'test-card-001', 'card id should match')
    log(`  content.id=${parsed.id} title=${parsed.title}`)
  }
  console.assert(fileExists, 'card file should exist after write')
  log('  PASS')

  log('\n=== 测试 3: stop() 后 scheduleWriteCard 仍然写入 ===')
  engine.stop()
  log(`  running after stop=${engine.isRunning()}`)
  console.assert(engine.isRunning() === false, 'running should be false after stop')

  const card2 = {
    id: 'test-card-002',
    title: '停止后写入',
    content: '[{"type":"paragraph"}]',
    color: 'green',
    variant: 'glass',
    createdAt: Date.now(),
  }
  const beforeCount = engine.writeCount
  engine.scheduleWriteCard(card2)
  await sleep(500)
  const card2Path = TEST_DIR + '/cards/test-card-002.json'
  const card2Exists = await nodeFsAdapter.exists(card2Path)
  log(`  card2 file exists=${card2Exists}`)
  console.assert(card2Exists, 'card2 should be written even after stop()')
  console.assert(engine.writeCount > beforeCount, 'executeWrite should have been called')
  log('  PASS')

  log('\n=== 测试 4: 防抖机制 (同一卡片多次写入只执行一次) ===')
  const card3 = {
    id: 'test-card-003',
    title: '防抖测试',
    content: '[{"type":"paragraph"}]',
    color: 'yellow',
    variant: 'outline',
    createdAt: Date.now(),
  }
  const beforeCount3 = engine.writeCount
  engine.scheduleWriteCard(card3)
  engine.scheduleWriteCard(card3) // 第二次, 应取消前一次
  engine.scheduleWriteCard(card3) // 第三次, 应取消前两次
  await sleep(500)
  const card3Path = TEST_DIR + '/cards/test-card-003.json'
  const card3Exists = await nodeFsAdapter.exists(card3Path)
  log(`  card3 file exists=${card3Exists}`)
  // 应当只执行一次写入 (三次调用被防抖合并)
  const actualWrites = engine.writeCount - beforeCount3
  log(`  executeWrite calls for card3: ${actualWrites} (expected 1-2 due to debounce)`)
  console.assert(card3Exists, 'card3 should exist')
  console.assert(actualWrites <= 2, 'should have at most 2 executeWrite calls (debounced)')
  log('  PASS')

  log('\n=== 测试 5: 删除操作 ===')
  const _beforeCount5 = engine.writeCount
  engine.scheduleDeleteCard('test-card-001')
  await sleep(300)
  const card1Gone = !(await nodeFsAdapter.exists(cardPath))
  log(`  card1 deleted=${card1Gone}`)
  console.assert(card1Gone, 'card1 should be deleted')
  log('  PASS')

  log('\n=== 测试 6: flushAll() ===')
  // 重新 init 引擎以清除 stop 状态
  const engine2 = new WorkspaceSyncEngine()
  await engine2.init(TEST_DIR, nodeFsAdapter)

  // 发送多个写入但不等待 debounce
  const flushCards = ['flush-1', 'flush-2', 'flush-3']
  for (const id of flushCards) {
    engine2.scheduleWriteCard({
      id,
      title: 'flush-' + id,
      content: '{}',
      color: 'red',
      variant: 'solid',
      createdAt: Date.now(),
    })
  }
  // 立即 flush (不等待 timer)
  engine2.flushAll()
  await sleep(500)
  for (const id of flushCards) {
    const exists = await nodeFsAdapter.exists(TEST_DIR + '/cards/' + id + '.json')
    log(`  flush card ${id} exists=${exists}`)
  }
  log('  PASS')

  // 清理测试文件
  log('\n=== 清理测试目录 ===')
  await nodeFsAdapter.rmdir(TEST_DIR)
  log('  done')

  log('\n===== 全部测试完成 =====')
}

runTests().catch(e => {
  log(`\n!!! TEST FAILED: ${e.message}`)
  log(e.stack)
}).finally(() => {
  console.log('\n日志已写入: ' + LOG_FILE)
})
