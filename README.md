# Heptabase Canvas v2

基于 React Flow 的画布知识管理桌面应用。

## 打包构建修复：pnpm + electron-builder

**根因**：pnpm 的依赖隔离 + electron-builder 的 pnpm 检测逻辑，导致传递依赖被打包时遗漏。

**两步修复**：

1. `.npmrc` 添加 `node-linker=hoisted` — 让 pnpm 把所有依赖提升到顶层 `node_modules/`（扁平结构），不再使用符号链接隔离
2. `scripts/electron-pack.mjs` — 打包时临时隐藏 `pnpm-lock.yaml` 和 `node_modules/.modules.yaml`，让 electron-builder 用 npm 逻辑收集 node_modules，确保所有提升的依赖都被包含进 asar

**打包命令**：
```bash
node scripts/electron-pack.mjs
```