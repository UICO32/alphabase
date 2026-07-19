# 当前画布卡片状态与居中编辑形变修复设计

日期：2026-07-19

## 背景

右侧卡片库目前不知道当前画布完整的卡片节点集合。已经置入画布、但位于可视区域外的卡片仍可再次拖拽，导致 drop 行为表现为无响应。与此同时，卡片点击后的居中编辑弹窗会与 BlockNote 编辑器同步挂载；编辑器初始化占用主线程，使 500ms 的卡片到弹窗形变在首帧绘制前已经消耗，用户看到的是卡顿后直接出现终态。

## 目标

1. 右侧卡片库实时标识当前画布中已存在的卡片，不受视口裁剪影响。
2. 已置入卡片继续显示，但置灰且不能重复拖拽。
3. 点击已置入卡片时，自动定位当前画布中的对应节点；节点在视口外时也有效。
4. 点击未置入卡片时，先流畅完成卡片到居中弹窗的形变，再挂载重型编辑器。
5. 保留现有搜索、标签、排序、编辑、Esc 关闭、焦点恢复和减少动态效果行为。

## 非目标

- 不过滤其他画布中使用过的卡片；状态只针对当前活动画布。
- 不改变一张卡片可被放入多个不同画布的能力。
- 不重构 React Flow 节点所有权，也不把节点状态提升到 `App`。
- 不修改共享 `DialogContent` 基础组件，避免影响设置、工作区选择、冲突和回收站弹窗。

## 方案选择

### 采用：实时画布存在状态 + 分阶段弹窗挂载

新增一个轻量运行时 store，保存 `{ boardId, cardIds }`。`ReactFlowCanvas` 使用完整 `nodes` 集合发布当前画布卡片 ID；`CardLibraryView` 订阅并决定卡片的置灰、拖拽和点击行为。弹窗先渲染轻量预览壳，形变结束后再挂载 `CardEditorEntry`。

选择理由：状态更新即时，不受 `boardStore` 600ms 持久化节流影响；同时不会让右侧面板订阅整个 React Flow 节点对象。

### 未采用：直接读取 `boardStore.boardData`

改动较少，但拖入或移除后最多会有 600ms 的状态滞后，无法满足即时反馈。

### 未采用：把 React Flow 节点提升到 `App`

数据来源直接，但扩大画布交互热路径的重渲染范围，风险和改动面都不必要。

## 数据流与组件设计

### 1. 当前画布卡片存在状态

新增 `canvasPresenceStore`：

- `boardId: string | null`
- `cardIds: ReadonlySet<string>`，每次成员变化时创建新 Set
- `setCanvasPresence(boardId, cardIds)`
- `clearCanvasPresence()`

`ReactFlowCanvas` 从完整 `nodes` 中筛选 `node.type === 'card'`，读取 `node.data.cardId` 并发布。这里使用 React Flow 的全部节点，而不是 `onlyRenderVisibleElements` 生成的 DOM，因此屏外节点也会进入集合。

画布切换时先清空旧 presence，再发布新画布节点，避免旧画布卡片在新画布中短暂置灰。组件卸载时清空运行时状态。

### 2. 右侧卡片库状态

`CardLibraryView` 将 presence 与当前 `activeBoardId` 对齐，仅当两者 board ID 相同时使用 `cardIds`。

`CardItem` 新增 `isOnCanvas`：

- `draggable={!isOnCanvas}`。
- 已置入状态使用降低透明度、轻度灰度和默认光标，保留可读性。
- 添加 `aria-disabled`、状态说明和稳定的 `data-on-canvas` 测试标记。
- 已置入状态不设置 drag payload，也不展示拖拽中的浮动样式。

点击行为：

- `isOnCanvas === true`：发送现有 `focus-card` 事件。`ReactFlowCanvas` 使用完整 `nodesRef` 找到节点并执行 `fitView`，因此屏外节点也能被定位。
- `isOnCanvas === false`：保留当前 `CardEditDialog` 打开流程与来源矩形。

从当前画布移除节点后，presence 在下一次 React 提交中更新，卡片立即恢复正常样式和拖拽能力。

### 3. 居中弹窗首帧与编辑器挂载

`CardEditDialog` 增加内部阶段：`morphing -> editing`。

`morphing` 阶段只渲染：

- 标题、颜色栏和弹窗外壳。
- 使用 `buildCardPreviewSemantics` 处理已缓存 `previewHTML` 的轻量静态预览。
- 现有 CSS 变量驱动的来源位移、非等比缩放、圆角和遮罩渐入。

进入 `editing` 的条件：

- 收到 `card-edit-dialog-source-morph` 的 `animationend`；或
- 550ms 安全兜底计时器触发，防止浏览器未派发事件；或
- 系统启用 `prefers-reduced-motion: reduce`，此时直接进入编辑阶段。

只有进入 `editing` 后才挂载 `CardEditorEntry`。静态预览保持到 `CardEditorEntry` 自身进入 interactive 阶段，继续复用现有的预览保留与原子揭示机制。

关闭弹窗时清理计时器，不在卸载后更新阶段。Esc、遮罩关闭、内容快照与焦点恢复逻辑不变。

## 性能与错误处理

- presence 只传递卡片 ID，不把节点位置、尺寸或选中状态传播到右侧面板。
- 发布前比较 board ID 与 ID 集合，节点仅移动但成员不变时不触发卡片库重渲染。
- 无活动画布或 presence 尚未就绪时，卡片库按未置入状态显示，避免错误置灰。
- malformed 节点数据或缺少 `cardId` 的非卡片节点被忽略。
- 弹窗没有 `previewHTML` 时使用安全的纯文本/空状态预览，不阻塞形变。

## 验收标准

1. 当前画布中任意位置的卡片在右侧库中均为置灰、不可拖拽状态。
2. 将节点移动到视口外不会改变其置灰状态。
3. 点击置灰卡片会平滑定位对应画布节点，不打开编辑弹窗。
4. 从当前画布移除节点后，卡片立即恢复可拖拽状态。
5. 切换画布后只依据新活动画布置灰；其他画布中的同一卡片不受影响。
6. 点击未置入卡片后，浏览器至少绘制一帧来源卡片形态，再完成 500ms 居中形变。
7. 形变期间 BlockNote 编辑器未挂载；形变结束或兜底触发后才进入编辑阶段。
8. 减少动态效果模式下不执行空间形变，并直接进入可编辑状态。
9. 现有窄屏抽屉拖拽、Esc 关闭、焦点恢复、搜索/标签/排序全部保持通过。

## 测试策略

- Store 单测：同成员集合不重复更新、切换画布清空旧状态、忽略非法节点 ID。
- Card library 单测：已置入卡片的样式、ARIA、`draggable=false` 和点击分流。
- Dialog 单测：阶段切换、动画结束、550ms 兜底、卸载清理和减少动态效果。
- E2E：
  - 创建卡片、移动至视口外、打开右侧库并验证置灰与不可拖拽。
  - 点击置灰卡片后验证 React Flow viewport 定位变化且没有编辑弹窗。
  - 从画布移除后验证卡片恢复可拖拽。
  - 点击未置入卡片，验证 morph 阶段只有静态预览，动画结束后编辑器出现。
  - 复跑响应式抽屉拖拽和统一浮层测试。

## 影响范围

预计新增一个小型运行时 store，并修改 `ReactFlowCanvas`、`CardLibraryView`、`CardEditDialog`、对应样式与测试。实现前必须分别对这些符号运行 GitNexus upstream impact；共享 `DialogContent` 不在改动范围内。
