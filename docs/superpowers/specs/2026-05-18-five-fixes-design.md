# 五项修复设计规格

日期：2026-05-18

## 问题1：数据冲突 — 剪藏后切换工作区卡片消失

### 根因
`subscribeCardStore` 写入卡片文件但不更新 `_metadata.json`，`saveMetadata` 仅在 `loadWorkspaceData` 末尾调用一次。剪藏卡片后磁盘文件数与元数据 `cardCount` 不一致，切回工作区时 `validateConsistency()` 误报冲突。

### 修复
1. `syncEngine` 添加 `scheduleWriteMetadata(metadata)` 方法，debounce 300ms
2. `subscribeCardStore` 在检测到卡片增删时，计算当前 `cardCount` 并调用 `scheduleWriteMetadata`
3. 改进 `WorkspaceConflictDialog`：显示具体差异（"磁盘有 7 张卡片，元数据记录 5 张"），选项改为"保留磁盘数据"和"取消加载"
4. 切换工作区时 `flushAll()` 后确保元数据写入完成

### 涉及文件
- `src/utils/workspace/syncEngine.ts` — 添加 `scheduleWriteMetadata`
- `src/utils/subscribeStores.ts` — 卡片增删时调度元数据写入
- `src/components/ui/WorkspaceConflictDialog.tsx` — 改进冲突信息展示
- `src/hooks/useWorkspaceDataLoader.ts` — flush 后等待元数据写入

---

## 问题2：画布性能优化（50张卡片）

### 瓶颈
- `connectionMediator` 广播：每次鼠标移动触发所有 CardNode 重渲染
- 无视口裁剪：所有卡片都在 DOM 中
- `onMouseMove` 无节流
- `CardContent`、`CardActionBar` 未用 `memo`

### 优化
1. **视口裁剪**：`ReactFlowCanvas` 中根据 viewport + 缓冲区过滤节点，只渲染可见卡片
2. **connectionMediator 精准通知**：`setNearbyTarget` 只通知目标卡片和前一个目标卡片
3. **onMouseMove 节流**：`requestAnimationFrame` 包裹
4. **memo 包裹**：`CardContent` 和 `CardActionBar` 用 `memo` 包裹

### 涉及文件
- `src/components/canvas/ReactFlowCanvas.tsx` — 视口裁剪、onMouseMove 节流
- `src/utils/connectionMediator.ts` — 精准通知
- `src/components/canvas/card/CardContent.tsx` — memo 包裹
- `src/components/canvas/card/CardActionBar.tsx` — memo 包裹

---

## 问题3：卡片四角抓手被裁切

### 根因
选中态时卡片仍为 `overflow-hidden` + `contain: paint`，NodeResizer 角部抓手被裁切。overflow 仅在 `isEditing` 时切换。

### 修复
选中态时卡片外层切换为 `overflow-visible` + `contain: none`。内层 `overflow-y: auto` 保证文本不溢出。

### 涉及文件
- `src/components/canvas/CardNode.tsx` — overflow 条件加入 `selected`
- `src/index.css` — CSS contain 规则匹配 `overflow-visible`

---

## 问题4：更多操作面板被裁切

### 根因
`MoreActionsMenu` 使用绝对定位（`left: 100%`），被卡片 `overflow-hidden` + `contain: paint` 裁切。

### 修复
`MoreActionsMenu` 和 `BoardSubmenu` 改用 `createPortal` 渲染到 `document.body`，用 fixed 定位基于触发按钮 `getBoundingClientRect()` 计算坐标。

### 涉及文件
- `src/components/canvas/card/MoreActionsMenu.tsx` — Portal + fixed 定位
- `src/components/canvas/card/BoardSubmenu.tsx` — Portal + fixed 定位
- `src/components/canvas/card/CardActionBar.tsx` — 传递按钮 ref 用于定位
