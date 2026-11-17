# Alphabase 项目跟踪

> 唯一事实源：项目状态、路线图、结构、命令、可启动项和文档索引都在这里维护。
> `python board.py` 会把本文渲染成本地可视化看板。
>
> 最后更新：2026-11-17 · 版本 0.2.1 · 分支 main

## 当前状态

Alphabase 0.2.1 已完成品牌统一并产出 Windows x64 安装包（2026-08-16），随后项目暂停约两个月。
2026-10-24 重启：本轮先收敛仓库（清理过期产物、归档历史设计文档、建立单一跟踪源与本地面板），再按路线图推进功能。

仓库现状：`main` 分支干净、与 `origin/main` 同步；`pnpm typecheck`、`pnpm lint`、`pnpm test:unit`（111 文件 / 626 用例）、全量 Chromium E2E（60/60 通过，5.8 分钟）与包体积预算均通过。
2026-10-24 完成一轮工作区数据安全修复：切换工作区不再写错目录、画板清单丢失可重建、冲突取消保持只读、加载失败给出明确错误页。
2026-11-17 完成 [修复计划](docs/26-10-25修复计划.md) 阶段 A/B：画板持久化缺口、工作区切换运行代号、恢复中断残留检测、文本注释自动编辑清理、跨画板移动不可变更新、Frame 缩放原点偏移、对齐工具栏跟随视口；并补上工作区引用完整性检查脚本（`node scripts/verify-workspace-integrity.mjs`）。阶段 C/D/E 需要先测量或单独设计，未动。
历史设计文档已归档到本地 `docs/archive/`（不跟踪，旧路径仍可在 git 历史中查到）。

## 路线图

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| 0.2.1 发布 | 已完成 | 品牌统一为 Alphabase，产出 Windows x64 NSIS 安装包与 release notes |
| 0.2.0 主题研究与媒体管道 | 已完成 | 主题研究画布（问题/成果）、媒体流式导入 + 内容哈希去重 + WebP 变体、画布性能优化 |
| 重启收敛 | 已完成 | 清理过期产物、归档历史文档、建立 PROJECT.md + board.py，同步 README 与 CLAUDE.md |
| E2E 回归 | 已完成 | 2026-10-24 全量 Chromium E2E 60/60 通过（5.8 分钟），覆盖画布性能、持久化、媒体粘贴与主题栏 |
| 工作区数据安全修复 | 已完成 | 切换工作区延迟任务护栏、manifest 缺失重建、冲突取消只读、加载失败显式错误态、目录选择修正；新增 15 项单测 + 2 项 E2E |
| 修复计划阶段 A/B | 已完成 | 2026-11-17：画板持久化缺口、工作区切换运行代号、恢复残留检测、文本注释自动编辑清理、跨画板移动不可变更新、Frame 缩放原点偏移、对齐工具栏跟随视口；新增 24 项单测与完整性检查脚本。详见 `docs/26-10-25修复计划.md` |
| 修复计划阶段 C/D/E | 待办 | 需要先测量（批量导入、预览调度、渲染热点）或单独设计（节点状态所有权、文本高度逻辑统一） |
| 真实使用回归 | 待办 | 用 0.2.1 安装包跑真实工作区，记录问题清单，作为下一轮功能优先级依据 |
| 媒体管道收尾 | 待办 | 旧内联图片迁移、孤儿资源隔离回收、打包后 sharp 与媒体协议验证（见 `docs/archive/plans/2026-08-13-scalable-canvas-media-pipeline.md`） |
| 分支与 worktree 清理 | 待办 | 3 个未合并分支、4 个外部 worktree 待决定去留；旧品牌包已清理 |
| 下一步功能 | 待办 | 重启后按真实使用反馈确定，先不做预设 |

## 结构

| 目录 | 说明 |
| --- | --- |
| `src/components/` | 画布节点、面板、编辑器、卡片库与 UI 基础组件 |
| `src/stores/` | Zustand 状态：卡片、画板、工作区、项目、备份、媒体播放 |
| `src/hooks/` | 拖拽、缩放、连线、键盘、历史等交互与生命周期 |
| `src/sync/` | 画板快照、补丁与同步引擎 |
| `src/media/` | 媒体资产、URL 解析、变体选择、内联图片迁移 |
| `src/converters/` | BlockNote / Markdown / HTML 内容转换 |
| `src/utils/` | 文件系统、工作区适配、命令与通用工具 |
| `src/services/` | 工作区上下文与跨模块服务 |
| `src/platform/` | Electron 能力探测与平台差异 |
| `src/theme/` | 主题令牌与暗色模式 |
| `src/types/` | 共享类型与连接模型 |
| `electron/` | 主进程、预加载桥接、内容剪藏、本地嵌入、媒体协议、备份与审计 |
| `tests/` | Playwright E2E（浏览器 + Electron）与跨模块单测 |
| `scripts/` | 构建、打包、ONNX 运行时准备、包体积预算 |
| `prototype/` | 静态原型：项目板、3D 地形、落地页（不参与构建） |
| `docs/` | 工具手册、踩坑总结、性能规则、历史文档归档 |
| `release/` | 打包产物（不入库） |
| `.github/workflows/` | CI：质量门禁、浏览器 E2E、Windows Electron E2E |

## 命令

| 命令 | 用途 |
| --- | --- |
| `python board.py` | 启动项目看板（http://127.0.0.1:7788），仅本机可访问 |
| `pnpm dev` | 浏览器开发模式（Vite，127.0.0.1:5173） |
| `pnpm electron:dev` | Electron 开发模式（含主进程热重建） |
| `pnpm electron:start` | 启动已构建的 Electron 应用（需先 `pnpm electron:build`） |
| `pnpm test:unit` | Vitest 单测 |
| `pnpm test:e2e` | Playwright E2E（自动起 dev server） |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm lint` | ESLint |
| `pnpm check:bundle` | 入口包体积预算检查 |
| `pnpm electron:pack` | 打包免安装目录（先确认版本号与 CHANGELOG） |
| `pnpm electron:dist` | 生成 NSIS 安装包（先确认版本号与 CHANGELOG） |
| `pnpm build` | 生产构建，仅 CI/打包流程使用；本地默认不执行 |

## 可启动项

| 名称 | 命令 | 地址 | 说明 |
| --- | --- | --- | --- |
| 项目看板 | `python board.py` | http://127.0.0.1:7788 | 只读面板：状态、路线图、命令、结构、文档 |
| 浏览器开发模式 | `pnpm dev` | http://127.0.0.1:5173 | Vite HMR，调试优先用这个 |
| Electron 开发模式 | `pnpm electron:dev` | — | 桌面壳 + 主进程热重建 |
| Electron 应用启动 | `pnpm electron:start` | — | 启动已构建产物，需先 `pnpm electron:build` |
| E2E（Chromium） | `pnpm test:e2e --project=chromium` | http://127.0.0.1:5173 | 自动复用或拉起 dev server |
| 项目板原型 | 直接打开 `prototype/project-board/00-index.html` | — | 静态原型，双击即可 |
| 落地页原型 | 直接打开 `prototype/alphabase-landing.html` | — | 静态原型 |

## 文档

| 文件 | 说明 |
| --- | --- |
| `README.md` | 项目说明与快速开始 |
| `CLAUDE.md` | 开发规范、数据格式、协作约定 |
| `CHANGELOG.md` | 版本变更记录 |
| `PROJECT.md` | 本文件，唯一跟踪事实源 |
| `docs/lessons-learned.md` | 踩坑总结，排查类似问题先查 |
| `docs/performance.md` | 性能目标、热点路径与剩余工作 |
| `docs/TOOLS.md` | 工具手册：调试、打包、索引、归档恢复 |
| `docs/archive/` | 历史计划、规格与评审（本地归档，不跟踪） |
| `.github/workflows/ci.yml` | CI 质量门禁定义 |
