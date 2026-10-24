# Alphabase v2

React Flow 画布知识管理桌面应用。技术栈：React 18 + TS 5.9 + Vite 5 + React Flow 12 + BlockNote 0.31 + Zustand 5 + Electron 42 + Tailwind CSS 4

## 入口

- 项目状态、路线图、目录/命令/可启动项总表：[PROJECT.md](PROJECT.md)（唯一事实源，可视化用 `board.py`）
- 工具链用法与坑（调试、打包、索引、归档恢复）：[docs/TOOLS.md](docs/TOOLS.md)，涉及这些操作前先读
- 踩坑历史：[docs/lessons-learned.md](docs/lessons-learned.md)，排查疑难 bug 前先查

## 功能开发

引入新功能前必须用 `superpowers:brainstorming` 确认细节；简单 bug 修复/配置微调不触发。
3+ 个功能或 1 周开发后主动提醒 review：React.memo、重复样式/逻辑、状态管理、未用依赖、类型完整性。

## 验证要求

- 改完必须跑：`pnpm typecheck`、`pnpm lint`，以及受影响的单测；涉及交互/画布再跑对应 E2E
- 自主验证优先：能用 Playwright 复现/验证的，不要只靠推理下结论
- **无用户明确要求，不执行 `pnpm build`**；打包只在用户要求时进行

## Git 规范

- 分支：`feature/<名>` | `fix/<名>` | `refactor/<名>` | `experiment/<描述>`
- 提交：`<type>(<scope>): <subject>`，scope: canvas|editor|workspace|ui|sync|electron
- 不自动 push；提交前确认工作区只包含本次改动

## 数据格式兼容

- 卡片：`cards/<uuid>.json`
- 画板清单：`boards/_manifest.json`
- 画板快照：`boards/<uuid>.json`（version: 2）
- 主题研究元数据：`projects/<boardId>.json`
- 媒体资产：`media/`（原文件 + 变体 + 索引，内容哈希去重）
- 回收站：`trash/<uuid>.trash.json`

## 性能要求

100 卡片内 60fps | 预览态用 previewHTML | ResizeObserver 节流 <5px | React.memo 包裹 CardNode

## 代码原则

- 优先编辑现有文件，不主动创建文档或添加注释
- 搜索默认在 `src/`、`electron/`、`tests/`，避免全项目搜索
- 简体中文沟通；结论先行，不确定就明说

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
