#!/usr/bin/env node
/**
 * 工作区引用完整性检查（零依赖）。
 *
 * 检查画板快照、卡片、媒体、项目元数据之间的引用是否成立：
 * - manifest 登记的画板是否有快照文件；目录里未登记的孤儿快照单独列出
 * - 快照里的卡片节点是否指向存在的卡片；边是否指向存在的节点；节点 id 是否重复
 * - 媒体引用（hepta-media://）是否指向 media/ 下存在的文件
 * - 项目成果（outcomes）是否指向对应画板里存在的节点
 * - _metadata.json 的计数是否与磁盘一致
 *
 * 用法：
 *   node scripts/verify-workspace-integrity.mjs <workspace-path> [--json]
 *
 * 退出码：0 = 没有错误（可能有警告）；1 = 存在断链等错误；2 = 工作区不可读。
 */
import { readFile, readdir, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const MEDIA_PROTOCOL = 'hepta-media://'
const args = process.argv.slice(2)
const jsonOutput = args.includes('--json')
const workspaceArg = args.find(arg => !arg.startsWith('--'))

if (!workspaceArg) {
  console.error('用法: node scripts/verify-workspace-integrity.mjs <workspace-path> [--json]')
  process.exit(2)
}

const workspacePath = resolve(workspaceArg)

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return null
  }
}

async function listFiles(dir, filter) {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries.filter(entry => entry.isFile() && filter(entry.name)).map(entry => entry.name)
  } catch {
    return []
  }
}

function parseMediaRefs(value) {
  const refs = []
  if (typeof value !== 'string') return refs
  let index = value.indexOf(MEDIA_PROTOCOL)
  while (index !== -1) {
    const rest = value.slice(index + MEDIA_PROTOCOL.length)
    const end = rest.search(/[\s"'()<>]/)
    const token = end === -1 ? rest : rest.slice(0, end)
    const withoutQuery = token.split('?')[0]
    const slash = withoutQuery.indexOf('/')
    if (slash > 0) {
      // 新格式：hepta-media://<mediaId>/<fileName>
      try {
        refs.push({
          mediaId: decodeURIComponent(withoutQuery.slice(0, slash)),
          name: decodeURIComponent(withoutQuery.slice(slash + 1)),
        })
      } catch {
        refs.push({ mediaId: withoutQuery.slice(0, slash), name: withoutQuery.slice(slash + 1) })
      }
    } else if (withoutQuery) {
      // 旧格式：hepta-media://<fileName>?workspace=...（hostname 就是文件名）
      try {
        refs.push({ mediaId: decodeURIComponent(withoutQuery), name: decodeURIComponent(withoutQuery) })
      } catch {
        refs.push({ mediaId: withoutQuery, name: withoutQuery })
      }
    }
    index = value.indexOf(MEDIA_PROTOCOL, index + MEDIA_PROTOCOL.length)
  }
  return refs
}

function collectMediaRefs(value, sink) {
  if (typeof value === 'string') {
    for (const ref of parseMediaRefs(value)) sink.push(ref)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectMediaRefs(item, sink)
    return
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectMediaRefs(item, sink)
  }
}

const report = {
  workspacePath,
  cards: { files: 0, unparsable: [] },
  boards: { manifest: [], snapshots: {}, orphans: [] },
  media: { files: 0, missingRefs: [], unreferenced: [] },
  projects: { files: 0, brokenOutcomes: [] },
  metadata: { declared: null, actual: null, mismatch: false },
  errors: [],
  warnings: [],
}

function fail(message) {
  report.errors.push(message)
}

function warn(message) {
  report.warnings.push(message)
}

async function main() {
  const workspaceStat = await stat(workspacePath).catch(() => null)
  if (!workspaceStat?.isDirectory()) {
    console.error(`工作区不可读：${workspacePath}`)
    process.exit(2)
  }

  // ── 卡片 ──
  const cardFiles = await listFiles(join(workspacePath, 'cards'), name => name.endsWith('.json'))
  report.cards.files = cardFiles.length
  const cardIds = new Set()
  for (const file of cardFiles) {
    const card = await readJson(join(workspacePath, 'cards', file))
    if (!card || typeof card.id !== 'string') {
      report.cards.unparsable.push(file)
      fail(`卡片文件不可解析或缺少 id：cards/${file}`)
      continue
    }
    if (card.id !== file.replace(/\.json$/, '')) {
      warn(`卡片 id 与文件名不一致：cards/${file} (id=${card.id})`)
    }
    cardIds.add(card.id)
  }

  // ── 媒体 ──
  const mediaFiles = await listFiles(join(workspacePath, 'media'), () => true)
  report.media.files = mediaFiles.length
  const mediaFileSet = new Set(mediaFiles)
  const referencedMedia = new Set()

  // ── 画板快照 ──
  const boardFiles = await listFiles(join(workspacePath, 'boards'), name => name.endsWith('.json'))
  const manifest = await readJson(join(workspacePath, 'boards', '_manifest.json'))
  const manifestBoards = Array.isArray(manifest?.boards) ? manifest.boards : []
  report.boards.manifest = manifestBoards.map(board => board.id)
  if (!manifest) fail('boards/_manifest.json 缺失或不可解析')

  for (const board of manifestBoards) {
    if (typeof board.id !== 'string') {
      fail('_manifest.json 存在缺少 id 的画板条目')
      continue
    }
    if (!boardFiles.includes(`${board.id}.json`)) {
      fail(`manifest 登记的画板缺少快照文件：boards/${board.id}.json`)
    }
  }

  const projectFiles = await listFiles(join(workspacePath, 'projects'), name => name.endsWith('.json'))
  report.projects.files = projectFiles.length
  const projectData = new Map()
  for (const file of projectFiles) {
    const data = await readJson(join(workspacePath, 'projects', file))
    if (!data) {
      fail(`项目元数据不可解析：projects/${file}`)
      continue
    }
    projectData.set(file.replace(/\.json$/, ''), data)
  }

  for (const file of boardFiles) {
    if (file === '_manifest.json') continue
    const boardId = file.replace(/\.json$/, '')
    const snapshot = await readJson(join(workspacePath, 'boards', file))
    if (!snapshot) {
      fail(`画板快照不可解析：boards/${file}`)
      continue
    }
    const nodes = Array.isArray(snapshot.nodes) ? snapshot.nodes : []
    const edges = Array.isArray(snapshot.edges) ? snapshot.edges : []
    const nodeIds = new Set()
    const duplicateNodeIds = []
    let missingCards = 0

    for (const node of nodes) {
      if (typeof node?.id !== 'string') {
        fail(`画板 ${boardId} 存在缺少 id 的节点`)
        continue
      }
      if (nodeIds.has(node.id)) duplicateNodeIds.push(node.id)
      nodeIds.add(node.id)

      if (node.type === 'card') {
        const cardId = node.data?.cardId
        if (typeof cardId !== 'string') {
          fail(`画板 ${boardId} 的卡片节点 ${node.id} 缺少 cardId`)
        } else if (!cardIds.has(cardId)) {
          missingCards += 1
          fail(`画板 ${boardId} 的卡片节点 ${node.id} 指向不存在的卡片 ${cardId}`)
        }
      }

      const nodeMediaRefs = []
      collectMediaRefs(node.data, nodeMediaRefs)
      for (const ref of nodeMediaRefs) {
        referencedMedia.add(ref.name)
        if (!mediaFileSet.has(ref.name)) {
          report.media.missingRefs.push({ boardId, nodeId: node.id, ...ref })
          fail(`画板 ${boardId} 节点 ${node.id} 引用的媒体文件不存在：media/${ref.name}`)
        }
      }
    }

    if (duplicateNodeIds.length > 0) {
      fail(`画板 ${boardId} 存在重复节点 id：${[...new Set(duplicateNodeIds)].join(', ')}`)
    }

    let brokenEdges = 0
    for (const edge of edges) {
      if (!nodeIds.has(edge?.source) || !nodeIds.has(edge?.target)) {
        brokenEdges += 1
        fail(`画板 ${boardId} 的边 ${edge?.id} 指向不存在的节点（${edge?.source} -> ${edge?.target}）`)
      }
    }

    const project = projectData.get(boardId)
    if (project) {
      for (const outcome of project.outcomes ?? []) {
        if (!nodeIds.has(outcome.nodeId)) {
          report.projects.brokenOutcomes.push({ boardId, outcomeId: outcome.id, nodeId: outcome.nodeId })
          fail(`项目 ${boardId} 的成果 ${outcome.id} 指向不存在的节点 ${outcome.nodeId}`)
        }
      }
    }

    report.boards.snapshots[boardId] = {
      registered: report.boards.manifest.includes(boardId),
      nodes: nodes.length,
      edges: edges.length,
      missingCards,
      brokenEdges,
      projectFile: project ? true : false,
    }

    if (!report.boards.manifest.includes(boardId)) {
      report.boards.orphans.push(boardId)
      warn(`未登记在 manifest 的孤儿快照：boards/${file}（${nodes.length} 节点 / ${edges.length} 边）`)
    }
  }

  // 卡片正文里的媒体引用
  for (const file of cardFiles) {
    const card = await readJson(join(workspacePath, 'cards', file))
    if (!card) continue
    const refs = []
    collectMediaRefs(card.content, refs)
    for (const ref of refs) {
      referencedMedia.add(ref.name)
      if (!mediaFileSet.has(ref.name)) {
        report.media.missingRefs.push({ cardId: card.id, ...ref })
        fail(`卡片 ${card.id} 引用的媒体文件不存在：media/${ref.name}`)
      }
    }
  }

  report.media.unreferenced = mediaFiles.filter(name => !referencedMedia.has(name))
  if (report.media.unreferenced.length > 0) {
    warn(`${report.media.unreferenced.length} 个媒体文件没有被任何卡片或画板引用（可能来自旧版本或已删除内容）`)
  }

  // ── 元数据 ──
  const metadata = await readJson(join(workspacePath, '_metadata.json'))
  report.metadata.actual = { cardCount: cardFiles.length, boardCount: report.boards.manifest.length }
  if (metadata) {
    report.metadata.declared = { cardCount: metadata.cardCount, boardCount: metadata.boardCount }
    if (metadata.cardCount !== cardFiles.length || metadata.boardCount !== report.boards.manifest.length) {
      report.metadata.mismatch = true
      warn(`_metadata.json 计数与磁盘不一致：声明 ${metadata.cardCount} 卡 / ${metadata.boardCount} 板，实际 ${cardFiles.length} 卡 / ${report.boards.manifest.length} 板`)
    }
  } else {
    warn('_metadata.json 缺失或不可解析')
  }
}

await main()

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2))
} else {
  const snapshotCount = Object.keys(report.boards.snapshots).length
  console.log(`工作区：${report.workspacePath}`)
  console.log(`卡片：${report.cards.files} 个文件，不可解析 ${report.cards.unparsable.length}`)
  console.log(`画板：manifest 登记 ${report.boards.manifest.length}，快照 ${snapshotCount}，孤儿 ${report.boards.orphans.length}`)
  if (report.boards.orphans.length > 0) console.log(`  孤儿快照：${report.boards.orphans.join(', ')}`)
  console.log(`媒体：${report.media.files} 个文件，断链引用 ${report.media.missingRefs.length}，未被引用 ${report.media.unreferenced.length}`)
  console.log(`项目：${report.projects.files} 个文件，断链成果 ${report.projects.brokenOutcomes.length}`)
  for (const message of report.warnings) console.log(`[警告] ${message}`)
  for (const message of report.errors) console.log(`[错误] ${message}`)
  console.log(report.errors.length === 0 ? '结论：引用完整性通过' : `结论：发现 ${report.errors.length} 处引用错误`)
}

process.exit(report.errors.length === 0 ? 0 : 1)
