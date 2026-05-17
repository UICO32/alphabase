# 卡片编辑能力完善设计

## 概述

完善卡片在编辑态下的交互体验：滚动行为、图片尺寸一致性、右侧面板可拖拽调整宽度。

---

## 1. 卡片编辑态滚动

### 问题

编辑态卡片内鼠标滚动时，滚轮事件冒泡到 ReactFlow 画布导致画布平移，而非滚动卡片内容。

### 方案

- 在 `CardContent.tsx` 的内容区域 div 上添加 `onWheel={(e) => e.stopPropagation()}`，阻止滚轮事件冒泡到画布
- 编辑态外层 div 添加 `overflow-y: auto`，使内容可上下滚动
- BlockNote 编辑器 `.bn-container` 的 `overflow` 从 `visible` 改为 `hidden`，让 `.bn-editor` 的 `overflow-y: auto` 正确生效
- 拖拽操作栏（28px `card-drag-handle`）保持固定在顶部，不参与滚动
- 预览态同样添加 `onWheel` stopPropagation

### 涉及文件

- `src/components/canvas/card/CardContent.tsx` — 添加 onWheel stopPropagation，编辑态添加 overflow-y: auto
- `src/components/editor/BlockNoteEditor.tsx` — `.bn-container` overflow 改为 hidden

---

## 2. 图片预览/编辑态尺寸一致性

### 问题

预览态图片通过 `renderBlocks.ts` HTML 模板渲染，编辑态由 BlockNote Mantine 渲染器控制，两者间距和尺寸可能不一致。

### 方案

在 `BlockNoteEditor.tsx` 注入的 CSS 中，为图片块添加与预览态一致的样式：

```css
.card-blocknote-editor [data-content-type="image"] img {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  display: block;
  margin: 4px 0;
}
```

预览态图片样式（`renderBlocks.ts`）保持不变：
```
max-width:100%; height:auto; border-radius:6px; display:block; margin:4px 0
```

### 涉及文件

- `src/components/editor/BlockNoteEditor.tsx` — 注入图片块样式

---

## 3. 右侧面板拖拽调整宽度

### 问题

右侧面板固定 320px 宽度，无法调整。卡片库在窄面板下无法显示多列。

### 方案

#### 3.1 使用 libraryStore 中已有的 rightPanelWidth

- `libraryStore.ts` 已有 `rightPanelWidth` state 和 `setRightPanelWidth` action
- 将默认值从 360 改为 320（与当前行为一致）
- 将 `SIDEBAR_WIDTH_MIN` 从 260 改为 240，`SIDEBAR_WIDTH_MAX` 保持 600
- `RightPanel.tsx` 使用 `rightPanelWidth` 替代固定常量 `RIGHT_PANEL_WIDTH`

#### 3.2 拖拽手柄

- 在面板左边缘添加 4px 宽的拖拽区域
- hover 时显示 2px 宽的蓝色竖线视觉提示，cursor: col-resize
- mousedown → document mousemove/mouseup 拖拽逻辑
- 拖拽时实时更新面板宽度（通过 setRightPanelWidth）
- 宽度限制在 240-600px 范围内（store 中已有 clamp 逻辑）

#### 3.3 内容自适应

- `CardLibraryView` grid 列宽从 `minmax(200px, 1fr)` 改为 `minmax(140px, 1fr)`，让窄面板也能显示多列
- `CardEditorView` 内容已使用 flex-1 布局，自适应面板宽度

### 涉及文件

- `src/utils/libraryStore.ts` — 调整默认值和最小值
- `src/components/ui/RightPanel.tsx` — 使用 rightPanelWidth，添加拖拽手柄
- `src/components/ui/CardLibraryView.tsx` — grid 列宽自适应

---

## 验证标准

1. 卡片编辑态下鼠标滚动只滚动卡片内容，画布不平移
2. 卡片预览态下鼠标滚动同样不触发画布平移
3. 图片在预览态和编辑态下尺寸、圆角、间距一致
4. 右侧面板可拖拽左边缘调整宽度，范围 240-600px
5. 面板变窄时卡片库自动变为更少列数，变宽时变为更多列数
6. 面板内容（编辑器、卡片库）自适应面板宽度
