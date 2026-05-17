# URL 剪藏功能设计

## 概述

为画布应用添加 URL 剪藏功能：用户粘贴网页 URL，系统自动抓取内容、下载图片、创建卡片。

## 架构

Electron IPC 通道替代参考文档的 Express 服务器，自定义协议 `hepta-media://` 替代 HTTP 图片路由。

```
用户粘贴 URL → 骨架卡片(蓝色) → IPC 调用主进程 → 抓取+解析+下载图片
→ 返回结果 → htmlToBlocks → 更新卡片(白色)
```

## 后端（Electron 主进程）

### 文件结构

```
electron/clipper/
  types.ts              # 类型定义
  handler.ts            # IPC handler + handleClip() 主流程
  extractor.ts          # 通用提取器 (Readability + Turndown)
  platforms/xhs.ts      # 小红书解析
  platforms/wechat.ts   # 微信公众号解析
  imageDownloader.ts    # 图片下载 + Sharp 压缩
  logger.ts             # 统一日志
```

### IPC 通道

| 通道 | 参数 | 返回 |
|------|------|------|
| `clipper:clip` | `{ url, workspacePath }` | `ClipResult` |

### handleClip() 流程

1. fetch 目标 URL（UA 伪装，25s 超时，follow redirect）
2. 平台检测（hostname 匹配）→ 专用解析器 or 通用提取器
3. 若 markdown 为空 → Turndown 转 markdown
4. 若有图片 → downloadImages() 下载+压缩 → 写入 `<workspace>/media/`
5. 替换 HTML/Markdown 中图片 URL → `hepta-media://<filename>`
6. 返回 ClipResult

### 自定义协议

`hepta-media://<filename>` → 读取 `<workspace>/media/<filename>` 返回文件

### 图片压缩策略

- 质量 85%，最大宽度 1200px
- 低于 300KB 跳过压缩，原样保存
- SVG/GIF 不压缩
- 单张下载失败不影响整体，保留原始 URL

### 平台解析器

- **小红书**：从 `window.__INITIAL_STATE__` SSR JSON 提取，失败回退通用提取器
- **微信公众号**：DOM 选择器提取正文，处理防盗链图片，检测反爬验证码
- **通用**：Readability + Turndown，处理懒加载图片

## 前端

### 文件结构

```
src/utils/clipper.ts        # IPC 调用封装
src/utils/htmlToBlocks.ts   # HTML → BlockNote 块转换
src/components/ui/ClipUrlBar.tsx  # URL 输入交互组件
src/components/ui/Toolbar.tsx     # 添加剪藏按钮
```

### UI 交互

1. 工具栏添加剪藏按钮（剪刀图标）
2. 点击后弹出 URL 输入框
3. 粘贴 URL → Enter
4. 画布中央创建骨架卡片（蓝色，"剪藏中…"）
5. 成功：更新卡片内容（白色，可编辑）
6. 失败：更新卡片显示错误（黄色）

### htmlToBlocks 映射

| HTML | BlockNote 块 |
|------|-------------|
| h1-h6 | heading（h4-h6 降级为 level 3） |
| p | paragraph（仅含 img 则转 image 块） |
| ul/ol > li | bulletListItem |
| blockquote | paragraph |
| pre > code | codeBlock |
| img | image（props: { url: src }） |

### 行内样式

strong/b → bold, em/i → italic, a → link, code → code

## 依赖

| 包 | 用途 |
|---|------|
| `@mozilla/readability` | 正文提取 |
| `jsdom` | Node.js DOM 解析 |
| `turndown` | HTML → Markdown |
| `sharp` | 图片压缩 |

## 错误处理

| code | 含义 |
|------|------|
| TIMEOUT | 请求超时 |
| FETCH_ERROR | 网页抓取失败 |
| PARSE_ERROR | URL 格式无效 |
| NO_CONTENT | 无法提取有效内容 |
| WECHAT_CAPTCHA | 微信反爬验证拦截 |
