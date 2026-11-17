# 工具手册（TOOLS）

> 这里只记「怎么用」和「坑」。所有命令与可启动项的总表在 [PROJECT.md](../PROJECT.md)，不在这里重复。

## 本地开发

| 入口 | 说明 |
| --- | --- |
| `pnpm dev` | 浏览器模式（Vite，`127.0.0.1:5173`），日常调试优先 |
| `pnpm electron:dev` | 桌面壳 + 主进程热重建（含开屏流程） |
| `pnpm electron:start` | 启动已构建产物，需先 `pnpm electron:build` |

## 项目看板

- `python board.py` / 双击 `board.cmd`：本地只读看板（`127.0.0.1:7788`）
- `--no-open` 只起服务；`--port 7800` 换端口（被占用会自动顺延）
- 数据来源：`PROJECT.md`（状态/路线图/命令/结构/文档）+ 实时扫描（git、目录规模、测试记录）
- 改完 `PROJECT.md` 刷新页面即可，不需要重启服务

## 调试与验证

- 交互问题优先用 Playwright 复现：`pnpm test:e2e --project=chromium`（自动复用或拉起 dev server）；只想看某个场景可加 `-g "关键字"`
- 需要看图时用 Playwright 截图（`pnpm exec playwright screenshot --full-page URL out.png`），临时图放 `.tmp/`（已 gitignore）
- 单测：`pnpm test:unit`（Vitest）；聚焦单文件：`pnpm exec vitest run src/xxx.test.ts`
- 类型/lint：`pnpm typecheck`、`pnpm lint`；包体积：`pnpm check:bundle`
- 工作区引用完整性（卡片/画板/媒体/项目互相引用）：`node scripts/verify-workspace-integrity.mjs <工作区路径>`，加 `--json` 输出机器可读报告；有断链时退出码为 1
- 浏览器自动化也可用 agent-browser 技能；Electron 专属 spec 在 Chromium 项目里会被忽略

## 打包

1. 确认版本号（`package.json`）→ 更新 [CHANGELOG.md](../CHANGELOG.md)
2. `pnpm electron:pack`（免安装目录）或 `pnpm electron:dist`（NSIS 安装包）
3. 在干净环境验证安装与启动

坑：

- `ELECTRON_RUN_AS_NODE=1` 会让 exe 静默退出，构建/启动前必须清除（PowerShell 用 `Start-Process` 隔离环境）
- 原生依赖 `onnxruntime-node`、`sharp` 走 `asarUnpack`；打包后必须验证 sharp 与自定义媒体协议可用
- `node scripts/check-bundle-budget.mjs` 只看入口包体积，别用 dev 产物判断

## 索引工具

**CodeGraph**（毫秒级）→ 日常结构查询 | **GitNexus**（秒级）→ 深度分析

| 场景 | CodeGraph | GitNexus |
| --- | --- | --- |
| 查找符号定义 | `codegraph_search` | - |
| 快速上下文 | `codegraph_context` | - |
| 调用链追踪 | `codegraph_trace` | - |
| 几个符号源码 | `codegraph_explore` | - |
| 改动影响 | `codegraph_impact` | `impact` |
| 执行流/业务流程 | - | `query` |
| 跨模块重命名 | - | `rename` |
| 提交前变更检查 | - | `detect_changes` |
| API 契约/路由分析 | - | `api_impact` / `route_map` |

- CodeGraph 索引刷新：Claude Code 内编辑自动 sync，外部修改需 `codegraph sync`
- GitNexus 索引刷新：`node .gitnexus/run.cjs analyze`（会重建索引并重写 CLAUDE.md 底部自动段）
- GitNexus 硬规则：编辑符号前先 `impact`，提交前 `detect_changes`，HIGH/CRITICAL 风险必须先警告用户，重命名用 `rename` 不用 find-replace
- 资源：`gitnexus://repo/base/context` 概览 | `/clusters` 功能区 | `/processes` 执行流 | `/process/{name}` 追踪

## 文档归档与恢复

- 历史计划、规格与评审在本地 `docs/archive/`（已 gitignore），旧路径仍可在 git 历史里 `git log -- docs/plans` 查到
- 更早的未跟踪文档在 `archive/untracked-docs` 分支：`git checkout archive/untracked-docs -- docs/<path>` 恢复

## 排错

- 先查 [lessons-learned.md](lessons-learned.md)（已修复疑难 bug 的根因与教训）
- 打包/启动类问题先排除环境变量与原生依赖，再看主进程日志（`electron/startupLog.ts`）
