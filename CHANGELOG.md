# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-08-16

### 主题研究画布（Project）
- 画布可升级为「主题研究」模式（`projects/<boardId>.json` 元数据独立存储，不污染画板清单）
- 问题列表（Question）与成果（Outcome）管理：成果锚定画布卡片/Frame，可跨问题迁移
- 顶部主题栏（TopicBar）：创建主题、添加/重命名/删除问题、查看成果并一键聚焦画布节点
- 拖拽卡片/Frame 至主题栏可直接置入成果；悬停时高亮相关卡片提示

### 媒体管道
- 新增 `media:storeFile`：媒体按文件路径流式导入（大文件不再整读进内存）
- 导入时按内容 SHA-256 去重（同一文件重复拖入只存一份），原子化复制与变体生成
- 图片自动生成多档 webp 变体（依赖已存储原文件，保证与内容哈希一致）
- CSP 增加 `media-src` 以支持视频类媒体

### 画布与交互
- 缩放与拖拽性能优化（减少 per-frame 重渲染、非阻塞光标定位）
- 多选缩放器（MultiSelectionScaler）、弧形角柄、卡片等比缩放、媒体节点吸附
- 画板视口（viewport）持久化与恢复
- 暗色模式卡片描边降亮、圆角裁切修复；多选/编辑态黑边问题消除
- 编辑态焦点行为修正（编辑中取消选中其他节点、卡片切换无残留）

### 卡片库与语义
- 本地向量索引可靠性修复（增量重试、缺失模型降级）
- 相关性排序可脱离当前编辑卡片独立激活（relatedSourceCardId），源卡片删除时自动回退
- 「寻找相似卡片」入口（摘要菜单）；拖拽卡片时画布内相关卡片虚线提示
- 密度总览（Density Overview）改为纯空间全览

### 可靠性与运维
- 文件系统备份/恢复服务（backupStore）、备份摘要与冲突恢复改进
- workspace 数据丢失审计日志（auditWorkspaceHealth）
- 新设置「关于」页（应用版本）；打包产物清理 source map 与 TS 源码
- 移除失效的手工 e2e 脚本（引用已废弃 API），补充 unit/CSP 测试

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
