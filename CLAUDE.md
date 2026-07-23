# Heptabase Canvas v2

React Flow 画布知识管理桌面应用。技术栈：React 18 + TS 5.6 + Vite 5 + React Flow + BlockNote + Zustand 5 + Electron 35 + Tailwind CSS 4

## 开发规范

### 构建与运行

- 开发调试：`pnpm dev:skip`（跳过开屏），普通启动：`pnpm dev`
- **无用户明确要求，不执行 build 命令**
- 打包流程：确认版本号 → 更新 CHANGELOG → `pnpm electron:pack`/`electron:dist` → 验证
- 打包陷阱：`ELECTRON_RUN_AS_NODE=1` 会导致 exe 静默退出，需 `unset` 或用 PowerShell `Start-Process`

### 功能开发

引入新功能前必须用 `superpowers:brainstorming` 确认细节。简单 bug 修复/配置微调不触发。

### 调试与验证

自主验证优先，使用 Playwright、Chrome DevTools MCP 进行交互测试。

### Git 分支

`feature/<名>` | `fix/<名>` | `refactor/<名>` | `experiment/<描述>`
提交规范：`<type>(<scope>): <subject>`，scope: canvas|editor|workspace|ui|sync|electron

### Review 提醒

3+ 个功能或 1 周开发后提醒 review：React.memo、重复样式/逻辑、状态管理、未用依赖、类型完整性。

## 数据格式兼容

- 卡片：`cards/<uuid>.json`
- 画板清单：`boards/_manifest.json`
- 画板快照：`boards/<uuid>.json`（version: 2）
- 回收站：`trash/<uuid>.trash.json`

## 性能要求

100 卡片内 60fps | 预览态用 previewHTML | ResizeObserver 节流 <5px | React.memo 包裹 CardNode

## 代码原则

- 优先编辑现有文件，不主动创建文档或添加注释
- 搜索默认在 `src/`、`electron/`、`tests/` 目录，避免全项目搜索
- 简体中文助手，优先使用 Playwright 调试，不支持截图

---

## 索引工具分工

**CodeGraph**（毫秒级）→ 日常结构查询 | **GitNexus**（秒级）→ 深度分析

| 场景 | 用 CodeGraph | 用 GitNexus |
|------|-------------|-------------|
| 查找符号定义 | `codegraph_search` | - |
| 快速上下文 | `codegraph_context` | - |
| 调用链追踪 | `codegraph_trace` | - |
| 几个符号源码 | `codegraph_explore` | - |
| 影响分析/blast radius | - | `impact` |
| 执行流/业务流程 | - | `query` |
| 跨模块重命名 | - | `rename` |
| 提交前变更检查 | - | `detect_changes` |
| API 契约/路由分析 | - | `api_impact` / `route_map` |

### CodeGraph 速查

`codegraph_search` 查符号 | `codegraph_context` 任务上下文 | `codegraph_trace` 追踪流 | `codegraph_explore` 多符号源码 | `codegraph_impact` 改动影响

索引刷新：Claude Code 内编辑自动 sync，外部修改需 `codegraph sync`

### GitNexus 速查

MUST：编辑前 `impact` 分析 | 提交前 `detect_changes` | HIGH/CRITICAL 风险必须警告 | 重命名用 `rename` 不用 find-replace

资源：`gitnexus://repo/base/context` 概览 | `gitnexus://repo/base/processes` 执行流 | `gitnexus://repo/base/process/{name}` 执行追踪

索引刷新：`node .gitnexus/run.cjs analyze`

---

## 归档分支

已归档的文档保存在 `archive/untracked-docs` 分支，包括 `docs/refer/`、`docs/superpowers/` 等。需要时 `git checkout archive/untracked-docs -- docs/<path>` 恢复。

## 踩坑总结

`docs/lessons-learned.md` — 记录了已修复的疑难 bug 的根因和教训，排查类似问题时先查阅。

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **base** (3890 symbols, 8897 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/base/context` | Codebase overview, check index freshness |
| `gitnexus://repo/base/clusters` | All functional areas |
| `gitnexus://repo/base/processes` | All execution flows |
| `gitnexus://repo/base/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
