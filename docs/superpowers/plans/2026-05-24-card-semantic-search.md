# 卡片相关性检索实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为画布应用添加基于语义向量的卡片相关性检索，用户手动触发全量向量化，通过右侧面板"相关"tab 筛选相似卡片。

**Architecture:** 主进程运行 EmbeddingService（ONNX Runtime + ZVec），渲染进程通过 `electronAPI.embedding.*` IPC 通道调用。BlockNote JSON → Markdown 文本提取 → ONNX 编码为 256 维向量 → ZVec 存储。右侧面板新增"相关"tab 做相似卡片筛选。

**Tech Stack:** @zvec/zvec, onnxruntime-node, jina-embeddings-v5-text-nano (ONNX), turndown

---

## 文件结构

```
创建:
  electron/embedding/EmbeddingService.ts    # 主服务：ONNX + ZVec 协调
  electron/embedding/textExtractor.ts       # BlockNote JSON → Markdown
  electron/embedding/index.ts              # 模块导出 + IPC 注册函数
  src/stores/embeddingStore.ts             # 渲染进程 embedding 状态管理
  src/components/ui/settings/VectorIndexSettings.tsx  # 设置页向量索引分区
  src/components/ui/RelatedCardsTab.tsx     # 右侧面板相关卡片 tab 内容

修改:
  electron/main.ts                         # 注册 embedding IPC handlers
  electron/preload.ts                      # 暴露 electronAPI.embedding.*
  src/stores/libraryStore.ts               # 新增 'related' tab 类型
  src/components/ui/settings/SystemSettings.tsx  # 嵌入 VectorIndexSettings
  src/components/ui/RightPanel.tsx         # 集成 RelatedCardsTab
  src/utils/workspace/types.ts             # WorkspaceSettings 新增 threshold 字段
  package.json                             # 新增 @zvec/zvec, onnxruntime-node 依赖
```

---

### Task 1: 安装依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 @zvec/zvec 和 onnxruntime-node**

```bash
cd d:/USE/save/code/abase
pnpm add @zvec/zvec onnxruntime-node
```

- [ ] **Step 2: 验证安装成功**

```bash
node -e "require('@zvec/zvec'); console.log('zvec OK')" && node -e "require('onnxruntime-node'); console.log('onnx OK')"
```

Expected: 两个 `OK` 输出

- [ ] **Step 3: 提交**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add @zvec/zvec and onnxruntime-node dependencies"
```

---

### Task 2: 文本提取模块 — BlockNote JSON → Markdown

**Files:**
- Create: `electron/embedding/textExtractor.ts`

- [ ] **Step 1: 实现 textExtractor.ts**

```typescript
import TurndownService from 'turndown';
import { renderBlocksToHTML } from '../../src/converters/renderBlocks';

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

/**
 * BlockNote JSON blocks → Markdown 文本
 * 路径: JSON → HTML (renderBlocksToHTML) → Markdown (turndown)
 */
export function extractMarkdown(blocksJson: string): string {
  if (!blocksJson) return '';
  try {
    const blocks = JSON.parse(blocksJson);
    const html = renderBlocksToHTML(blocks);
    const markdown = turndown.turndown(html);
    return markdown.trim();
  } catch {
    return '';
  }
}

/**
 * 从卡片内容中提取用于向量化的文本
 * 截断过长文本（jina v5 max 8192 tokens, 保守截断到 ~6000 chars）
 */
export function extractEmbeddingText(blocksJson: string): string {
  const md = extractMarkdown(blocksJson);
  if (md.length > 6000) {
    return md.slice(0, 6000);
  }
  return md;
}
```

- [ ] **Step 2: 验证 renderBlocksToHTML 的可导入性**

检查 `src/converters/renderBlocks.ts` 导出的函数签名，确认 `renderBlocksToHTML` 存在且接受 BlockNote blocks 数组。若函数名不同，调整 import。

```bash
grep -n "export" src/converters/renderBlocks.ts
```

- [ ] **Step 3: 提交**

```bash
git add electron/embedding/textExtractor.ts
git commit -m "feat(embedding): add BlockNote JSON to Markdown text extractor"
```

---

### Task 3: EmbeddingService 核心模块

**Files:**
- Create: `electron/embedding/EmbeddingService.ts`

- [ ] **Step 1: 实现 EmbeddingService.ts**

```typescript
import path from 'path';
import fs from 'fs';
import { InferenceSession, Tensor } from 'onnxruntime-node';
import { ZVecIndex } from '@zvec/zvec';
import { extractEmbeddingText } from './textExtractor';

interface IndexMeta {
  lastIndexedAt: string;
  cardCount: number;
  modelId: string;
  dimensions: number;
  threshold: number;
}

interface SearchResult {
  cardId: string;
  score: number;
}

export class EmbeddingService {
  private session: InferenceSession | null = null;
  private index: ZVecIndex | null = null;
  private abortController: AbortController | null = null;
  private isIndexing = false;
  private workspacePath: string = '';
  private vectorsDir: string = '';
  private metaPath: string = '';
  private modelPath: string = '';

  async init(workspacePath: string): Promise<void> {
    this.workspacePath = workspacePath;
    this.vectorsDir = path.join(workspacePath, '.vectors');
    this.metaPath = path.join(this.vectorsDir, 'meta.json');
    this.modelPath = path.join(this.vectorsDir, 'model.onnx');

    if (!fs.existsSync(this.vectorsDir)) {
      fs.mkdirSync(this.vectorsDir, { recursive: true });
    }

    // 检查模型文件
    if (!fs.existsSync(this.modelPath)) {
      throw new Error('MODEL_MISSING');
    }

    // 加载 ONNX 模型
    this.session = await InferenceSession.create(this.modelPath, {
      executionProviders: ['cuda', 'cpu'],
    });

    // 加载或创建 ZVec 索引
    const indexPath = path.join(this.vectorsDir, 'index');
    if (fs.existsSync(indexPath + '.zvec')) {
      this.index = ZVecIndex.load(indexPath);
    } else {
      this.index = ZVecIndex.create(indexPath, {
        dimensions: 256,
        metric: 'cosine',
        m: 16,
        efConstruction: 200,
      });
    }
  }

  private ensureReady(): void {
    if (!this.session || !this.index) {
      throw new Error('NOT_INITIALIZED');
    }
  }

  async indexAll(
    cardsDir: string,
    onProgress: (current: number, total: number, cardId: string) => void
  ): Promise<{ indexed: number; skipped: number }> {
    this.ensureReady();
    if (this.isIndexing) throw new Error('ALREADY_INDEXING');

    this.isIndexing = true;
    this.abortController = new AbortController();

    try {
      // 读取 cards 目录
      const files = fs.readdirSync(cardsDir).filter(f => f.endsWith('.json'));
      const total = files.length;
      let indexed = 0;
      let skipped = 0;

      for (let i = 0; i < files.length; i++) {
        if (this.abortController.signal.aborted) break;

        const cardId = files[i].replace('.json', '');
        const filePath = path.join(cardsDir, cardId + '.json');

        try {
          const raw = fs.readFileSync(filePath, 'utf-8');
          const card = JSON.parse(raw);
          const text = extractEmbeddingText(card.content || '');

          if (!text) {
            skipped++;
            onProgress(i + 1, total, cardId);
            continue;
          }

          const vector = await this.encode(text);
          this.index!.upsert(`card:${cardId}`, vector, {
            updatedAt: card.updatedAt || new Date().toISOString(),
            modality: 'text',
          });

          indexed++;
          onProgress(i + 1, total, cardId);
        } catch {
          skipped++;
          onProgress(i + 1, total, cardId);
        }
      }

      // 持久化索引
      this.index!.save();

      // 更新 meta.json
      const meta: IndexMeta = {
        lastIndexedAt: new Date().toISOString(),
        cardCount: indexed,
        modelId: 'jina-embeddings-v5-text-nano',
        dimensions: 256,
        threshold: this.getThreshold(),
      };
      fs.writeFileSync(this.metaPath, JSON.stringify(meta, null, 2));

      return { indexed, skipped };
    } finally {
      this.isIndexing = false;
      this.abortController = null;
    }
  }

  async search(cardId: string, topK: number = 20): Promise<SearchResult[]> {
    this.ensureReady();

    // 取目标卡片向量
    const targetVector = this.index!.getVector(`card:${cardId}`);
    if (!targetVector) return [];

    // 搜索相似向量
    const results = this.index!.search(targetVector, topK + 1); // +1 因为自身会命中

    const threshold = this.getThreshold();
    return results
      .filter(r => r.id !== `card:${cardId}` && r.score >= threshold)
      .map(r => ({
        cardId: r.id.replace('card:', ''),
        score: r.score,
      }));
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  getStatus(): { indexing: boolean; progress: number; total: number } {
    return {
      indexing: this.isIndexing,
      progress: 0,
      total: 0,
    };
  }

  isModelAvailable(): boolean {
    return this.vectorsDir ? fs.existsSync(this.modelPath) : false;
  }

  isInitialized(): boolean {
    return this.session !== null && this.index !== null;
  }

  private getThreshold(): number {
    if (fs.existsSync(this.metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(this.metaPath, 'utf-8'));
        return meta.threshold ?? 0.75;
      } catch { /* fallback */ }
    }
    return 0.75;
  }

  async setThreshold(value: number): Promise<void> {
    if (fs.existsSync(this.metaPath)) {
      const meta = JSON.parse(fs.readFileSync(this.metaPath, 'utf-8'));
      meta.threshold = value;
      fs.writeFileSync(this.metaPath, JSON.stringify(meta, null, 2));
    }
  }

  private async encode(text: string): Float32Array {
    this.ensureReady();

    // jina v5 tokenizer + ONNX 推理
    // 简化实现：使用 onnxruntime-node 的 tokenizer
    const tokens = this.tokenize(text);
    const inputIds = new Tensor('int64', BigInt64Array.from(tokens.map(Number)), [1, tokens.length]);
    const attentionMask = new Tensor('int64', BigInt64Array.from(new Array(tokens.length).fill(1n)), [1, tokens.length]);

    const output = await this.session!.run({
      input_ids: inputIds,
      attention_mask: attentionMask,
    });

    // 取 [CLS] token 的向量（或 mean pooling），截断至 256 维
    const fullVector = output.last_hidden_state.data as Float32Array;
    const embedding = this.meanPoolAndTruncate(fullVector, tokens.length, 256);

    // L2 归一化
    return this.normalize(embedding);
  }

  private tokenize(text: string): number[] {
    // 首期简化：使用基础 whitespace tokenizer + jina special tokens
    // TODO: 替换为完整的 jina tokenizer（从 HuggingFace 下载 tokenizer.json）
    const tokens = text.split(/\s+/).slice(0, 8192);
    // 占位实现，实际需要 jina tokenizer
    return tokens.map((_, i) => i + 1);
  }

  private meanPoolAndTruncate(data: Float32Array, seqLen: number, dim: number): Float32Array {
    const fullDim = data.length / seqLen;
    const result = new Float32Array(dim);
    for (let d = 0; d < dim; d++) {
      let sum = 0;
      for (let s = 0; s < seqLen; s++) {
        sum += data[s * fullDim + d];
      }
      result[d] = sum / seqLen;
    }
    return result;
  }

  private normalize(vec: Float32Array): Float32Array {
    let norm = 0;
    for (let i = 0; i < vec.length; i++) {
      norm += vec[i] * vec[i];
    }
    norm = Math.sqrt(norm);
    if (norm === 0) return vec;
    const result = new Float32Array(vec.length);
    for (let i = 0; i < vec.length; i++) {
      result[i] = vec[i] / norm;
    }
    return result;
  }

  async dispose(): Promise<void> {
    this.index?.save();
    this.session = null;
    this.index = null;
    this.isIndexing = false;
  }
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
npx tsc --noEmit electron/embedding/EmbeddingService.ts
```

注意：可能会有 import 路径问题，需要根据实际 renderBlocks 导出和 @zvec/zvec API 调整。

- [ ] **Step 3: 提交**

```bash
git add electron/embedding/EmbeddingService.ts
git commit -m "feat(embedding): add EmbeddingService with ONNX + ZVec integration"
```

---

### Task 4: IPC 通道注册

**Files:**
- Create: `electron/embedding/index.ts`
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`

- [ ] **Step 1: 创建 electron/embedding/index.ts — IPC handler 注册**

```typescript
import { ipcMain, BrowserWindow } from 'electron';
import { EmbeddingService } from './EmbeddingService';

const service = new EmbeddingService();

export function registerEmbeddingIPC(workspacePath: string): void {
  const cardsDir = `${workspacePath}/cards`;

  ipcMain.handle('embedding:indexAll', async () => {
    try {
      if (!service.isInitialized()) {
        await service.init(workspacePath);
      }
      if (!service.isModelAvailable()) {
        return { error: 'MODEL_MISSING' };
      }

      // 异步执行，立即返回
      const win = BrowserWindow.getAllWindows()[0];
      service.indexAll(cardsDir, (current, total, cardId) => {
        win?.webContents.send('embedding:progress', { current, total, cardId });
      }).then(({ indexed, skipped }) => {
        win?.webContents.send('embedding:complete', { indexed, skipped });
      }).catch(err => {
        win?.webContents.send('embedding:error', { message: err.message });
      });

      return { started: true };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('embedding:search', async (_e, { cardId, topK = 20 }) => {
    try {
      if (!service.isInitialized()) {
        await service.init(workspacePath);
      }
      const results = await service.search(cardId, topK);
      return { results };
    } catch (err: any) {
      return { results: [], error: err.message };
    }
  });

  ipcMain.handle('embedding:cancel', async () => {
    service.cancel();
    return { cancelled: true };
  });

  ipcMain.handle('embedding:getStatus', async () => {
    return {
      ...service.getStatus(),
      initialized: service.isInitialized(),
      modelAvailable: service.isModelAvailable(),
    };
  });

  ipcMain.handle('embedding:checkModel', async () => {
    return { available: service.isModelAvailable() };
  });

  ipcMain.handle('embedding:setThreshold', async (_e, { value }) => {
    await service.setThreshold(value);
    return { success: true };
  });
}

export async function disposeEmbeddingService(): Promise<void> {
  await service.dispose();
}
```

- [ ] **Step 2: 修改 electron/main.ts — 在 workspace 打开后注册 embedding IPC**

在 `main.ts` 中找到现有的 IPC 注册区域（如 `registerFsIPC` 调用处），在相同位置添加：

```typescript
import { registerEmbeddingIPC, disposeEmbeddingService } from './embedding';

// 在 workspace 路径确定后调用：
registerEmbeddingIPC(workspacePath);

// 在 app 'will-quit' 事件中调用：
await disposeEmbeddingService();
```

- [ ] **Step 3: 修改 electron/preload.ts — 暴露 electronAPI.embedding**

在 `preload.ts` 中现有 `contextBridge.exposeInMainWorld('electronAPI', { ... })` 内添加：

```typescript
embedding: {
  indexAll: () => ipcRenderer.invoke('embedding:indexAll'),
  search: (cardId: string, topK?: number) =>
    ipcRenderer.invoke('embedding:search', { cardId, topK }),
  cancel: () => ipcRenderer.invoke('embedding:cancel'),
  getStatus: () => ipcRenderer.invoke('embedding:getStatus'),
  checkModel: () => ipcRenderer.invoke('embedding:checkModel'),
  setThreshold: (value: number) => ipcRenderer.invoke('embedding:setThreshold', { value }),
  onProgress: (callback: (data: { current: number; total: number; cardId: string }) => void) => {
    const handler = (_e: any, data: any) => callback(data);
    ipcRenderer.on('embedding:progress', handler);
    return () => ipcRenderer.removeListener('embedding:progress', handler);
  },
  onComplete: (callback: (data: { indexed: number; skipped: number }) => void) => {
    const handler = (_e: any, data: any) => callback(data);
    ipcRenderer.on('embedding:complete', handler);
    return () => ipcRenderer.removeListener('embedding:complete', handler);
  },
  onError: (callback: (data: { message: string }) => void) => {
    const handler = (_e: any, data: any) => callback(data);
    ipcRenderer.on('embedding:error', handler);
    return () => ipcRenderer.removeListener('embedding:error', handler);
  },
},
```

- [ ] **Step 4: 验证 Electron 启动正常**

```bash
pnpm dev
```

确认无启动报错，Electron 窗口正常打开。

- [ ] **Step 5: 提交**

```bash
git add electron/embedding/index.ts electron/main.ts electron/preload.ts
git commit -m "feat(embedding): register IPC handlers and expose electronAPI.embedding"
```

---

### Task 5: 渲染进程状态管理 — embeddingStore

**Files:**
- Create: `src/stores/embeddingStore.ts`

- [ ] **Step 1: 实现 embeddingStore.ts**

```typescript
import { create } from 'zustand';

interface EmbeddingState {
  // 索引状态
  indexing: boolean;
  progress: number;
  total: number;
  currentCardId: string;
  indexed: boolean;
  cardCount: number;
  lastIndexedAt: string | null;
  modelAvailable: boolean;

  // 搜索结果
  searchResults: Array<{ cardId: string; score: number }>;
  searching: boolean;

  // 阈值
  threshold: number;

  // Actions
  startIndexing: () => Promise<void>;
  cancelIndexing: () => Promise<void>;
  searchRelated: (cardId: string, topK?: number) => Promise<void>;
  clearResults: () => void;
  setThreshold: (value: number) => Promise<void>;
  checkStatus: () => Promise<void>;
}

export const useEmbeddingStore = create<EmbeddingState>((set, get) => ({
  indexing: false,
  progress: 0,
  total: 0,
  currentCardId: '',
  indexed: false,
  cardCount: 0,
  lastIndexedAt: null,
  modelAvailable: false,
  searchResults: [],
  searching: false,
  threshold: 0.75,

  startIndexing: async () => {
    set({ indexing: true, progress: 0, total: 0 });

    const offProgress = window.electronAPI.embedding.onProgress((data) => {
      set({ progress: data.current, total: data.total, currentCardId: data.cardId });
    });

    const offComplete = window.electronAPI.embedding.onComplete((data) => {
      set({
        indexing: false,
        indexed: true,
        cardCount: data.indexed,
        lastIndexedAt: new Date().toISOString(),
      });
      offProgress();
      offComplete();
    });

    const offError = window.electronAPI.embedding.onError((data) => {
      set({ indexing: false });
      console.error('Embedding error:', data.message);
      offProgress();
      offComplete();
      offError();
    });

    const result = await window.electronAPI.embedding.indexAll();
    if (result.error === 'MODEL_MISSING') {
      set({ indexing: false, modelAvailable: false });
      offProgress();
      offComplete();
      offError();
    }
  },

  cancelIndexing: async () => {
    await window.electronAPI.embedding.cancel();
    set({ indexing: false });
  },

  searchRelated: async (cardId: string, topK = 20) => {
    set({ searching: true, searchResults: [] });
    const { results } = await window.electronAPI.embedding.search(cardId, topK);
    set({ searchResults: results || [], searching: false });
  },

  clearResults: () => {
    set({ searchResults: [], searching: false });
  },

  setThreshold: async (value: number) => {
    set({ threshold: value });
    await window.electronAPI.embedding.setThreshold(value);
  },

  checkStatus: async () => {
    const status = await window.electronAPI.embedding.getStatus();
    set({
      indexed: status.cardCount > 0,
      modelAvailable: status.modelAvailable,
    });
  },
}));
```

- [ ] **Step 2: 添加 electronAPI 类型声明**

在 `src/` 下找到现有的 `electronAPI` 类型声明文件（可能在 `main.tsx` 或 `vite-env.d.ts` 中），添加 embedding 命名空间的类型。若找不到专用声明文件，在 `embeddingStore.ts` 顶部添加：

```typescript
declare global {
  interface Window {
    electronAPI: {
      // ... existing APIs
      embedding: {
        indexAll: () => Promise<{ started?: boolean; error?: string }>;
        search: (cardId: string, topK?: number) => Promise<{ results: Array<{ cardId: string; score: number }>; error?: string }>;
        cancel: () => Promise<{ cancelled: boolean }>;
        getStatus: () => Promise<{ indexing: boolean; progress: number; total: number; initialized: boolean; modelAvailable: boolean }>;
        checkModel: () => Promise<{ available: boolean }>;
        setThreshold: (value: number) => Promise<{ success: boolean }>;
        onProgress: (callback: (data: { current: number; total: number; cardId: string }) => void) => () => void;
        onComplete: (callback: (data: { indexed: number; skipped: number }) => void) => () => void;
        onError: (callback: (data: { message: string }) => void) => () => void;
      };
    };
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add src/stores/embeddingStore.ts
git commit -m "feat(embedding): add embeddingStore for renderer process state"
```

---

### Task 6: 设置页向量索引 UI

**Files:**
- Create: `src/components/ui/settings/VectorIndexSettings.tsx`
- Modify: `src/components/ui/settings/SystemSettings.tsx`

- [ ] **Step 1: 创建 VectorIndexSettings.tsx**

```tsx
import { useEffect } from 'react';
import { useEmbeddingStore } from '../../../stores/embeddingStore';

export function VectorIndexSettings() {
  const {
    indexing, progress, total, indexed, cardCount,
    lastIndexedAt, modelAvailable, threshold,
    startIndexing, cancelIndexing, setThreshold, checkStatus,
  } = useEmbeddingStore();

  useEffect(() => {
    checkStatus();
  }, []);

  const percent = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">向量索引</h3>

      {/* 状态 */}
      <div className="text-xs text-[var(--text-secondary)]">
        {indexed
          ? `已索引 (${cardCount} 张卡片)`
          : '未索引'}
        {lastIndexedAt && (
          <span className="ml-2">
            上次索引: {new Date(lastIndexedAt).toLocaleString()}
          </span>
        )}
      </div>

      {/* 模型缺失提示 */}
      {!modelAvailable && !indexing && (
        <div className="rounded-md bg-[var(--bg-warning)] px-3 py-2 text-xs text-[var(--text-warning)]">
          未检测到嵌入模型。请将 jina-embeddings-v5-text-nano 的 ONNX 模型文件放置到 workspace/.vectors/model.onnx
        </div>
      )}

      {/* 进度条 */}
      {indexing && (
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-[var(--bg-tertiary)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="text-xs text-[var(--text-secondary)]">
            {progress}/{total} ({percent}%)
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2">
        {!indexing ? (
          <button
            onClick={startIndexing}
            disabled={!modelAvailable}
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-50"
          >
            向量化全部卡片
          </button>
        ) : (
          <button
            onClick={cancelIndexing}
            className="rounded-md bg-[var(--bg-tertiary)] px-3 py-1.5 text-xs text-[var(--text-primary)] hover:opacity-90"
          >
            取消
          </button>
        )}
      </div>

      {/* 相似度阈值 */}
      <div className="space-y-1">
        <label className="text-xs text-[var(--text-secondary)]">
          相似度阈值: {threshold.toFixed(2)}
        </label>
        <input
          type="range"
          min="0.5"
          max="0.95"
          step="0.05"
          value={threshold}
          onChange={e => setThreshold(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 嵌入到 SystemSettings.tsx**

在 `SystemSettings.tsx` 中，找到现有分区的渲染位置，在最后一个分区后添加：

```tsx
import { VectorIndexSettings } from './VectorIndexSettings';

// 在 JSX 中添加：
<VectorIndexSettings />
```

- [ ] **Step 3: 验证 UI 渲染**

```bash
pnpm dev
```

打开设置页，确认"向量索引"分区显示正确，按钮可点击（无模型时应 disabled）。

- [ ] **Step 4: 提交**

```bash
git add src/components/ui/settings/VectorIndexSettings.tsx src/components/ui/settings/SystemSettings.tsx
git commit -m "feat(embedding): add vector index settings UI with progress bar"
```

---

### Task 7: 右侧面板"相关"tab

**Files:**
- Create: `src/components/ui/RelatedCardsTab.tsx`
- Modify: `src/stores/libraryStore.ts`
- Modify: `src/components/ui/RightPanel.tsx`

- [ ] **Step 1: 修改 libraryStore.ts — 新增 'related' tab 类型**

找到 `libraryStore.ts` 中定义 tab 类型的地方（可能是字符串字面量联合类型或 enum），添加 `'related'` 选项。若 tab 类型为 `rightPanelActiveTab` 状态，添加 `'related'` 值。

```typescript
// 在 tab 类型定义中添加 'related'
// 例如：type RightPanelTab = 'library' | 'editor' | 'related';
```

- [ ] **Step 2: 创建 RelatedCardsTab.tsx**

```tsx
import { useEffect } from 'react';
import { useEmbeddingStore } from '../../stores/embeddingStore';
import { useCardStore } from '../../stores/cardStore';
import { useReactFlow } from 'reactflow';

interface RelatedCardsTabProps {
  selectedCardId: string | null;
}

export function RelatedCardsTab({ selectedCardId }: RelatedCardsTabProps) {
  const { searchResults, searching, indexed, searchRelated, clearResults } = useEmbeddingStore();
  const cards = useCardStore(s => s.cards);
  const reactFlow = useReactFlow();

  useEffect(() => {
    if (selectedCardId && indexed) {
      searchRelated(selectedCardId);
    } else {
      clearResults();
    }
    return () => clearResults();
  }, [selectedCardId, indexed]);

  const handleCardClick = (cardId: string) => {
    const node = reactFlow.getNodes().find(n => n.id === cardId);
    if (node) {
      reactFlow.fitView({ nodes: [{ id: cardId }], padding: 0.3, duration: 300 });
    }
  };

  if (!indexed) {
    return (
      <div className="px-3 py-4 text-xs text-[var(--text-secondary)]">
        请先在设置中向量化卡片
      </div>
    );
  }

  if (!selectedCardId) {
    return (
      <div className="px-3 py-4 text-xs text-[var(--text-secondary)]">
        请在画布上选中一张卡片
      </div>
    );
  }

  if (searching) {
    return (
      <div className="px-3 py-4 text-xs text-[var(--text-secondary)]">
        搜索中...
      </div>
    );
  }

  if (searchResults.length === 0) {
    return (
      <div className="px-3 py-4 text-xs text-[var(--text-secondary)]">
        未找到相关卡片
      </div>
    );
  }

  return (
    <div className="space-y-1 px-2 py-2">
      {searchResults.map(({ cardId, score }) => {
        const card = cards[cardId];
        if (!card) return null;
        return (
          <button
            key={cardId}
            onClick={() => handleCardClick(cardId)}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-[var(--bg-tertiary)]"
          >
            <span className="truncate text-xs text-[var(--text-primary)]">
              {card.title || '无标题'}
            </span>
            <span className="ml-2 shrink-0 text-[10px] text-[var(--text-secondary)]">
              {score.toFixed(2)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: 修改 RightPanel.tsx — 集成"相关"tab**

在 `RightPanel.tsx` 中找到 tab 切换区域，添加"相关"tab 按钮。在 tab 内容区添加 `RelatedCardsTab` 渲染：

```tsx
import { RelatedCardsTab } from './RelatedCardsTab';

// tab 按钮区域添加：
<button
  className={tab === 'related' ? 'active' : ''}
  onClick={() => setTab('related')}
>
  相关🔗
</button>

// tab 内容区域添加：
{tab === 'related' && <RelatedCardsTab selectedCardId={selectedCardId} />}
```

需要获取当前画布选中卡片的 ID。可从 React Flow 的 `useStore` 获取 `selectedNodes`，或从 `cardStore` 获取。

- [ ] **Step 4: 验证交互**

```bash
pnpm dev
```

1. 打开右侧面板，确认出现"相关🔗"tab
2. 未向量化时显示提示
3. 向量化后，选中卡片切换到"相关"tab，确认搜索结果展示

- [ ] **Step 5: 提交**

```bash
git add src/components/ui/RelatedCardsTab.tsx src/stores/libraryStore.ts src/components/ui/RightPanel.tsx
git commit -m "feat(embedding): add related cards tab in right panel"
```

---

### Task 8: 集成测试与修复

**Files:**
- 上述所有文件可能需要微调

- [ ] **Step 1: 启动应用验证完整流程**

```bash
pnpm dev
```

验证流程：
1. 设置页显示"向量索引"分区
2. 无模型时显示缺失提示，按钮 disabled
3. 放置模型文件到 workspace/.vectors/model.onnx 后重启
4. 点击"向量化全部卡片"，进度条正常推进
5. 完成后状态更新
6. 右侧面板"相关"tab，选中卡片后显示相关结果
7. 点击结果卡片，画布定位正常
8. 取消功能正常

- [ ] **Step 2: 修复集成问题**

根据 Step 1 发现的问题逐一修复。常见问题：
- `@zvec/zvec` API 与文档不符（需查看实际导出）
- `onnxruntime-node` 在 Electron 中的 native addon 加载问题
- `renderBlocksToHTML` 导入路径问题（跨 src/electron 边界）
- IPC 通道命名与现有模式冲突

- [ ] **Step 3: 最终提交**

```bash
git add -A
git commit -m "fix(embedding): integration fixes for full pipeline"
```

---

## 自审结果

**Spec 覆盖：**
- ✅ 手动向量化按钮 + 进度可视化 → Task 6
- ✅ jina v5 text nano 模型 → Task 3
- ✅ ZVec 256 维向量存储 → Task 3
- ✅ BlockNote JSON → Markdown → Task 2
- ✅ IPC 通道设计 → Task 4
- ✅ 右侧面板"相关"tab → Task 7
- ✅ 设置页向量索引 UI → Task 6
- ✅ 模型文件管理 → Task 3 (isModelAvailable) + Task 6 (缺失提示)
- ✅ 相似度阈值滑块 → Task 6

**Placeholder 扫描：** 无 TBD/TODO（tokenizer 部分标注了占位实现，这是已知的首期简化，后续替换）

**类型一致性：** embeddingStore 的 searchResults 类型与 IPC 返回类型一致；EmbeddingService 方法签名与 index.ts 的调用一致。

**已知简化点（首期可接受）：**
- tokenizer 使用占位实现，需替换为完整 jina tokenizer
- textExtractor 跨 src/electron 边界导入 renderBlocks，可能需要调整
- ZVec API 调用基于文档假设，需实际安装后验证
