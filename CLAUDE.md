# Heptabase Canvas v2 项目规范

## 项目概述

基于 React Flow 的画布知识管理桌面应用，从 tldraw 迁移到 React Flow 以解决编辑器冲突问题。

技术栈：React 18 + TypeScript 5.6 + Vite 5 + React Flow + BlockNote + Zustand 5 + Electron 35 + Tailwind CSS 4

---

## 开发规范

### 1. 构建与运行

**无用户明确要求，不执行 build 命令。**

- 开发时使用 `pnpm dev`
- 仅在用户明确要求"构建"、"打包"、"发布"时执行 `pnpm build`
- 不要主动建议或执行构建操作

### 2. 功能开发流程

引入新功能前，**必须使用头脑风暴技能**与用户确认细节：

```
用户请求新功能 → 调用 superpowers:brainstorming 技能 → 探索需求 → 确认方案 → 实现
```

**触发条件**：
- 添加新功能或组件
- 修改现有行为
- 架构调整
- 技术选型变更

**不触发**：
- 简单 bug 修复
- 文档更新
- 配置微调

### 3. 调试与验证

**自主验证优先**，使用以下工具：

| 工具 | 用途 |
|------|------|
| Playwright | E2E 测试、用户流程验证 |
| Chrome DevTools MCP | DOM 检查、性能分析、网络请求 |
| React DevTools | 组件状态、props 检查 |
| Electron DevTools | 主进程调试、IPC 监控 |

**验证流程**：
1. 实现功能后，启动开发服务器
2. 使用 Playwright 或 DevTools 进行交互测试
3. 验证核心路径和边界情况
4. 确认无回归后再提交

### 4. Git 分支管理

**分支策略**：

```
main (主分支，稳定版本)
  ├── feature/<功能名>  (新功能开发)
  ├── fix/<问题名>      (bug 修复)
  ├── refactor/<模块名> (重构)
  └── experiment/<描述> (实验性尝试)
```

**提交规范**：

```
<type>(<scope>): <subject>

type: feat|fix|refactor|docs|style|test|chore
scope: canvas|editor|workspace|ui|sync|electron

示例：
feat(canvas): 实现 CardNode 组件
fix(editor): 修复图片粘贴后高度不更新
refactor(sync): 简化 syncEngine 订阅逻辑
```

**新功能开发流程**：
1. 确认方案后，创建功能分支：`git checkout -b feature/<功能名>`
2. 开发并验证功能
3. 提交代码：`git commit -m "feat(scope): 描述"`
4. 推送到远程：`git push -u origin feature/<功能名>`
5. 通知用户创建 PR 或合并

### 5. Review 提醒

**在持续引入多个新功能后（3+ 个功能或 1 周开发周期），提醒用户**：

> 已完成多个功能开发，建议进行以下 review：
> - **性能 review**：检查组件渲染性能、内存使用、bundle 大小
> - **代码冗余 review**：识别重复代码、可复用模块、死代码
> - **架构 review**：评估模块划分、依赖关系、扩展性
>
> 是否现在进行 review？

**Review 检查点**：
- [ ] 组件是否使用 React.memo 优化
- [ ] 是否有重复的样式/逻辑可抽取
- [ ] 状态管理是否合理（避免过度提升或下沉）
- [ ] 是否有未使用的依赖或代码
- [ ] 类型定义是否完整

### 6. 测试规范

**测试框架**：Playwright

**目录结构**：
```
tests/
  e2e/           # E2E 测试
    *.spec.ts
  unit/          # 单元测试（如需要）
    *.test.ts
```

**命名规范**：
- E2E 测试：`<功能>.spec.ts`
- 单元测试：`<模块>.test.ts`

**测试要求**：
- 核心用户流程必须有 E2E 测试覆盖
- 新功能提交时附带测试用例
- Bug 修复提交时附带回归测试

---

## 远程仓库

GitHub: https://github.com/UICO32/-base.git

**同步策略**：
- 功能分支推送到远程
- 主分支保持稳定可发布状态
- 合并前确保测试通过

---

## 技术约束

### 数据格式兼容

必须兼容老项目数据格式：
- 卡片文件：`cards/<uuid>.json`
- 画板清单：`boards/_manifest.json`
- 画板快照：`boards/<uuid>.json`（新格式 version: 2）
- 回收站：`trash/<uuid>.trash.json`

### 可复用模块

从老项目复用（见 `PROMPT.md` 和 `PROJECT_REFERENCE.md`）：
- 文件系统层：`src/utils/workspace/`
- 状态管理：`cardStore.ts`, `boardStore.ts`, `libraryStore.ts`
- 编辑器：`BlockNoteEditor.tsx`
- Electron：`electron/`

### 需重写模块

使用 React Flow 重写：
- `ReactFlowCanvas.tsx` - 画布主组件
- `CardNode.tsx` - 卡片节点（BlockNote 直接内嵌）
- `SectionNode.tsx` - 分区节点
- `ConnectionEdge.tsx` - 连接线边

---

## 性能要求

- 100 个卡片以内：60fps
- 预览态使用 previewHTML，不挂载 BlockNote
- ResizeObserver 节流：高度变化 < 5px 不更新
- 使用 React.memo 包裹 CardNode

---

## AI 行为约束

### 文件访问限制

**禁止读取以下目录/文件：**
- `node_modules/` — 依赖包，无需查看
- `dist/`、`build/`、`.vite/` — 构建产物
- `.git/` — Git 内部数据
- `*.lock`、`package-lock.json`、`pnpm-lock.yaml` — 锁文件
- `.cache/`、`*.log` — 缓存和日志

**例外情况（需用户明确要求）：**
- 排查依赖问题时可查看 `package.json`
- 构建配置问题时可查看 `vite.config.ts`、`tsconfig.json`

### 搜索范围限制

使用 `SearchCodebase`、`Grep`、`Glob` 时：
- 默认在 `src/`、`electron/`、`tests/` 目录搜索
- 避免全项目搜索导致命中 `node_modules`
- 使用 `target_directories` 参数限定范围

### 代码修改原则

- **优先编辑现有文件**，而非创建新文件
- **不主动创建文档**（*.md、README），除非用户明确要求
- **不添加注释**，除非用户明确要求或代码逻辑复杂需要解释

---

## 参考文档

- `PROMPT.md` - 项目背景、技术栈、开发顺序
- `PROJECT_REFERENCE.md` - 老项目完整技术参考
