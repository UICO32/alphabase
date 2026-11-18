# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### 工作区数据安全
- 切换工作区时取消 5 秒备份与 10 秒内联媒体迁移任务，并在执行前校验工作区归属，避免写入错误目录
- 画板清单 `boards/_manifest.json` 丢失时从已有 `boards/*.json` 重建，不再写空清单导致画板不可见
- 数据冲突弹窗按「缺少 / 多出」区分推荐项；「先不加载」不再创建演示卡片或默认画板，也不产生任何写入
- 工作区加载失败改为显式错误页，提示数据仍保留在原目录，并提供重试与重新选择
- 移除浏览器目录选择兜底，避免把相对目录名当作工作区路径
- 工作区选择器文案改为「选择文件夹作为工作区」，明确不会移动或删除已有文件

### 画布性能（长文本卡片）
- 视口相关 CSS 变量不再写在画布根节点上：`--rf-inv-zoom` 只写到消费它的 Frame 与缩放预览元素，
  删除无人使用的 `--rf-zoom`；缩放提交的整棵卡片树样式重算（120 张长文本卡约 164ms）降到 4ms 以内
- 密度总览淡出改为直接给 nodes / edges / background 三个容器写 `opacity`，不再逐节点重算样式
- 缩放预览态（zoom ≤ 0.55）下卡片正文不再参与排版与绘制（正文已被标题/摘要遮住）
- 实测（120 张重叠长文本卡）：滚轮缩放帧 p95 233/183ms → 33ms，平移 Paint 99ms → 23ms
- 新增 E2E 回归 `canvas-rich-text.spec.ts`，锁定上述三条契约

### 数据持久化修复
- 排空挂起写入时按最终路径归并：拖拽中关闭窗口不再可能用旧快照覆盖拖拽期间的最新快照
- 跨画板移动复用统一的画板序列化，避免与常规落盘路径的节点/边形态分叉

### 代码质量
- 密度统计缓存改为按卡片对象引用的 `WeakMap`（去掉近似 LRU 与测试专用计数器）
- 背景网格首帧与命令式更新共用同一套几何算法；高度合并器统一命名为 `createHeightBatcher`
- 对齐工具栏用视口原始值做依赖；E2E 临时工作区注入抽成共享 helper

## [0.2.1] - 2026-08-16

### 品牌与发布
- 统一项目、桌面应用、API、文档和测试中的产品名称为 Alphabase
- 生成 Alphabase Windows x64 NSIS 安装包
- 修正 release notes 的 Markdown 换行

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
