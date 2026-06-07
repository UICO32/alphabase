# 预览态一致性修复 & 图片分列功能

日期: 2026-05-31

## 背景

卡片预览态使用 `renderBlocks.ts` 手工生成 HTML，编辑态使用 BlockNote Mantine 渲染器。两者在空格保留、链接样式、checkListItem 等方面存在视觉差异。同时用户希望支持图片分列功能。

## 问题 1: 预览态与编辑态不一致

### 1.1 空格/换行丢失

**根因**: ProseMirror 编辑态使用 `white-space: break-spaces`，保留所有空格和换行。预览态 HTML 容器默认 `white-space: normal`，多个连续空格被浏览器折叠为单个。

**修复**: 在 `CardContent.tsx` 预览态的 `dangerouslySetInnerHTML` 容器上添加 `whiteSpace: 'break-spaces'`。同时在 `renderInlineContent` 中将连续空格（`  `）转为 `&nbsp; ` 模式，确保极端情况也保留。

### 1.2 链接缺少下划线

**根因**: 预览态 `renderBlocks.ts` 中链接样式为 `color:inherit;text-decoration:underline`，但实际浏览器渲染时下划线未生效（可能被 DOMPurify 或其他 CSS 覆盖）。用户反馈预览态链接没有下划线，编辑态有。

**修复**: 确保预览态链接渲染的 `<a>` 标签 `text-decoration: underline` 生效，检查 DOMPurify 配置是否过滤了 `style` 属性中的 `text-decoration`。颜色保持 `inherit`。

### 1.3 checkListItem 样式差异

**根因**: 编辑态 BlockNote 的 checkListItem 结构是 `display:flex; width:100%`，checkbox 用 `margin-inline-end:0.5em`。预览态用 `display:flex;align-items:flex-start;gap:0.5em`，checkbox 是原生 `<input type="checkbox">` 且无大小限制。

用户反馈的"分列效果"可能是 checkbox 未约束大小导致布局异常。

**修复**: 修改 `renderBlocks.ts` 中 checkListItem 的渲染：
- checkbox: 添加固定尺寸 `width:1em;height:1em;min-width:1em`，与 BlockNote 一致
- 容器: 改为 `display:flex;align-items:center;gap:0` ，checkbox 用 `margin-inline-end:0.5em`
- 文字区: 去掉 `width:100%`，改为 `flex:1;min-width:0`

### 1.4 下划线

编辑态和预览态都用 `<u>` 标签，样式基本一致。无需修改。

## 问题 2: 图片分列功能

### 需求

在 BlockNote 斜杠菜单中加入"图片分列"选项，允许多张图片并排排列。

### 设计

#### 自定义 Block Type: `imageRow`

```typescript
// schema
{
  type: 'imageRow',
  props: {
    urls: { default: [] as string[] },      // 图片 URL 数组
    captions: { default: [] as string[] },   // 对应标题数组
  },
  content: 'none',
}
```

#### 渲染

编辑态: React 组件渲染为 flex 行，每张图片等宽排列，支持拖拽排序和添加/删除。
预览态: `renderBlocks.ts` 中渲染为 `<div style="display:flex;gap:8px">` 内含等宽 `<img>`。

#### 斜杠菜单注册

在 `CardSlashMenu` 中添加 `imageRow` 选项：
- 触发词: `/图片分列` 或 `/images`
- 图标: 图片列图标
- 插入后弹出文件选择器，可多选图片

#### 交互流程

1. 用户输入 `/图片分列` → 从斜杠菜单选择
2. 弹出文件选择器（多选）
3. 选中的图片以等宽 flex 行排列
4. 支持后续添加/删除图片（悬停显示操作按钮）

### 简化方案

考虑到 BlockNote 自定义 block 的复杂度，第一版采用简化实现：
- 不做拖拽排序
- 添加时通过悬浮 "+" 按钮追加图片
- 删除通过悬浮 "x" 按钮移除单张
- 最少 1 张，最多 4 张图片

## 影响范围

| 文件 | 改动 |
|------|------|
| `src/converters/renderBlocks.ts` | 修复空格、链接、checkListItem 样式；新增 imageRow 渲染 |
| `src/components/canvas/card/CardContent.tsx` | 预览态容器添加 `whiteSpace: 'break-spaces'` |
| `src/components/editor/BlockNoteEditor.tsx` | 注册 imageRow 自定义 block + 斜杠菜单项 |
| 新增 `src/components/editor/ImageRowBlock.tsx` | imageRow 编辑态渲染组件 |
| `src/stores/cardStore.ts` | 预览 HTML 生成自动覆盖 imageRow |

## 验证标准

1. 预览态空格、换行与编辑态一致
2. 预览态链接带下划线，与编辑态一致
3. 预览态 checkListItem 布局与编辑态一致，无"分列"异常
4. `/图片分列` 斜杠菜单项可用
5. 图片分列支持 2-4 张图片并排
6. 预览态正确渲染 imageRow
