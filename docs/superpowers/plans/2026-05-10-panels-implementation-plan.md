# 左右侧面板及 UI 组件实现计划

## 一、概述

基于设计文档 `2026-05-10-panels-ui-design.md`，分阶段实现完整的 UI 面板系统。

---

## 二、实现阶段

### 阶段 1：扩展 libraryStore（预计 30 分钟）

**目标**：完善 libraryStore 的状态管理

**任务**：
1. 扩展 `src/utils/libraryStore.ts`
   - 添加 `editingCardId: string | null`
   - 添加 `cardLibrarySubTab: 'cards' | 'properties'`
   - 添加 `rightPanelCollapsed: boolean`
   - 添加 `rightPanelWidth: number`（默认 360）
   - 添加 `rightPanelActiveTab: 'library' | 'editor'`
   - 添加 `userSwitchedTab: boolean`
   - 将 `isLeftPanelOpen` 改为 `leftPanelCollapsed`
   - 添加 `toggleAllSidebars()` 方法（Tab 键触发）
   - 添加 localStorage 持久化

**验收标准**：
- ✅ 所有新状态正确添加
- ✅ localStorage 持久化正常工作
- ✅ Tab 键可以同时切换两个面板

---

### 阶段 2：共享 UI 组件（预计 1 小时）

**目标**：创建可复用的共享 UI 组件

**任务**：
1. 创建 `src/components/ui/SharedUI.tsx`
   - `SideTabButton`（侧边栏标签按钮）
   - `PanelHeader`（面板头部）
   - `PanelButton`（面板按钮）
   - `PanelSeparator`（面板分隔线）
   - `PanelSection`（面板区域）
   - `ExpandButton`（展开图标按钮，折叠后显示）

**验收标准**：
- ✅ 所有组件正确导出
- ✅ 组件支持亮色/暗色主题

---

### 阶段 3：左侧面板（LeftPanel）（预计 2 小时）

**目标**：实现完整的左侧面板功能

**任务**：
1. 创建 `src/components/ui/LeftPanel.tsx`
   - 工作区标题栏（显示工作区名称，点击展开设置浮层）
   - 视图切换按钮（画板库 / 卡片库 / 画布模式）
   - 画板列表（显示所有画板）
   - 新建画板输入框
   - 回收站入口按钮
   - 折叠按钮（右上角）

2. 创建 `src/components/ui/LeftPanelCollapsed.tsx`
   - 独立的展开图标按钮（折叠后显示）
   - 悬浮在画布左侧边缘

3. 实现画板列表交互
   - 点击切换画板（dispatchEvent 'hepta-switch-board'）
   - 双击重命名
   - 右键菜单（重命名、删除、复制、在资源管理器打开）

**验收标准**：
- ✅ 画板列表正确显示
- ✅ 点击画板可以切换
- ✅ 双击可以重命名
- ✅ 右键菜单功能正常
- ✅ 折叠后显示展开图标按钮
- ✅ 点击展开图标可以展开面板

---

### 阶段 4：卡片库视图（CardLibraryView）（预计 1.5 小时）

**目标**：实现卡片库网格视图

**任务**：
1. 创建 `src/components/ui/CardLibraryView.tsx`
   - 搜索框
   - 卡片网格
   - 卡片预览（颜色条 + 标题 + 预览文本）
   - 拖拽功能（默认引用，Alt 创建新实例）
   - 空状态

2. 实现文本缓存
   - 创建 `src/utils/cardTextCache.ts`
   - 缓存卡片标题、预览文本、搜索文本
   - LRU 清理策略

**验收标准**：
- ✅ 搜索功能正常
- ✅ 拖拽卡片到画布可以创建节点
- ✅ Alt+拖拽创建新实例
- ✅ 搜索输入不卡顿（使用 useDeferredValue）

---

### 阶段 5：画板库视图（BoardLibraryView）（预计 1 小时）

**目标**：实现画板库全屏视图

**任务**：
1. 创建 `src/components/ui/BoardLibraryView.tsx`
   - 画板网格（显示所有画板）
   - 画板预览（名称 + 更新时间）
   - 点击切换到该画板
   - 空状态

**验收标准**：
- ✅ 画板网格正确显示
- ✅ 点击画板可以切换

---

### 阶段 6：卡片编辑器视图（CardEditorView）（预计 1 小时）

**目标**：实现卡片编辑器视图

**任务**：
1. 创建 `src/components/ui/CardEditorView.tsx`
   - 卡片内容预览/编辑区域
   - 颜色选择器（6 种颜色）
   - 变体选择器（solid / glass / outline）
   - 折叠开关
   - 固定高度开关
   - 移出画板按钮

**验收标准**：
- ✅ 选中卡片时显示编辑器
- ✅ 颜色、变体可以切换
- ✅ 移出画板功能正常

---

### 阶段 7：右侧面板（RightPanel）（预计 2 小时）

**目标**：实现完整的右侧面板功能

**任务**：
1. 创建 `src/components/ui/RightPanel.tsx`
   - 标签栏（卡片库 / 编辑器）
   - 宽度调整手柄（拖拽左边缘）
   - 卡片库视图容器
   - 卡片编辑器视图容器
   - 折叠按钮（左上角）

2. 创建 `src/components/ui/RightPanelCollapsed.tsx`
   - 独立的展开图标按钮（折叠后显示）
   - 悬浮在画布右侧边缘

3. 实现标签切换逻辑
   - 选中卡片时自动切到编辑器（如果用户未手动切换）
   - 取消选中时切回卡片库

**验收标准**：
- ✅ 标签切换正常
- ✅ 宽度可以调整（260-600px）
- ✅ 宽度持久化到 localStorage
- ✅ 折叠后显示展开图标按钮

---

### 阶段 8：回收站面板（TrashBinPanel）（预计 1.5 小时）

**目标**：实现完整的回收站功能

**任务**：
1. 完善 `src/utils/trashStore.ts`
   - 添加 workspace 依赖注入
   - 实现 `loadFromWorkspace()` 方法
   - 实现 `cleanExpired()` 方法

2. 创建 `src/components/ui/TrashBinPanel.tsx`
   - Modal 弹窗
   - 标题 + 项目计数
   - 清空回收站按钮
   - 过期提示
   - 卡片网格
   - 空状态

3. 实现恢复逻辑
   - 恢复到原位置
   - 检查重叠并偏移

**验收标准**：
- ✅ 回收站列表正确显示
- ✅ 恢复卡片到原位置
- ✅ 永久删除功能正常
- ✅ 清空回收站功能正常

---

### 阶段 9：工具栏（Toolbar）（预计 1 小时）

**目标**：实现顶部工具栏

**任务**：
1. 创建 `src/components/ui/Toolbar.tsx`
   - 撤销/重做按钮
   - 缩放控制（放大/缩小/适应）
   - 设置按钮（打开设置弹窗）

**验收标准**：
- ✅ 撤销/重做功能正常
- ✅ 缩放控制功能正常

---

### 阶段 10：设置弹窗（SettingsDialog）（预计 1.5 小时）

**目标**：实现设置弹窗

**任务**：
1. 创建 `src/components/ui/SettingsDialog.tsx`
   - Modal 弹窗
   - 画布设置（网格模式、吸附模式、网格大小）
   - 主题设置（亮色/暗色/跟随系统）
   - 工作区操作（切换、新建、在资源管理器打开）
   - 导入导出（导出画板、导入画板）

2. 实现设置持久化
   - localStorage + 工作区 settings.json 双写

**验收标准**：
- ✅ 所有设置项功能正常
- ✅ 设置持久化正常

---

### 阶段 11：工作区选择器（WorkspacePicker）（预计 1 小时）

**目标**：实现工作区选择器

**任务**：
1. 创建 `src/components/ui/WorkspacePicker.tsx`
   - Modal 弹窗
   - 最近工作区列表
   - 打开其他工作区按钮
   - 新建工作区按钮

**验收标准**：
- ✅ 最近工作区列表正确显示
- ✅ 可以打开/新建工作区

---

### 阶段 12：集成到 App.tsx（预计 1.5 小时）

**目标**：将所有组件集成到应用

**任务**：
1. 修改 `src/App.tsx`
   - 布局结构：左面板 → 画布 → 右面板
   - 集成 LeftPanel / LeftPanelCollapsed
   - 集成 RightPanel / RightPanelCollapsed
   - 集成 Toolbar
   - 集成 TrashBinPanel（Modal）
   - 集成 SettingsDialog（Modal）
   - 集成 WorkspacePicker（启动时显示）
   - 视图模式切换逻辑

2. 实现启动逻辑
   - 自动恢复上次工作区
   - 失败时显示工作区选择器

**验收标准**：
- ✅ 布局正确显示
- ✅ 视图模式切换正常
- ✅ 启动时自动恢复工作区

---

### 阶段 13：测试与优化（预计 1 小时）

**目标**：测试所有功能，修复问题

**任务**：
1. 功能测试
   - 左右侧面板折叠/展开
   - 视图模式切换
   - 画板 CRUD
   - 卡片库搜索和拖拽
   - 卡片编辑器
   - 回收站
   - 设置面板
   - 工作区切换

2. 边缘情况测试
   - 空工作区
   - 大量卡片
   - 快速连续操作

**验收标准**：
- ✅ 所有功能正常
- ✅ 无 console error / warning

---

## 三、文件清单

### 新增文件

```
src/components/ui/
├── SharedUI.tsx           # 共享 UI 组件
├── LeftPanel.tsx          # 左侧面板
├── LeftPanelCollapsed.tsx # 左侧面板折叠状态展开按钮
├── RightPanel.tsx         # 右侧面板
├── RightPanelCollapsed.tsx# 右侧面板折叠状态展开按钮
├── Toolbar.tsx            # 工具栏
├── SettingsDialog.tsx     # 设置弹窗
├── TrashBinPanel.tsx      # 回收站面板
├── WorkspacePicker.tsx    # 工作区选择器
├── CardLibraryView.tsx    # 卡片库视图
├── BoardLibraryView.tsx   # 画板库视图
└── CardEditorView.tsx     # 卡片编辑器视图

src/utils/
└── cardTextCache.ts       # 卡片文本缓存
```

### 修改文件

```
src/utils/libraryStore.ts  # 扩展状态管理
src/utils/trashStore.ts    # 完善回收站功能
src/App.tsx                # 集成所有面板
```

---

## 四、时间估算

| 阶段 | 任务 | 预计时间 |
|------|------|---------|
| 1 | 扩展 libraryStore | 30 分钟 |
| 2 | 共享 UI 组件 | 1 小时 |
| 3 | 左侧面板 | 2 小时 |
| 4 | 卡片库视图 | 1.5 小时 |
| 5 | 画板库视图 | 1 小时 |
| 6 | 卡片编辑器视图 | 1 小时 |
| 7 | 右侧面板 | 2 小时 |
| 8 | 回收站面板 | 1.5 小时 |
| 9 | 工具栏 | 1 小时 |
| 10 | 设置弹窗 | 1.5 小时 |
| 11 | 工作区选择器 | 1 小时 |
| 12 | 集成到 App.tsx | 1.5 小时 |
| 13 | 测试与优化 | 1 小时 |
| **总计** | | **17 小时** |

---

## 五、执行顺序

按阶段顺序执行，每个阶段完成后进行验收，确保功能正常后再进入下一阶段。

建议执行顺序：
1. 阶段 1（libraryStore）→ 基础
2. 阶段 2（SharedUI）→ 基础组件
3. 阶段 3（LeftPanel）→ 左侧面板
4. 阶段 4（CardLibraryView）→ 卡片库
5. 阶段 6（CardEditorView）→ 编辑器
6. 阶段 7（RightPanel）→ 右侧面板
7. 阶段 5（BoardLibraryView）→ 画板库（可并行）
8. 阶段 8（TrashBinPanel）→ 回收站
9. 阶段 9（Toolbar）→ 工具栏
10. 阶段 10（SettingsDialog）→ 设置
11. 阶段 11（WorkspacePicker）→ 工作区选择器
12. 阶段 12（集成）→ 集成
13. 阶段 13（测试）→ 测试
