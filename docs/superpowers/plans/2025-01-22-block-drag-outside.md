# BlockNote 编辑器拖拽修复与拖出创建新卡片

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 BlockNote 编辑器拖拽时预览线卡死问题，并支持将内容块拖出卡片边界创建新卡片

**Architecture:** 在 BlockNoteEditor 中监听全局 dragend 事件，检测拖拽终点是否在卡片容器外部。如果是，触发回调让 CardNode 创建新卡片并从原编辑器移除被拖拽的块。

**Tech Stack:** React, BlockNote, Zustand, React Flow

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `src/components/editor/BlockNoteEditor.tsx` | 编辑器主组件，增加拖出检测逻辑 |
| `src/components/canvas/card/CardContent.tsx` | 传递拖出回调给编辑器 |
| `src/components/canvas/CardNode.tsx` | 处理拖出回调，创建新卡片并添加到画布 |

---

## Task 1: 修复预览线卡死（Bug 修复）

**文件:**
- Modify: `src/components/editor/BlockNoteEditor.tsx:267-275`

**背景:** BlockNote 使用 ProseMirror 的 dropCursor 插件显示蓝色插入线。当拖拽到编辑器外部时，dropCursor 没有收到隐藏信号，导致蓝色线残留。

- [ ] **Step 1: 在 useEffect 中增加全局 dragend 监听**

在现有的 `useEffect` 中（约第267行，handleDrop 监听器旁边），增加全局 dragend 监听：

```typescript
// 在 useEffect 内部，handleDrop 定义之后
const handleGlobalDragEnd = () => {
  // 清除残留选区
  setTimeout(() => {
    const selection = window.getSelection()
    if (selection && selection.type === 'Range') {
      selection.removeAllRanges()
    }
  }, 0)
}

// 注册到 window（不是 el）
window.addEventListener('dragend', handleGlobalDragEnd)
```

- [ ] **Step 2: 在 cleanup 中移除监听**

在 return 的 cleanup 函数中：

```typescript
return () => {
  el.removeEventListener('focusin', handleFocusIn)
  el.removeEventListener('focusout', handleFocusOut)
  el.removeEventListener('keydown', handleKeyDown)
  el.removeEventListener('drop', handleDrop)
  window.removeEventListener('dragend', handleGlobalDragEnd)  // 新增
}
```

- [ ] **Step 3: 验证修复**

1. 启动开发服务器
2. 打开一张卡片进入编辑模式
3. 拖拽任意内容块到编辑器外部
4. 确认蓝色预览线消失，没有残留

---

## Task 2: 新增拖出创建新卡片功能

### Task 2.1: 新增 BlockNoteEditorProps 属性

**文件:**
- Modify: `src/components/editor/BlockNoteEditor.tsx:30-39`

- [ ] **Step 1: 在 BlockNoteEditorProps 中增加 onDragBlocksOutside 回调**

```typescript
export interface BlockNoteEditorProps {
  content: string
  onChange: (content: string) => void
  onFocus?: () => void
  onBlur?: () => void
  theme?: 'light' | 'dark'
  editable?: boolean
  showSideMenu?: boolean
  enforceInitialHeading?: boolean
  onDragBlocksOutside?: (blocks: unknown[]) => void  // 新增
}
```

### Task 2.2: 实现拖出检测逻辑

**文件:**
- Modify: `src/components/editor/BlockNoteEditor.tsx:40-50`（组件参数解构）
- Modify: `src/components/editor/BlockNoteEditor.tsx:267-290`（useEffect 拖拽处理）

- [ ] **Step 2: 在组件参数中解构 onDragBlocksOutside**

```typescript
const CardBlockNoteEditorInner = (
  { content, onChange, onFocus, onBlur, theme = 'light', editable = true, showSideMenu = false, enforceInitialHeading = false, onDragBlocksOutside }: BlockNoteEditorProps,
  ref: ForwardedRef<BlockNoteEditorHandle>
) => {
```

- [ ] **Step 3: 在 useEffect 中增加拖出检测逻辑**

在现有的 `handleGlobalDragEnd` 中（Task 1 添加的），增加拖出检测：

```typescript
const handleGlobalDragEnd = (e: DragEvent) => {
  // 清除残留选区
  setTimeout(() => {
    const selection = window.getSelection()
    if (selection && selection.type === 'Range') {
      selection.removeAllRanges()
    }
  }, 0)

  // 拖出检测：检查拖拽终点是否在容器外部
  if (!containerRef.current || !onDragBlocksOutside) return
  
  const containerRect = containerRef.current.getBoundingClientRect()
  const isOutside = !(
    e.clientX >= containerRect.left &&
    e.clientX <= containerRect.right &&
    e.clientY >= containerRect.top &&
    e.clientY <= containerRect.bottom
  )
  
  if (isOutside) {
    // 获取所有被拖拽的块
    const draggingEls = containerRef.current.querySelectorAll('.bn-block-outer[data-is-dragging="true"]')
    const draggedBlocks: unknown[] = []
    
    draggingEls.forEach((el) => {
      const blockId = findBlockIdFromDom(el as HTMLElement)
      if (blockId) {
        const block = editor.getBlock(blockId)
        if (block) {
          draggedBlocks.push(block)
        }
      }
    })
    
    if (draggedBlocks.length > 0) {
      // 触发回调，让父组件创建新卡片
      onDragBlocksOutside(draggedBlocks)
      // 从当前编辑器移除这些块
      editor.removeBlocks(draggedBlocks)
    }
  }
}
```

- [ ] **Step 4: 将 findBlockIdFromDom 函数提取到 BlockNoteEditor.tsx**

在文件顶部（import 之后）添加辅助函数：

```typescript
function findBlockIdFromDom(el: HTMLElement | null): string | null {
  while (el) {
    const id = el.getAttribute?.('data-id')
    if (id) return id
    el = el.parentElement
  }
  return null
}
```

### Task 2.3: CardContent 传递回调

**文件:**
- Modify: `src/components/canvas/card/CardContent.tsx:1-80`

- [ ] **Step 5: 在 CardContentProps 中增加 onDragBlocksOutside**

```typescript
interface CardContentProps {
  isEditing: boolean
  isSelected: boolean
  content: string
  previewHTML?: string
  enforceInitialHeading?: boolean
  onChange: (content: string) => void
  onBlur: () => void
  editorRef: React.Ref<BlockNoteEditorHandle>
  textColor: string
  onDragBlocksOutside?: (blocks: unknown[]) => void  // 新增
}
```

- [ ] **Step 6: 解构并传递给 LazyCardBlockNoteEditor**

```typescript
export const CardContent = memo(function CardContent({
  isEditing,
  isSelected,
  content,
  previewHTML,
  enforceInitialHeading,
  onChange,
  onBlur,
  editorRef,
  textColor,
  onDragBlocksOutside,  // 新增
}: CardContentProps) {
```

在 LazyCardBlockNoteEditor 组件上增加 prop：

```tsx
<LazyCardBlockNoteEditor
  ref={editorRef}
  content={content}
  onChange={onChange}
  onBlur={onBlur}
  theme="light"
  editable={true}
  showSideMenu={false}
  enforceInitialHeading={enforceInitialHeading}
  onDragBlocksOutside={onDragBlocksOutside}  // 新增
/>
```

### Task 2.4: CardNode 处理拖出回调

**文件:**
- Modify: `src/components/canvas/CardNode.tsx:1-50`（import 和组件逻辑）

- [ ] **Step 7: 在 CardNode 中实现 handleDragBlocksOutside**

在 CardNode 组件内部（约第100行，handleEditorBlur 之后）添加：

```typescript
const handleDragBlocksOutside = useCallback((blocks: unknown[]) => {
  if (!card) return
  
  // 获取当前卡片在画布上的位置
  const currentNode = getNode(data.cardId)
  if (!currentNode) return
  
  // 生成新卡片 ID
  const newCardId = crypto.randomUUID()
  
  // 将 blocks 转换为卡片内容格式
  const newContent = JSON.stringify(blocks)
  
  // 创建新卡片
  useCardStore.getState().addCard({
    id: newCardId,
    content: newContent,
    color: card.color,
    createdAt: Date.now(),
  })
  
  // 在画布上创建新节点（放在当前卡片右侧偏移位置）
  const offsetX = 320  // 当前卡片宽度 + 间距
  const offsetY = 0
  setNodes((nds) => [
    ...nds,
    {
      id: newCardId,
      type: 'card',
      position: {
        x: currentNode.position.x + offsetX,
        y: currentNode.position.y + offsetY,
      },
      data: { 
        cardId: newCardId, 
        color: card.color, 
        width: data.width ?? 280, 
        height: data.height ?? 200 
      },
    },
  ])
}, [data.cardId, card, data.width, data.height, getNode, setNodes])
```

- [ ] **Step 8: 将 handleDragBlocksOutside 传递给 CardContent**

在 CardContent 组件调用处（约第320行）：

```tsx
<CardContent
  isEditing={isEditing}
  isSelected={!!selected}
  content={card.content}
  previewHTML={card.previewHTML}
  enforceInitialHeading={card.enforceInitialHeading}
  onChange={handleContentChange}
  onBlur={handleEditorBlur}
  editorRef={editorRef}
  textColor={textColor}
  onDragBlocksOutside={handleDragBlocksOutside}  // 新增
/>
```

---

## Task 3: 验证完整功能

- [ ] **Step 9: 验证拖出创建新卡片**

1. 启动开发服务器
2. 打开一张卡片进入编辑模式
3. 拖拽任意内容块到卡片边界外部
4. 确认：
   - 原卡片中该块被移除
   - 画布上在当前卡片右侧出现新卡片
   - 新卡片内容 = 被拖出的块

- [ ] **Step 10: 验证预览线不卡死**

1. 拖拽内容块到编辑器外部
2. 确认蓝色预览线消失

---

## 边界情况处理

1. **拖拽多个块：** 代码使用 `querySelectorAll` 遍历所有 `data-is-dragging="true"` 的元素，支持多块同时拖拽
2. **新卡片位置：** 放在当前卡片右侧 320px 处，避免重叠
3. **撤销/重做：** 新卡片创建是独立操作，不纳入编辑器 undo 栈

---

## 提交

- [ ] **Step 11: 提交代码**

```bash
git add src/components/editor/BlockNoteEditor.tsx
git add src/components/canvas/card/CardContent.tsx
git add src/components/canvas/CardNode.tsx
git commit -m "feat(editor): 支持拖拽内容块到卡片外部创建新卡片，修复预览线卡死"
```
