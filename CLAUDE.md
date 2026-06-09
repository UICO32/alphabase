# Heptabase Canvas v2 项目规范

基于 React Flow 的画布知识管理桌面应用，从 tldraw 迁移到 React Flow 以解决编辑器冲突问题。

技术栈：React 18 + TypeScript 5.6 + Vite 5 + React Flow + BlockNote + Zustand 5 + Electron 35 + Tailwind CSS 4

---

## 开发规范

### 1. 构建与运行

**无用户明确要求，不执行 build 命令。**

- 开发时使用 `pnpm dev`
- 仅在用户明确要求"构建"、"打包"、"发布"时执行 `pnpm build`
- 不要主动建议或执行构建操作

### 1.1 Electron 打包流程

当用户要求打包 exe 时，按以下步骤执行：

1. **版本号**：确认 `package.json` 中的 `version` 是否需要更新，询问用户
2. **更新日志**：从 `git log` 提取自上次打包以来的变更，写入 `CHANGELOG.md`，询问用户确认内容
3. **打包命令**：
   - 测试打包（unpacked）：`pnpm electron:pack` → 输出到 `release/win-unpacked/`
   - 正式打包（安装包）：`pnpm electron:dist` → 输出到 `release/`
4. **验证**：启动 unpacked exe 验证功能正常
5. **已知陷阱**：
   - `ELECTRON_RUN_AS_NODE=1` 环境变量由 Trae CN / VS Code 注入，会导致 exe 以 Node.js 模式启动后静默退出
   - 从 Trae CN 终端测试打包 exe 时，必须先 `unset ELECTRON_RUN_AS_NODE` 或用 PowerShell `Start-Process`
   - 用户从桌面双击 exe 不受此影响
   - 打包前确保 `tsc` 无错误，未使用的 import/变量会导致打包失败

### 2. 功能开发流程

引入新功能前，**必须使用头脑风暴技能**与用户确认细节：

```
用户请求新功能 → 调用 superpowers:brainstorming 技能 → 探索需求 → 确认方案 → 实现
```

**触发条件**：添加新功能或组件、修改现有行为、架构调整、技术选型变更  
**不触发**：简单 bug 修复、文档更新、配置微调

### 3. 调试与验证

自主验证优先，使用 Playwright、Chrome DevTools MCP、React DevTools、Electron DevTools 进行交互测试，验证核心路径和边界情况，确认无回归后再提交。

### 4. Git 分支管理

```
main
  ├── feature/<功能名>
  ├── fix/<问题名>
  ├── refactor/<模块名>
  └── experiment/<描述>
```

提交规范：`<type>(<scope>): <subject>`  
type: feat|fix|refactor|docs|style|test|chore  
scope: canvas|editor|workspace|ui|sync|electron

新功能开发流程：确认方案 → `git checkout -b feature/<功能名>` → 开发验证 → `git commit` → `git push -u origin feature/<功能名>` → 通知用户创建 PR 或合并

### 5. Review 提醒

在持续引入多个新功能后（3+ 个功能或 1 周开发周期），提醒用户进行性能 review、代码冗余 review、架构 review。

**Review 检查点**：
- [ ] 组件是否使用 React.memo 优化
- [ ] 是否有重复的样式/逻辑可抽取
- [ ] 状态管理是否合理（避免过度提升或下沉）
- [ ] 是否有未使用的依赖或代码
- [ ] 类型定义是否完整

### 6. 测试规范

**测试框架**：Playwright

- E2E 测试：`tests/e2e/<功能>.spec.ts`
- 单元测试：`tests/unit/<模块>.test.ts`
- 核心用户流程必须有 E2E 测试覆盖
- 新功能提交时附带测试用例，Bug 修复提交时附带回归测试

---

## 远程仓库

GitHub: https://github.com/UICO32/-base.git

- 功能分支推送到远程，主分支保持稳定可发布状态
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

**禁止读取**：`node_modules/`、`dist/`、`build/`、`.vite/`、`.git/`、锁文件、`.cache/`、`*.log`

**例外**（需用户明确要求）：排查依赖时可查看 `package.json`；构建配置问题可查看 `vite.config.ts`、`tsconfig.json`

### 搜索范围限制

使用 `SearchCodebase`、`Grep`、`Glob` 时，默认在 `src/`、`electron/`、`tests/` 目录搜索，避免全项目搜索命中 `node_modules`。

### 代码修改原则

- **优先编辑现有文件**，而非创建新文件
- **不主动创建文档**（*.md、README），除非用户明确要求
- **不添加注释**，除非用户明确要求或代码逻辑复杂需要解释

---

## GitNexus — 核心速查

> 完整文档见 [AGENTS.md](file:///d:/USE/save/code/abase/AGENTS.md)

<!-- gitnexus:start -->

### Always Do

- **MUST run impact analysis before editing any symbol.** Run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report blast radius.
- **MUST run `gitnexus_detect_changes()` before committing** to verify affected scope.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk.
- Use `gitnexus_query({query: "concept"})` instead of grepping when exploring unfamiliar code.
- Use `gitnexus_context({name: "symbolName"})` for full symbol details.

### Never Do

- NEVER edit a function/class/method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename`.
- NEVER commit without running `gitnexus_detect_changes()`.

### 高频 CLI

```bash
npx gitnexus analyze   # 构建/刷新索引（首次使用、大改后、过期时）
npx gitnexus status    # 检查索引新鲜度
```

### 高频 MCP 工具

| Tool | 用途 |
|------|------|
| `gitnexus_query` | 按概念找执行流 |
| `gitnexus_context` | 符号 360° 视图 |
| `gitnexus_impact` | 影响分析（编辑前必做） |
| `gitnexus_detect_changes` | 提交前检测影响范围 |

### 索引刷新策略

**GitNexus 不会自动监听文件变化。** 首次使用、大改代码后必须运行 `npx gitnexus analyze`；工具返回 "index stale" 时必须立即刷新。

<!-- gitnexus:end -->

---

## CodeGraph — 核心速查

> 完整文档见 [AGENTS.md](file:///d:/USE/save/code/abase/AGENTS.md)

### 启动配置

```json
{
  "mcpServers": {
    "codegraph": {
      "type": "stdio",
      "command": "codegraph",
      "args": ["serve", "--mcp"]
    }
  }
}
```

### 高频 CLI

```bash
codegraph init -i       # 初始化索引
codegraph sync [path]   # 增量同步（外部编辑器修改后手动执行）
codegraph status        # 检查统计信息
```

### 索引刷新策略

**CodeGraph 在 Claude Code 内编辑时自动 sync；外部编辑器修改后需手动 `codegraph sync`。**

---

## 参考文档

- `PROMPT.md` - 项目背景、技术栈、开发顺序
- `PROJECT_REFERENCE.md` - 老项目完整技术参考
- `AGENTS.md` - GitNexus & CodeGraph 完整工具文档
