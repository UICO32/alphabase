---
name: card-library-ui-improvements
description: 卡片库视图 UI 改进 + 冲突对话框增强
---

# 卡片库视图 UI 改进设计

## 问题清单

1. 启动冲突对话框信息不具体，选项不足
2. 卡片预览视图图片不显示
3. 标题底部被裁切，h1/h2/h3 过大
4. 图片需正方形排列在左下角，多图层叠
5. 事件信息移到标题左侧，只显示相对时间并加粗
6. 排序切换 bug：向量化后无法切换到「相关性」

---

## 1. 冲突对话框改进

### 现状

- `validateConsistency()` 只比较卡片/画板数量
- 冲突时只提供「保留磁盘数据」「使用备份恢复」两个选项
- 用户无法了解具体哪些卡片有差异

### 改进

**ConflictData 扩展**

```typescript
interface ConflictDiffItem {
  id: string
  title: string
  type: 'card' | 'board'
  diffType: 'extra' | 'missing'  // 磁盘多出 | 磁盘缺失
  updatedAt?: number
}

interface ConflictData {
  expectedCards: number
  actualCards: number
  expectedBoards: number
  actualBoards: number
  diffItems: ConflictDiffItem[]  // 新增：差异项列表
}
```

**新增选项**

- 「自动合并」：调用 `repairConsistency()` 合并双方数据
- 保留现有：「保留磁盘数据」「使用备份恢复」「取消加载」

**根因修复**

检查退出流程是否正确调用 `saveMetadata()`，避免误报冲突。

---

## 2. 卡片预览图片不显示

### 现状

- `previewHTML` 中包含 `<img>` 标签
- `dangerouslySetInnerHTML` 渲染后被 `line-clamp-3` + `overflow-hidden` 裁掉

### 改进

- 从 `previewHTML` 提取图片 URL（复用 MiniCard 的 `extractImages`）
- 图片单独渲染为缩略图，不放在 preview 文本流中
- 预览文本过滤掉 `<img>` 标签

---

## 3. 标题裁切 + heading 过大

### 现状

- `renderBlocksToHTML` 中 h1/h2/h3 字号为 `3em/2em/1.3em`
- 在 140px 宽的小卡片中过大

### 改进

在 `CardLibraryView` 的 `.card-preview-html` 容器加 CSS 覆盖：

```css
.card-preview-html h1,
.card-preview-html h2,
.card-preview-html h3 {
  font-size: 1em;
  font-weight: 600;
  margin: 0;
}
```

---

## 4. 图片正方形左下角层叠

### 设计

- 位置：卡片左下角
- 尺寸：32x32px 正方形
- 层叠：多图时从左到右偏移 8px，最新图片 z-index 最高
- 数量：最多显示 4 张，超出显示 `+N`

### 布局示意

```
┌─────────────────────┐
│ 标题                │
│ 预览文本...         │
│                     │
│ ┌──┐ ┌──┐ ┌──┐      │
│ │1 │ │2 │ │3 │      │
│ └──┘ └──┘ └──┘      │
└─────────────────────┘
```

---

## 5. 事件信息移到标题左侧

### 现状

- 日期在卡片底部右下角
- 格式：`2026/5/30`

### 改进

- 移到标题行左侧，同一行
- 格式：只显示相对时间，如「3天前」
- 样式：加粗

```jsx
<div className="flex items-center gap-1.5">
  <span className="font-semibold text-[10px]">{relativeTime}</span>
  <span className="text-sm font-medium truncate">{title}</span>
</div>
```

---

## 6. 排序切换 bug

### 现状

- `sortBy === 'related'` 时，如果 `!indexed` 会自动 `setSortBy('updatedAt')`
- 向量化完成后 `indexed` 变为 true，但 sortBy 已被切走

### 改进

- 记录用户意图：`pendingRelatedSort` ref
- 向量化完成后，如果 `pendingRelatedSort.current`，自动切换到 'related'
- 或在 UI 显示「向量化中，相关性排序稍后可用」

---

## 实现文件

1. `src/components/ui/WorkspaceConflictDialog.tsx` - 冲突对话框 UI
2. `src/services/WorkspaceService.ts` - validateConsistency 返回 diffItems
3. `src/hooks/useWorkspaceDataLoader.ts` - 处理「自动合并」选项
4. `src/components/ui/CardLibraryView.tsx` - 卡片库视图布局重构
5. `src/utils/relativeTime.ts` - 相对时间格式化（新建）
6. `src/theme/tokens.css` - CSS 覆盖 heading 样式
