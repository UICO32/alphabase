# 卡片相关性检索设计

## 概述

为画布知识管理应用添加基于语义向量的卡片相关性检索功能。用户手动触发向量化，系统基于 jina v5 text nano 模型编码卡片内容为 256 维向量，存入 ZVec 进程内向量数据库，支持通过余弦相似度查询相关卡片。

## 技术选型

| 层级 | 选型 | 理由 |
|------|------|------|
| 向量数据库 | @zvec/zvec (native addon) | 进程内库，WAL 持久化，无服务依赖，HNSW 毫秒级查询 |
| Embedding 模型 | jina-embeddings-v5-text-nano | ~300MB VRAM，性能优先，首期仅文本 |
| 推理运行时 | ONNX Runtime (Node.js) | 本地推理，零网络延迟，Electron 主进程 native addon 兼容 |
| 文本格式 | Markdown | 保留标题/列表等语义结构，提升 embedding 质量 |
| 向量维度 | 256 (Matryoshka 截断自 1024) | 省 75% 存储，性能优先下精度够用 |

## 整体架构

```
渲染进程                                    主进程
────────                                    ──────
SystemSettings                              EmbeddingService
  [向量化全部卡片] ──IPC indexAll──▶         ├── ONNX Runtime
  进度条 ◀──IPC progress──                  │    └── jina v5 text nano
                                            └── ZVec Index
RightPanel                                        ├── 256维 cosine
  [相关] tab ──IPC search──▶                       └── WAL → workspace/.vectors/
  结果列表 ◀──IPC response──
```

进程模型：ZVec 和 ONNX 均为 native addon，运行在 Electron 主进程。渲染进程通过 `electronAPI.embedding.*` IPC 通道调用。

## 数据模型

### 索引文件存储

```
<workspace>/
  .vectors/
    index.zvec          # ZVec 主索引
    index.zvec.wal      # WAL 日志
    meta.json           # 索引元数据
```

### ZVec 索引结构

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | `card:<uuid>` |
| vector | Float32[256] | Matryoshka 截断后的向量 |
| metadata | object | `{ updatedAt, modality }` |

HNSW 参数：M=16, efConstruction=200, distance=cosine

### meta.json

```json
{
  "lastIndexedAt": "2026-05-24T10:30:00Z",
  "cardCount": 85,
  "modelId": "jina-embeddings-v5-text-nano",
  "dimensions": 256,
  "threshold": 0.75
}
```

## 文本提取

采用两步转换路径：BlockNote JSON → HTML → Markdown，复用现有 `renderBlocks.ts`（JSON→HTML）和 `turndown`（HTML→Markdown，项目已依赖）。

- 标题 → `# / ## / ###`
- 列表 → `- / 1.`
- 代码块 → ` ```lang `
- 引用 → `>`
- 加粗/斜体等 inline 样式保留
- 图片/文件 block → `[图片: alt]` 或忽略

若 `@blocknote/core` 提供内置 Markdown 序列化 API，优先使用（减少 turndown 的 HTML 中间层损失）。

## IPC 接口

### 渲染进程 → 主进程

| 通道 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `embedding:indexAll` | 无 | `{ started: true }` | 触发全量向量化，主进程自行从 workspace 读取 cards |
| `embedding:search` | `{ cardId: string, topK?: number }` | `{ results: Array<{ cardId, score }> }` | 查询相似卡片 |
| `embedding:cancel` | 无 | `{ cancelled: true }` | 取消进行中的向量化 |
| `embedding:getStatus` | 无 | `{ indexing, progress, total }` | 查询索引状态 |

### 主进程 → 渲染进程

| 通道 | 数据 | 说明 |
|------|------|------|
| `embedding:progress` | `{ current, total, cardId }` | 每完成一张卡片推送 |

关键行为：
- `indexAll` 异步执行，主进程立即返回，后台逐张处理并推送进度
- `search` 在索引未完成时仍可基于已有部分数据工作
- `cancel` 正在编码的当前卡片会完成，后续跳过

## 主进程模块

```
electron/
  embedding/
    EmbeddingService.ts    # 主服务，协调 ONNX + ZVec
    textExtractor.ts       # BlockNote JSON → Markdown
    preload.ts             # electronAPI.embedding.* 注册
```

### EmbeddingService

```
class EmbeddingService {
  onnxSession, zvecIndex, abortController, isIndexing

  async init(workspacePath)
    // 加载 ONNX 模型 + 打开/创建 ZVec 索引
    // 懒加载：首次 indexAll 或 search 时才 init
    // 模型文件从 workspace/.vectors/model.onnx 加载
    // 模型缺失时返回错误，由前端提示用户下载

  async indexAll(onProgress)
    // 自行从 workspacePath 读取 cards/ 目录
    // 逐张：readCardFile → extractMarkdown → encode → zvec.upsert
    // 每完成一张 → onProgress
    // 全部完成 → 更新 meta.json
    // 被取消 → 保留已完成部分

  async search(cardId, topK)
    // ZVec 取目标向量 → searchByVector → 过滤自身 + 低分

  async cancel()
  async dispose()
}
```

懒加载：模型和索引不在应用启动时加载，首次触发时才 init，日常不使用时零资源占用。

ONNX 编码：逐张处理（batch=1），1024 维输出 → Matryoshka 截断前 256 维 → L2 归一化。

## 前端 UI

### 设置页 - 向量索引分区

```
┌─────────────────────────────────────┐
│  向量索引                            │
│                                     │
│  状态: 未索引 / 已索引 (85 张卡片)    │
│                                     │
│  [向量化全部卡片]                    │
│                                     │
│  ████████░░░░░░  12/85 (14%)        │  ← 索引中显示
│  [取消]                             │  ← 索引中显示
│                                     │
│  上次索引: 2026-05-24 10:30          │  ← 已索引显示
│  相似度阈值: 0.75  [────●──────]    │
└─────────────────────────────────────┘
```

### 右侧面板 - 相关卡片筛选

顶部 tab 切换：[全部] [相关🔗]

- 选中"相关"且画布有选中卡片 → 调用 search → 列表按相似度降序排列
- 点击相关卡片 → 画布定位到对应节点
- 未选中卡片 → 提示"请在画布上选中一张卡片"
- 未索引 → 提示"请先在设置中向量化卡片"

## 模型文件管理

模型文件存储位置：`workspace/.vectors/model.onnx`

首次使用流程：
1. 用户点击"向量化全部卡片"
2. 主进程检测 `model.onnx` 是否存在
3. 不存在 → 返回错误 `{ modelMissing: true }`
4. 前端提示"需要下载嵌入模型（~300MB）"，提供下载按钮
5. 下载完成后重试向量化

模型下载来源：HuggingFace jinaai/jina-embeddings-v5 仓库的 ONNX 变体
下载后存放至 `workspace/.vectors/model.onnx`

> 注：首期实现可简化为手动放置模型文件到指定路径，自动下载作为后续优化

## 首期范围

### 交付

- EmbeddingService 主进程模块（ONNX + ZVec）
- electronAPI.embedding.* IPC 通道
- BlockNote JSON → Markdown 转换
- 设置页向量索引 UI（手动按钮 + 进度条 + 取消）
- 右侧面板"相关"tab 筛选
- 索引文件持久化到 workspace/.vectors/

### 不做

- 自动/实时增量索引（手动触发，测性能后再决定）
- 图片/PDF 多模态（首期仅文本）
- 画布虚线关联可视化
- 跨 workspace 检索

### 扩展预留

- ZVec metadata `modality` 字段，首期固定 `"text"`
- meta.json `modelId` 字段，后续切换模型时兼容
- IPC `embedding:indexIncremental` 增量接口预留
- 相似度阈值设置页可调，首期默认 0.75

## 关键决策记录

| 决策 | 结论 | 理由 |
|------|------|------|
| 进程模型 | 主进程 + IPC | ZVec/ONNX 均为 native addon，只能跑主进程 |
| 触发方式 | 手动按钮 | 性能优先，先测速度再决定是否实时 |
| 模型 | jina v5 text nano | 省 ~400MB VRAM，首期仅文本不需要多模态 |
| 文本格式 | Markdown | 保留语义结构，提升 embedding 质量 |
| 维度 | 256 | Matryoshka 截断，省 75% 存储 |
| 增量策略 | 首期全量 | 手动触发下全量最简单，字段预留增量 |
| 懒加载 | 首次使用时加载 | 不使用时零资源占用 |
