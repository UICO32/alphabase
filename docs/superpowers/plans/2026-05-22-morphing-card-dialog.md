# Morphing Card Dialog 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 卡片库中点击卡片项后，卡片从原位变形展开为居中编辑器对话框，关闭时缩回原位。

**Architecture:** 手动坐标计算方案。用 `getBoundingClientRect` 获取点击卡片的视口位置，用 framer-motion `motion.div` 的 `initial`/`animate`/`exit` 做变形动画。不依赖 `layoutId`，避免与 React Flow 的 transform 冲突。

**Tech Stack:** framer-motion (已安装), React 18, TypeScript, BlockNoteEditor, usePanelSurface

**Scope:** 仅左侧面板卡片库 + 右侧面板卡片库中的卡片。右侧面板的 CardEditorView 保持不变。

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/components/ui/CardEditDialog.tsx` | 重写 | morphing 版本，接收 sourceRect，用 motion.div 做变形动画 |
| `src/components/ui/CardLibraryView.tsx` | 修改 | 捕获点击卡片的 DOM rect，传给 CardEditDialog |
| `src/theme/animations.css` | 不改 | 已有 animate-fadeIn/scaleIn，morphing 用 framer-motion inline 控制 |

---

## Task 1: 改造 CardEditDialog 为 morphing 版本

**Files:**
- Modify: `src/components/ui/CardEditDialog.tsx`

**设计要点：**
- Props 新增 `sourceRect: DOMRect | null`，表示点击卡片在视口中的位置
- 用 `AnimatePresence` + `motion.div` 做整体动画
- 遮罩层用 `motion.div` 做淡入淡出
- 编辑器容器用 `motion.div`，`initial` 从 sourceRect 的位置/大小开始，`animate` 到居中 700×600，`exit` 缩回 sourceRect
- 动画曲线: `cubic-bezier(0.2, 0.8, 0.2, 1)` (与现有 morphing-comparison.html 一致)
- 关闭方式：点遮罩、点 X、按 Esc
- 保留所有编辑功能：标题栏、颜色选择器、BlockNoteEditor、删除按钮
- BlockNoteEditor 改为 lazy 加载（与 RightPanel 一致，避免首屏加载开销）

- [ ] **Step 1: 重写 CardEditDialog.tsx**

将现有 CardEditDialog 替换为 morphing 版本：

```tsx
import { useCallback, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useIsDarkMode } from '../../hooks/useIsDarkMode'
import { useCardStore } from '../../stores/cardStore'
import { useTrashStore } from '../../stores/trashStore'
import { usePanelSurface } from '../../hooks/usePanelSurface'
import { X, Trash2 } from 'lucide-react'
import { CARD_COLORS, type CardColor } from '../../types/card'

const LazyCardBlockNoteEditor = lazy(() =>
  import('../editor/BlockNoteEditor').then(m => ({ default: m.CardBlockNoteEditor }))
)

const DIALOG_WIDTH = 700
const DIALOG_HEIGHT = 600
const MORPH_TRANSITION = {
  duration: 0.5,
  ease: [0.2, 0.8, 0.2, 1] as [number, number, number, number],
}
const FADE_TRANSITION = { duration: 0.25 }

interface CardEditDialogProps {
  cardId: string
  sourceRect: DOMRect | null
  onClose: () => void
}

export function CardEditDialog({ cardId, sourceRect, onClose }: CardEditDialogProps) {
  const isDarkMode = useIsDarkMode()
  const surface = usePanelSurface()
  const card = useCardStore(s => s.cards[cardId])
  const updateCard = useCardStore(s => s.updateCard)
  const softDeleteCard = useCardStore(s => s.softDeleteCard)
  const addItem = useTrashStore(s => s.addItem)

  const handleChange = useCallback((content: string) => {
    updateCard(cardId, { content })
  }, [cardId, updateCard])

  const handleColorChange = useCallback((color: CardColor) => {
    updateCard(cardId, { color })
  }, [cardId, updateCard])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  if (!card) return null

  // 计算居中位置
  const centerX = (window.innerWidth - DIALOG_WIDTH) / 2
  const centerY = (window.innerHeight - DIALOG_HEIGHT) / 2

  // initial 状态：从卡片原位开始
  const initialStyle = sourceRect
    ? {
        top: sourceRect.top,
        left: sourceRect.left,
        width: sourceRect.width,
        height: sourceRect.height,
        borderRadius: 10,
      }
    : {
        top: centerY,
        left: centerX,
        width: DIALOG_WIDTH,
        height: DIALOG_HEIGHT,
        borderRadius: 16,
      }

  // animate 状态：展开到居中
  const animateStyle = {
    top: centerY,
    left: centerX,
    width: DIALOG_WIDTH,
    height: DIALOG_HEIGHT,
    borderRadius: 16,
  }

  // exit 状态：缩回原位
  const exitStyle = sourceRect
    ? {
        top: sourceRect.top,
        left: sourceRect.left,
        width: sourceRect.width,
        height: sourceRect.height,
        borderRadius: 10,
        opacity: 0,
      }
    : {
        opacity: 0,
      }

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50"
        onKeyDown={handleKeyDown}
      >
        {/* 遮罩层 */}
        <motion.div
          className="fixed inset-0"
          style={{ backgroundColor: 'var(--surface-overlay)', backdropFilter: 'blur(4px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={FADE_TRANSITION}
          onClick={onClose}
        />

        {/* 变形编辑器 */}
        <motion.div
          className="fixed z-[60] overflow-hidden glass-panel flex flex-col"
          initial={initialStyle}
          animate={animateStyle}
          exit={exitStyle}
          transition={MORPH_TRANSITION}
          style={{ boxShadow: 'var(--shadow-xl)' }}
        >
          {/* 标题栏 */}
          <div
            className="flex items-center justify-between px-5 py-3 border-b shrink-0"
            style={{ borderColor: surface.divider }}
          >
            <span className="text-sm font-medium truncate" style={{ color: surface.text }}>
              {card.title || '无标题'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (window.confirm(`确定删除卡片「${card.title || '无标题'}」？`)) {
                    softDeleteCard(cardId)
                    addItem({
                      id: `trash-${cardId}`,
                      cardId,
                      title: card.title || '无标题',
                      content: card.content,
                      color: card.color,
                      createdAt: card.createdAt,
                      enforceInitialHeading: card.enforceInitialHeading,
                      fixedHeight: card.fixedHeight,
                      collapsed: card.collapsed,
                    })
                    onClose()
                  }
                }}
                className="btn-base btn-danger flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
              >
                <Trash2 size={14} />
                删除
              </button>
              <button
                onClick={onClose}
                className="btn-base p-2 rounded-lg"
                style={{ color: surface.muted }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* 颜色选择器 */}
          <div className="flex items-center gap-1.5 px-5 py-2 border-b" style={{ borderColor: surface.divider }}>
            {(Object.keys(CARD_COLORS) as CardColor[]).map((color) => (
              <button
                key={color}
                onClick={() => handleColorChange(color)}
                className="w-6 h-6 rounded-full border-2 transition-all cursor-pointer"
                style={{
                  backgroundColor: isDarkMode ? CARD_COLORS[color].fillDark : CARD_COLORS[color].fillLight,
                  borderColor: card.color === color ? CARD_COLORS[color].stroke : 'transparent',
                  boxShadow: card.color === color ? `0 0 0 2px ${CARD_COLORS[color].stroke}` : 'none',
                }}
              />
            ))}
          </div>

          {/* 编辑器 */}
          <div className="flex-1 overflow-auto p-4">
            <Suspense fallback={null}>
              <LazyCardBlockNoteEditor
                content={card.content}
                onChange={handleChange}
                editable={true}
                theme={isDarkMode ? 'dark' : 'light'}
              />
            </Suspense>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd d:/USE/save/code/abase && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: 无类型错误（或仅与本次改动无关的已有错误）

---

## Task 2: 修改 CardLibraryView 传递 sourceRect

**Files:**
- Modify: `src/components/ui/CardLibraryView.tsx`

**设计要点：**
- 新增 `sourceRect` state，类型 `DOMRect | null`
- 点击卡片时，用 `e.currentTarget.getBoundingClientRect()` 获取视口位置
- 将 `sourceRect` 传给 `CardEditDialog`
- 关闭时清空 `sourceRect`

- [ ] **Step 1: 修改 CardLibraryView.tsx**

改动点：

1. 新增 state:
```tsx
const [sourceRect, setSourceRect] = useState<DOMRect | null>(null)
```

2. 修改卡片点击 handler:
```tsx
onClick={(e) => {
  setSourceRect(e.currentTarget.getBoundingClientRect())
  setEditingCardId(card.id)
}}
```

3. 修改 CardEditDialog 调用:
```tsx
{editingCardId && (
  <CardEditDialog
    cardId={editingCardId}
    sourceRect={sourceRect}
    onClose={() => {
      setEditingCardId(null)
      setSourceRect(null)
    }}
  />
)}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd d:/USE/save/code/abase && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: 无类型错误

---

## Task 3: 验证动画效果

- [ ] **Step 1: 启动开发服务器**

Run: `cd d:/USE/save/code/abase && pnpm dev`

- [ ] **Step 2: 在浏览器中验证**

验证点：
1. 点击左侧面板卡片库中的卡片 → 卡片从原位变形展开为居中编辑器
2. 背景出现半透明遮罩 + 模糊
3. 编辑器内标题、颜色选择器、BlockNoteEditor 正常工作
4. 点遮罩/点X/按Esc → 编辑器缩回原卡片位置
5. 右侧面板卡片库中的卡片同样有变形效果
6. 右侧面板的 CardEditorView（卡片编辑器 tab）不受影响
7. 暗色模式下颜色正确

---

## 不变项

- 右侧面板的 CardEditorView（卡片编辑器 tab）— 保持侧边编辑
- 画布上的 CardNode 内联编辑 — 不受影响
- 所有 store 逻辑 — 不受影响
- animations.css — 不需要修改，morphing 动画由 framer-motion inline 控制
