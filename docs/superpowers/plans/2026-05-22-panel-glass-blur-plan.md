# 面板高斯模糊效果实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为大型面板（LeftPanel、RightPanel）添加高性能高斯模糊效果，同时将小型元素（工具栏、弹窗、折叠按钮等）改为实色背景。

**Architecture:** 新增 `.glass-panel-large` CSS 类用于大面积面板模糊，附带 GPU 加速和重绘隔离优化；移除小型元素上的 `glass-panel` 类，统一使用实色背景。

**Tech Stack:** React 18 + TypeScript + Tailwind CSS + Vite

---

## 文件变更清单

### 创建
- 无新文件

### 修改
1. `src/theme/tokens.css` — 新增 `.glass-panel-large` 类及降级方案
2. `src/components/ui/LeftPanel.tsx` — 背景改为模糊
3. `src/components/ui/RightPanel.tsx` — 背景改为模糊
4. `src/components/ui/Toolbar.tsx` — 移除 `glass-panel`，改为实色
5. `src/components/ui/TitleBar.tsx` — 移除 `glass-panel`，改为实色
6. `src/components/ui/LeftPanelCollapsed.tsx` — 移除 `glass-panel`，改为实色
7. `src/components/ui/RightPanelCollapsed.tsx` — 移除 `glass-panel`，改为实色
8. `src/components/ui/ContextMenu.tsx` — 移除 `glass-panel`，改为实色
9. `src/components/ui/ClipUrlBar.tsx` — 移除 `glass-panel`，改为实色
10. `src/components/ui/WorkspacePicker.tsx` — 移除 `glass-panel`，改为实色
11. `src/components/ui/TrashBinPanel.tsx` — 移除 `glass-panel`，改为实色
12. `src/components/ui/CardEditDialog.tsx` — 移除 `glass-panel`，改为实色

---

### Task 1: 新增 `.glass-panel-large` CSS 类

**Files:**
- Modify: `src/theme/tokens.css`

- [ ] **Step 1: 在 `.glass-panel` 下方新增 `.glass-panel-large` 类**

在 `src/theme/tokens.css` 中，找到 `.glass-panel` 的定义（约第 218 行），在其后添加：

```css
.glass-panel-large {
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  background-color: var(--surface-panel);
  box-shadow: var(--panel-border-glow), var(--shadow-lg);
  /* 性能优化 */
  will-change: transform;
  transform: translateZ(0);
  contain: layout style paint;
}
```

- [ ] **Step 2: 添加降级方案**

在 `@supports not (backdrop-filter: blur(20px))` 块内（约第 241 行），追加 `.glass-panel-large` 的降级：

```css
@supports not (backdrop-filter: blur(20px)) {
  .glass-panel {
    background-color: hsl(var(--panel-hue, 0), 6%, 96%);
  }
  .glass-card {
    background-color: hsl(var(--panel-hue, 0), 4%, 100%);
  }
  .glass-panel-large {
    background-color: hsl(var(--panel-hue, 0), 6%, 96%);
  }

  [data-theme="dark"] .glass-panel {
    background-color: hsl(var(--panel-hue, 220), 20%, 10%);
  }
  [data-theme="dark"] .glass-card {
    background-color: hsl(var(--panel-hue, 220), 18%, 12%);
  }
  [data-theme="dark"] .glass-panel-large {
    background-color: hsl(var(--panel-hue, 220), 20%, 10%);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/theme/tokens.css
git commit -m "feat(ui): add glass-panel-large class with GPU optimizations"
```

---

### Task 2: LeftPanel 添加模糊效果

**Files:**
- Modify: `src/components/ui/LeftPanel.tsx`

- [ ] **Step 1: 修改 motion.div 的 style，添加 glass-panel-large 类**

找到 `motion.div`（约第 56 行），将：

```tsx
style={{ width: SIDEBAR_WIDTH, backgroundColor: surface.panelBg }}
```

改为：

```tsx
style={{ width: SIDEBAR_WIDTH }}
className="glass-panel-large"
```

注意：当 `className` 中已有条件类名时，需要合并：

```tsx
className={`${isBoardView ? 'absolute left-0 top-0 bottom-0 z-10' : 'shrink-0'} flex flex-col h-full overflow-hidden glass-panel-large`}
style={{ width: SIDEBAR_WIDTH }}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/LeftPanel.tsx
git commit -m "feat(ui): apply glass blur to LeftPanel"
```

---

### Task 3: RightPanel 添加模糊效果

**Files:**
- Modify: `src/components/ui/RightPanel.tsx`

- [ ] **Step 1: 修改 motion.div 的 style，添加 glass-panel-large 类**

找到 `motion.div`（约第 58 行），将：

```tsx
style={{ width: rightPanelWidth, backgroundColor: surface.panelBg }}
```

改为：

```tsx
style={{ width: rightPanelWidth }}
className="absolute right-0 top-0 bottom-0 z-10 flex flex-col overflow-hidden glass-panel-large"
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/RightPanel.tsx
git commit -m "feat(ui): apply glass blur to RightPanel"
```

---

### Task 4: Toolbar 改为实色背景

**Files:**
- Modify: `src/components/ui/Toolbar.tsx`

- [ ] **Step 1: 移除 `glass-panel` 类，添加实色背景**

将第 16 行的：

```tsx
className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-2 rounded-xl z-40 animate-fadeInUp glass-panel"
```

改为：

```tsx
className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-2 rounded-xl z-40 animate-fadeInUp"
style={{ backgroundColor: surface.panelBg, boxShadow: 'var(--shadow-lg)' }}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/Toolbar.tsx
git commit -m "feat(ui): change Toolbar to solid background"
```

---

### Task 5: TitleBar 改为实色背景

**Files:**
- Modify: `src/components/ui/TitleBar.tsx`

- [ ] **Step 1: 移除 `glass-panel` 类，添加实色背景**

将第 9 行的：

```tsx
className="flex items-center h-7 shrink-0 select-none glass-panel"
```

改为：

```tsx
className="flex items-center h-7 shrink-0 select-none"
style={{ backgroundColor: surface.panelBg }}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/TitleBar.tsx
git commit -m "feat(ui): change TitleBar to solid background"
```

---

### Task 6: LeftPanelCollapsed 改为实色背景

**Files:**
- Modify: `src/components/ui/LeftPanelCollapsed.tsx`

- [ ] **Step 1: 移除 `glass-panel` 类，添加实色背景**

将第 11 行的：

```tsx
className="btn-base fixed top-1/2 -translate-y-1/2 left-0 z-50 flex items-center justify-center w-6 h-10 rounded-r-lg hover:shadow-xl glass-panel"
```

改为：

```tsx
className="btn-base fixed top-1/2 -translate-y-1/2 left-0 z-50 flex items-center justify-center w-6 h-10 rounded-r-lg hover:shadow-xl"
style={{ backgroundColor: surface.panelBg, boxShadow: 'var(--shadow-md)' }}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/LeftPanelCollapsed.tsx
git commit -m "feat(ui): change LeftPanelCollapsed to solid background"
```

---

### Task 7: RightPanelCollapsed 改为实色背景

**Files:**
- Modify: `src/components/ui/RightPanelCollapsed.tsx`

- [ ] **Step 1: 移除 `glass-panel` 类，添加实色背景**

将第 18 行的：

```tsx
className="btn-base fixed top-1/2 -translate-y-1/2 right-0 z-50 flex items-center justify-center w-6 h-12 rounded-l-lg glass-panel"
```

改为：

```tsx
className="btn-base fixed top-1/2 -translate-y-1/2 right-0 z-50 flex items-center justify-center w-6 h-12 rounded-l-lg"
style={{ backgroundColor: surface.panelBg, boxShadow: 'var(--shadow-md)' }}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/RightPanelCollapsed.tsx
git commit -m "feat(ui): change RightPanelCollapsed to solid background"
```

---

### Task 8: ContextMenu 改为实色背景

**Files:**
- Modify: `src/components/ui/ContextMenu.tsx`

- [ ] **Step 1: 移除 `glass-panel` 类，添加实色背景**

找到使用 `glass-panel` 的位置（约第 21 行），将：

```tsx
className="fixed z-50 py-1 rounded-lg min-w-[160px] animate-scaleIn glass-panel"
```

改为：

```tsx
className="fixed z-50 py-1 rounded-lg min-w-[160px] animate-scaleIn"
style={{ backgroundColor: surface.panelBg, boxShadow: 'var(--shadow-lg)' }}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/ContextMenu.tsx
git commit -m "feat(ui): change ContextMenu to solid background"
```

---

### Task 9: ClipUrlBar 改为实色背景

**Files:**
- Modify: `src/components/ui/ClipUrlBar.tsx`

- [ ] **Step 1: 移除 `glass-panel` 类，添加实色背景**

找到使用 `glass-panel` 的位置（约第 110 行），将：

```tsx
className="fixed bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-2 rounded-xl z-50 animate-fadeInUp glass-panel"
```

改为：

```tsx
className="fixed bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-2 rounded-xl z-50 animate-fadeInUp"
style={{ backgroundColor: surface.panelBg, boxShadow: 'var(--shadow-lg)' }}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/ClipUrlBar.tsx
git commit -m "feat(ui): change ClipUrlBar to solid background"
```

---

### Task 10: WorkspacePicker 改为实色背景

**Files:**
- Modify: `src/components/ui/WorkspacePicker.tsx`

- [ ] **Step 1: 移除 `glass-panel` 类，添加实色背景**

找到使用 `glass-panel` 的位置（约第 37 行），将：

```tsx
className="modal-content w-[500px] max-h-[80vh] rounded-xl flex flex-col animate-scaleIn glass-panel"
```

改为：

```tsx
className="modal-content w-[500px] max-h-[80vh] rounded-xl flex flex-col animate-scaleIn"
style={{ backgroundColor: surface.panelBg, boxShadow: 'var(--shadow-xl)' }}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/WorkspacePicker.tsx
git commit -m "feat(ui): change WorkspacePicker to solid background"
```

---

### Task 11: TrashBinPanel 改为实色背景

**Files:**
- Modify: `src/components/ui/TrashBinPanel.tsx`

- [ ] **Step 1: 移除 `glass-panel` 类，添加实色背景**

找到使用 `glass-panel` 的位置（约第 55 行），将：

```tsx
className="modal-content w-[600px] max-h-[80vh] rounded-xl flex flex-col animate-scaleIn glass-panel"
```

改为：

```tsx
className="modal-content w-[600px] max-h-[80vh] rounded-xl flex flex-col animate-scaleIn"
style={{ backgroundColor: surface.panelBg, boxShadow: 'var(--shadow-xl)' }}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/TrashBinPanel.tsx
git commit -m "feat(ui): change TrashBinPanel to solid background"
```

---

### Task 12: CardEditDialog 改为实色背景

**Files:**
- Modify: `src/components/ui/CardEditDialog.tsx`

- [ ] **Step 1: 移除 `glass-panel` 类，添加实色背景**

找到使用 `glass-panel` 的位置（约第 106 行），将：

```tsx
className="fixed z-[60] overflow-hidden glass-panel flex flex-col"
```

改为：

```tsx
className="fixed z-[60] overflow-hidden flex flex-col"
style={{ backgroundColor: surface.panelBg }}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/CardEditDialog.tsx
git commit -m "feat(ui): change CardEditDialog to solid background"
```

---

### Task 13: 验证与测试

- [ ] **Step 1: 启动开发服务器**

```bash
pnpm dev
```

- [ ] **Step 2: 视觉验证 checklist**

| 检查项 | 期望结果 |
|--------|---------|
| LeftPanel | 背景有模糊效果，透出画布内容 |
| RightPanel | 背景有模糊效果，透出画布内容 |
| Toolbar | 实色背景，无模糊 |
| TitleBar | 实色背景，无模糊 |
| LeftPanelCollapsed | 实色背景，无模糊 |
| RightPanelCollapsed | 实色背景，无模糊 |
| ContextMenu | 实色背景，无模糊 |
| WorkspacePicker | 实色背景，无模糊 |
| TrashBinPanel | 实色背景，无模糊 |
| CardEditDialog | 实色背景，无模糊 |

- [ ] **Step 3: 性能验证**

打开 Chrome DevTools → Performance 面板，录制 5 秒：
1. 在画布上缩放/平移
2. 在 LeftPanel / RightPanel 内滚动
3. 检查 FPS 是否稳定在 55+

- [ ] **Step 4: 提交最终验证结果**

```bash
git log --oneline -15
```

确认所有 12 个 commit 都已提交。

---

## Self-Review Checklist

- [ ] **Spec coverage**: 所有设计文档中的要求都有对应的 Task
- [ ] **Placeholder scan**: 无 TBD、TODO、"implement later"
- [ ] **Type consistency**: CSS 类名 `.glass-panel-large` 在所有文件中一致使用
- [ ] **文件路径正确**: 所有路径基于 `src/` 目录，符合项目结构
