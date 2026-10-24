# Alphabase

基于 React Flow 的桌面知识画布：卡片、Frame、问题、成果与本地资料放在同一张可缩放、可连接、可持久保存的研究画布上。

> 这是一个 vibe project，仅用于学习、实验和个人研究参考，不代表商业产品，也不保证生产环境可用。

## 当前状态

版本 **0.2.1**（2026-08-16 发布 Windows x64 安装包），目前处于重启收敛阶段。
项目状态、路线图、命令与结构统一维护在 **[PROJECT.md](PROJECT.md)**（唯一事实源），用 `python board.py` 可视化查看。

## 快速开始

```bash
pnpm install          # 安装依赖（Node 22+，pnpm 11）
python board.py       # 打开项目看板（零依赖，http://127.0.0.1:7788）
pnpm electron:dev     # 启动桌面应用（开发模式）
pnpm dev              # 仅浏览器调试（http://127.0.0.1:5173）
```

`board.py` 只用 Python 标准库，Python 3.9+ 即可；Windows 下也可以直接双击 `board.cmd`。
看板参数：`--no-open` 只起服务，`--port 7800` 换端口。

## 可启动项

| 入口 | 命令 | 地址 |
| --- | --- | --- |
| 项目看板 | `python board.py` / 双击 `board.cmd` | http://127.0.0.1:7788 |
| 浏览器开发 | `pnpm dev` | http://127.0.0.1:5173 |
| Electron 开发 | `pnpm electron:dev` | — |
| Electron 启动（已构建） | `pnpm electron:start` | — |
| E2E（Chromium） | `pnpm test:e2e --project=chromium` | http://127.0.0.1:5173 |
| 项目板原型 | 直接打开 `prototype/project-board/00-index.html` | — |

## 项目结构

```text
board.py / board.cmd   项目看板（Python 标准库，只读）
PROJECT.md             项目跟踪唯一事实源
src/                   渲染层：components / stores / hooks / sync / media / converters / utils
electron/              主进程、预加载、内容剪藏、本地嵌入、媒体协议、备份与审计
tests/                 Playwright E2E（浏览器 + Electron）与跨模块单测
scripts/               构建、打包、ONNX 运行时与包体积预算
prototype/             静态原型：项目板、3D 地形、落地页（不参与构建）
docs/                  踩坑总结、性能规则、历史文档归档
release/               打包产物（不入库）
```

## 项目跟踪

- **[PROJECT.md](PROJECT.md)**：当前状态、路线图、结构、命令、可启动项、文档索引，改动只改这一处。
- `python board.py`：把 PROJECT.md 渲染成只读看板，同时扫描仓库给出 git 状态、目录规模与测试健康摘要。
- [CLAUDE.md](CLAUDE.md)：开发规范（分支、提交、数据格式、性能红线）。
- [docs/TOOLS.md](docs/TOOLS.md)：工具手册（调试、打包、索引、归档恢复）。
- [CHANGELOG.md](CHANGELOG.md)：版本变更；[docs/lessons-learned.md](docs/lessons-learned.md)：踩坑记录；[docs/performance.md](docs/performance.md)：性能规则。
- `docs/archive/`：历史计划、规格与评审（本地归档，不跟踪）。

## 质量门禁

| 命令 | 说明 |
| --- | --- |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm lint` | ESLint |
| `pnpm test:unit` | Vitest 单测（101 个文件 / 586 个用例） |
| `pnpm test:e2e` | Playwright E2E（20 个 spec） |
| `pnpm check:bundle` | 入口包体积预算 |

CI 见 [.github/workflows/ci.yml](.github/workflows/ci.yml)：Linux 质量门禁、Chromium E2E、Windows Electron E2E 三个 job。

## 技术栈

React 18 · TypeScript 5.9 · Vite 5 · React Flow 12 · BlockNote 0.31 · Zustand 5 · Electron 42 · Tailwind CSS 4 · Three.js · ONNX Runtime · sharp

## 发布

1. 确认版本号并更新 [CHANGELOG.md](CHANGELOG.md)。
2. `pnpm electron:pack`（免安装目录）或 `pnpm electron:dist`（NSIS 安装包）。
3. 在干净环境验证安装与启动。

打包注意：`ELECTRON_RUN_AS_NODE=1` 会让 exe 静默退出，构建/启动前需清除该环境变量。

## 说明

项目按个人实验节奏维护，不承诺稳定 API、向后兼容或及时响应 issue。欢迎把它当作学习 React、React Flow、Electron、文件型数据存储和 AI 辅助开发的参考样例。
