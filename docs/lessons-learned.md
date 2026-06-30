# 踩坑总结 / Lessons Learned

## 划词工具栏点击后光标乱跳 + 工具栏消失 (2025-06-30)

### 现象
编辑态下划词选择文字 → 点击加粗/斜体等格式按钮 → 工具栏消失、光标插入到鼠标点击按钮位置（按钮下方的文字处）。

### 调试过程
1. ❌ 尝试 focus/refocus 补救（`editor.focus()`、`prosemirrorView.focus()`）—— 光标仍跳
2. ❌ 尝试 hook `prosemirrorView.focus` 拦截期间恢复 selection —— 复杂且不可靠
3. ✅ 找到真正根因

### 根因
不在编辑器内部，而在画布层 `CardNode.tsx` 的 `handleCardClick`。

编辑态下，卡片内所有非 `[contenteditable="true"]` 的点击都会触发 `editorRef.current?.focusAtCoords({ x: e.clientX, y: e.clientY })`。划词工具栏按钮不属于 contenteditable，所以每次点击按钮时：

1. click 事件冒泡到 `handleCardClick`
2. `handleCardClick` 调用 `focusAtCoords` 把 ProseMirror 选区移到按钮下方的文字坐标
3. 选区被破坏 → toolbar 隐藏（BlockNote 的 blurHandler 触发）
4. 同时光标插到了错误位置 → 格式按钮的选中态不匹配

**文件**：`src/components/canvas/CardNode.tsx:202-206`

### 修复
在 `handleCardClick` 中加入编辑器浮层类名过滤：

```ts
if (target.closest('.bn-formatting-toolbar, .bn-link-toolbar, .bn-suggestion-menu, .bn-ui-container, .image-toolbar')) return
```

点击工具栏/建议菜单/图片工具栏等浮层元素时，跳过 `focusAtCoords`。

### 教训
- 看似编辑器内部的问题，根因可能在画布/卡片层（边缘视角）
- 修复编辑器焦点问题先检查上层组件的事件冒泡
- 不要急于 hook ProseMirror 内部 API，先看 React 组件的事件流
- 点击 — blur — selection 破坏 — toolbar 隐藏，这四者是连锁的，阻断第一环（selection 破坏）即可

## FocusAtCoords 在卡片编辑态的行为 (2025-06-30)

`CardNode.handleCardClick` 在编辑态下对非 contenteditable 点击调用 `focusAtCoords`，这个设计意图是让用户点击卡片某处时光标跟随。但它不区分普通卡片内容和编辑器浮层（工具栏/菜单），导致划词工具栏点击时光标被移到按钮位置。

修复时需同步更新的文件：
- `src/components/canvas/CardNode.tsx` — handleCardClick 的 `.closest` 过滤
