# Node.js CLI 设计文档

**日期**: 2026-05-21
**状态**: 已批准

## 目标

为 Heptabase Canvas v2 提供 Node.js 命令行接口，支持 AI 程序化调用和自动化测试。

## 架构决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 架构方案 | B-（最小提取） | 复用已有纯逻辑模块，不建独立 core 层 |
| CLI 位置 | 项目内 `src/cli/` | 共享 tsconfig 和依赖，复用最直接 |
| 工作区关联 | 每次指定 `--workspace <path>` | 无状态，AI 调用友好 |
| 并发安全 | 互斥锁（`.hepta-lock`） | 简单安全，防止 GUI/CLI 同时写入 |
| 输出格式 | JSON（`--pretty` 格式化） | 机器可读 |

## 复用链路

```
CLI 命令 → src/cli/commands/*.ts
         → CLIContext (封装生命周期)
         → WorkspaceService (直接复用，零 React 依赖)
         → WorkspaceSyncEngine (直接复用，零 React 依赖)
         → NodeFSAdapter (新建，用 fs/promises)
         → types.ts, cardConverter, renderBlocks (直接复用)
```

## 需要提取的逻辑

`cardStore` 中的 `ensurePreviewHTML()` → 提取为 `src/converters/previewHTML.ts` 的纯函数：

```typescript
export function generatePreviewHTML(card: CardFile): CardFile
```

这是唯一需要从 Zustand store 中提取的业务逻辑。

## 目录结构

```
src/
  cli/
    index.ts              ← CLI 入口（commander 注册）
    node-fs-adapter.ts    ← Node.js FSAdapter 实现
    lock.ts               ← 互斥锁
    context.ts            ← WorkspaceContext：封装 Service + SyncEngine 生命周期
    commands/
      workspace.ts        ← workspace:info, workspace:validate
      card.ts             ← card:list, card:get, card:create, card:update, card:delete, card:restore
      board.ts            ← board:list, board:get, board:create, board:rename, board:delete
      board-card.ts       ← board:add-card, board:remove-card
  converters/
    previewHTML.ts        ← 从 cardStore 提取的 generatePreviewHTML 纯函数
```

## 模块设计

### NodeFSAdapter

实现 `FSAdapter` 接口，用 `fs/promises`：

- `readFile` → `fsp.readFile(p, 'utf-8')`
- `writeFile` → `fsp.writeFile(p, data, 'utf-8')`
- `deleteFile` → `fsp.unlink(p)`
- `readdir` → `fsp.readdir(p)`
- `mkdir` → `fsp.mkdir(p, { recursive: true })`
- `stat` → `fsp.stat(p)`
- `exists` → `fsp.access(p)` + try/catch
- `rename` → `fsp.rename(from, to)`
- `rmdir` → `fsp.rm(p, { recursive: true })`

### 互斥锁

锁文件路径：`<workspace>/.hepta-lock`

锁文件内容（JSON）：
```json
{ "pid": 12345, "type": "gui" | "cli", "createdAt": 1716278400000 }
```

操作：
- `acquireLock(workspacePath)` — 检查锁文件 → 存在且进程存活则报错退出 → 不存在则创建
- `releaseLock(workspacePath)` — 删除锁文件
- `checkLock(workspacePath)` — 读取锁信息，进程已死则视为无锁

进程退出时自动释放（`process.on('exit')`）。

### CLIContext

```typescript
export interface CLIContext {
  workspacePath: string;
  service: WorkspaceService;
  syncEngine: WorkspaceSyncEngine;
}

export async function initContext(workspacePath: string): Promise<CLIContext>
export async function disposeContext(ctx: CLIContext): Promise<void>
```

`initContext` 流程：
1. `acquireLock(workspacePath)`
2. `setFSAdapter(createNodeFSAdapter())`
3. `new WorkspaceService(workspacePath)`
4. `new WorkspaceSyncEngine(workspacePath)` → `init()`
5. 返回 context

`disposeContext` 流程：
1. `syncEngine.flushAll()` + `syncEngine.stop()`
2. `releaseLock(workspacePath)`

### 命令实现模式

每个命令遵循统一模式：

```typescript
export async function listCards(workspacePath: string, options: Options): Promise<void> {
  const ctx = await initContext(workspacePath);
  try {
    const cards = await ctx.service.loadAllCards();
    const output = cards.map(formatCardSummary);
    printJSON(output, options.pretty);
  } finally {
    await disposeContext(ctx);
  }
}
```

写入类命令额外调用 `syncEngine.scheduleWrite*`，`disposeContext` 中的 `flushAll` 确保写入完成。

## 命令清单

所有命令都需要 `--workspace <path>` 参数。

### 工作区

| 命令 | 说明 | 输出 |
|------|------|------|
| `workspace:info` | 显示工作区元信息 | `{ name, cardCount, boardCount, trashCount, createdAt }` |
| `workspace:validate` | 验证数据一致性 | `{ valid, issues: string[] }` |

### 卡片

| 命令 | 说明 | 关键参数 | 输出 |
|------|------|----------|------|
| `card:list` | 列出所有卡片 | `--pretty` | `[{ id, title, createdAt, updatedAt }]` |
| `card:get <id>` | 读取卡片完整内容 | `--pretty` | `CardFile` |
| `card:create` | 创建卡片 | `--title`, `--content`, `--content-file` | `{ id, title }` |
| `card:update <id>` | 更新卡片（partial update，只更新指定字段） | `--title`, `--content`, `--content-file` | `{ id, title, updatedAt }` |
| `card:delete <id>` | 删除卡片（进回收站） | — | `{ id, deletedAt }` |
| `card:restore <id>` | 恢复卡片 | — | `{ id, restoredAt }` |

**card:create / card:update 内容输入**：
- `--content "纯文本"` → 自动转为单段落 BlockNote Block
- `--content-file ./card.json` → 读取 BlockNote JSON 格式（AI 调用友好）
- 两者互斥，同时指定则报错

### 画板

| 命令 | 说明 | 关键参数 | 输出 |
|------|------|----------|------|
| `board:list` | 列出所有画板 | `--pretty` | `[{ id, name, cardCount, createdAt }]` |
| `board:get <id>` | 查看画板详情 | `--pretty` | `{ id, name, nodes, edges }` |
| `board:create` | 创建画板 | `--name` | `{ id, name }` |
| `board:rename <id>` | 重命名画板 | `--name` | `{ id, name }` |
| `board:delete <id>` | 删除画板 | — | `{ id, deletedAt }` |

### 画板-卡片关联

| 命令 | 说明 | 关键参数 | 输出 |
|------|------|----------|------|
| `board:add-card <boardId> <cardId>` | 添加卡片到画板 | `--x`, `--y`（可选，默认自动放置） | `{ boardId, cardId, x, y }` |
| `board:remove-card <boardId> <cardId>` | 从画板移除卡片 | — | `{ boardId, cardId }` |

**board:add-card 坐标处理**：
- 不指定 `--x --y` → 自动放置：找到画板现有节点的右下角空白位置，间距 50px
- 指定 `--x 100 --y 200` → 精确放置

## 输出格式

- 成功：JSON 输出到 stdout
- 错误：JSON 输出到 stderr，格式 `{ "error": "ErrorCode", "message": "描述" }`
- `--pretty` 选项：格式化 JSON（2 空格缩进）
- 退出码：0 成功，1 一般错误，2 参数错误，3 锁冲突

## 依赖

新增依赖：
- `commander` — CLI 框架

无需额外依赖——`WorkspaceService`、`SyncEngine`、类型定义、转换器均已在项目中。

## 不做的事

- 不支持交互式模式（第一版纯命令式）
- 不支持搜索（需要全文索引，超出范围）
- 不支持导出（独立功能，后续迭代）
- 不处理 flomo 同步（依赖 Electron IPC）
- 不修改 GUI 代码（锁机制除外）
