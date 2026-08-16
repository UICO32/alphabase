# Alphabase

一个基于 React Flow 的桌面知识画布项目：把卡片、Frame、问题、成果和本地资料放在同一张可缩放、可连接、可持续保存的研究画布里。

> 这是一个 vibe project，仅用于学习、实验和个人研究参考，不代表商业产品，也不保证生产环境可用。

## 功能

- React Flow 知识画布：卡片、Frame、连接线、拖拽、多选、缩放和视口恢复
- 主题研究模式：主题栏、问题（Question）、成果（Outcome）和成果聚焦
- 本地工作区：文件系统持久化、备份/恢复、回收站、冲突检测和健康审计
- 内容与媒体：BlockNote 编辑器、网页剪藏、图片/视频导入、内容哈希去重和 WebP 变体
- 语义能力：本地向量索引、相关卡片、相似卡片和拖拽时的相关性提示
- Electron 桌面能力：原生文件访问、窗口、菜单、托盘、媒体协议和安全边界
- 自动质量检查：Lint、TypeScript、Vitest 单测、Chromium E2E、Electron E2E 和包体积预算

## 架构

```text
React renderer
├─ src/components       UI、画布节点、面板和编辑器
├─ src/stores            卡片、画板、工作区、面板和视图状态
├─ src/hooks             交互、事件、缩放和数据加载生命周期
└─ src/services          同步、备份、媒体、嵌入和工作区服务

Electron
├─ electron/main.ts      主进程、窗口、IPC 和安全策略
├─ electron/preload.ts   受控的 renderer API
└─ electron/*            文件、媒体、嵌入、备份和审计能力

Quality
├─ tests/e2e             浏览器和 Electron 端到端测试
├─ src/**/*.test.ts      Vitest 单元测试
└─ .github/workflows     GitHub Actions 持续集成
```

## 角色

- 画布层：负责空间关系、节点交互、缩放性能和视觉反馈
- 内容层：负责卡片、Frame、问题、成果和编辑器数据
- 工作区层：负责文件系统持久化、同步、备份、恢复和冲突处理
- 语义层：负责本地嵌入、索引、相关性和相似内容
- 桌面层：负责 Electron 主进程、预加载桥接、原生能力和安全边界
- 质量层：负责单测、E2E、Lint、类型检查、构建和发布前验证

## 本地开发

```bash
pnpm install
pnpm dev                 # 浏览器开发模式
pnpm electron:dev        # Electron 开发模式
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:e2e
pnpm electron:dist       # 生成 Windows 安装包（Windows）
```

## 发布与贡献

提交信息使用简短的 Conventional Commits 风格前缀，例如 `feat`、`fix`、`perf`、`refactor`、`test`、`docs`、`chore`。发布前应通过质量检查、浏览器 E2E、Electron E2E 和构建预算检查。

项目按个人实验节奏维护，不承诺稳定 API、向后兼容或及时响应 issue。欢迎把它当作学习 React、React Flow、Electron、文件型数据存储和 AI 辅助开发的参考样例。
