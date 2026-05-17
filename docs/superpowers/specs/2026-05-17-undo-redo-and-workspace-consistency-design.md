# 画布撤销/重做 + 工作区数据一致性校验 设计文档

## 1. 功能概述

### 1.1 撤销/重做系统
- 支持最多 20 步历史记录
- 记录画布节点/边变化 + 卡片内容变化
- 键盘快捷键：Ctrl+Z / Ctrl+Shift+Z

### 1.2 工作区数据一致性校验
- 在 `_metadata.json` 中记录卡片数和画板数
- 载入工作区时校验数量是否一致
- 不一致时显示冲突对话框让用户选择

## 2. 架构设计

### 2.1 撤销/重做系统

```
useHistory Hook
├── 历史记录栈: HistoryEntry[]
├── 当前索引: number
├── record(entry) ──► 添加记录，超出限制时移除最旧记录
├── undo() ──► 返回上一个状态，索引前移
├── redo() ──► 返回下一个状态，索引后移
└── clear() ──► 清空历史

ReactFlowCanvas 集成
├── 监听 onNodeDragStop ──► 记录画布状态
├── 监听 onEdgesChange（添加/删除）──► 记录结构状态
├── 订阅 cardStore ──► 记录卡片内容变化
└── 键盘事件 ──► 调用 undo/redo
```

### 2.2 工作区校验系统

```
WorkspaceMetadata
├── cardCount: number
├── boardCount: number
├── lastModified: number
└── version: 1

WorkspaceService
├── loadMetadata() ──► 读取 _metadata.json
├── saveMetadata() ──► 保存 _metadata.json
└── validateConsistency() ──► 校验数量是否一致

useWorkspaceDataLoader 修改
├── 加载实际数据（卡片、画板）
├── 读取元数据
├── 校验数量
├── 不一致时显示冲突对话框
└── 根据用户选择继续或取消
```

## 3. 详细设计

### 3.1 useHistory Hook

```typescript
interface HistoryEntry {
  type: 'canvas' | 'structure' | 'cards';
  description: string;
  nodes: Node[];
  edges: Edge[];
  cardChanges?: Array<{ id: string; before: GlobalCard; after: GlobalCard }>;
}

interface UseHistoryOptions {
  maxHistory?: number; // 默认 20
}

interface UseHistoryReturn {
  canUndo: boolean;
  canRedo: boolean;
  record: (entry: Omit<HistoryEntry, 'timestamp'>) => void;
  undo: () => HistoryEntry | null;
  redo: () => HistoryEntry | null;
  clear: () => void;
}
```

**记录策略**：
- 画布操作（拖拽）：防抖 500ms，只在拖拽结束时记录
- 结构操作（添加/删除节点、边）：立即记录
- 卡片内容变化：防抖 500ms，只记录变化的卡片

### 3.2 WorkspaceMetadata

```typescript
interface WorkspaceMetadata {
  version: 1;
  cardCount: number;
  boardCount: number;
  lastModified: number;
}
```

**文件位置**：工作区根目录下的 `_metadata.json`

**更新时机**：
- 每次增删卡片/画板后
- syncEngine 写入成功后
- 工作区切换时

### 3.3 冲突对话框

```typescript
interface ConflictDialogProps {
  expectedCards: number;
  actualCards: number;
  expectedBoards: number;
  actualBoards: number;
  onChoice: (choice: 'backup' | 'continue' | 'cancel') => void;
}
```

**显示内容**：
- 记录数量 vs 实际数量
- 可能的原因说明
- 三个选项按钮

## 4. 实现计划

| 阶段 | 任务 | 文件 |
|------|------|------|
| 1 | 定义 WorkspaceMetadata 类型 | src/utils/workspace/types.ts |
| 2 | 实现 useHistory Hook | src/hooks/useHistory.ts |
| 3 | 修改 WorkspaceService 支持元数据 | src/services/WorkspaceService.ts |
| 4 | 集成撤销/重做到 ReactFlowCanvas | src/components/canvas/ReactFlowCanvas.tsx |
| 5 | 创建 WorkspaceConflictDialog 组件 | src/components/ui/WorkspaceConflictDialog.tsx |
| 6 | 修改 useWorkspaceDataLoader 增加校验 | src/hooks/useWorkspaceDataLoader.ts |
| 7 | 测试和调试 | 多个文件 |

## 5. 边界情况处理

### 5.1 撤销/重做
- 历史记录为空时：undo/redo 无操作
- 达到最大历史记录数：移除最旧的记录
- 执行新操作时：清除当前索引之后的所有 redo 记录
- 工作区切换时：清空历史记录

### 5.2 数据一致性校验
- 元数据文件不存在：视为首次加载，创建新元数据
- 元数据版本不匹配：忽略元数据，重新创建
- 用户选择取消：返回默认 demo 数据
- 备份不存在：禁用"使用备份"选项

## 6. 性能考虑

- 历史记录只保存变化的卡片，而非全部卡片
- 使用防抖避免频繁记录
- 元数据文件体积小，读写开销可忽略
