# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-06-09

首个打包版本。从 tldraw 迁移到 React Flow 的画布知识管理桌面应用。

### 画布核心
- React Flow 画布替代 tldraw，解决编辑器冲突
- 卡片节点（CardNode）内嵌 BlockNote 编辑器
- Frame 节点替代 Section，支持跨 Frame 拖拽
- 连接线系统：拖拽连线、自动吸附、移动时实时更新
- 卡片对齐工具栏（AlignmentToolbar）
- Ctrl+C/V 复制粘贴卡片，支持跨画板
- 双击画布空白区域创建卡片
- 图片行块（ImageRowBlock），锁定宽高比缩放
- 50+ 卡片性能优化：视口裁剪、精确通知、memoization

### 卡片库与面板
- 卡片库视图（CardLibraryView）
- 画板库视图（BoardLibraryView）
- 右侧面板：编辑器/网页预览切换
- WebviewPanel：卡片内链接点击打开网页预览
- Clip 视图切换：卡片操作栏内嵌 clip toggle
- 设置面板：高斯模糊、固定高度、跟随系统主题

### 数据持久化
- 文件系统持久化替代 localStorage
- 原子写入 + 备份轮转
- 回收站（trash）支持
- 同步引擎（syncEngine）自动保存
- 工作区切换与冲突检测

### 嵌入与语义搜索
- EmbeddingService：ONNX Runtime 本地嵌入
- 文本提取：BlockNote JSON → Markdown
- 嵌入向量存储与检索

### 内容剪辑
- URL 剪辑器：小红书/微信公众号/通用网页
- Sharp 图片压缩下载
- IPC 主进程剪辑流程

### 3D 地形视图
- TopographyView：Three.js 3D 地形
- 聚类缓存 + LLM 命名

### Electron
- Splash Window：深色主题、进度动画、IPC 通信
- 启动性能优化：temp file 即时加载
- ready-to-show fallback 防止卡死
- 预加载脚本暴露 electronAPI
- ELECTRON_RUN_AS_NODE 防护（dev 模式）

### 重构
- 类型化事件总线替代 window.dispatchEvent
- 消除 any 类型，集中 CardNodeData 类型
- 面板系统重构：分段控件、标签子组件
- 同步/转换/存储目录迁移
- domino → linkedom 替换

### 测试
- cardStore / boardStore / trashStore 单元测试
- syncEngine 写入/删除/flush 测试
- geometry / cardStyles / fileUtils 单元测试
