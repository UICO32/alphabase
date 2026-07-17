# 编辑器进入体验优化设计

**日期：** 2026-07-17

**状态：** 已确认方案，待实施

**范围：** 画布卡片内联编辑、右侧编辑面板、卡片编辑弹窗

## 背景与问题

三个编辑入口都会在用户触发编辑后创建新的 BlockNote/ProseMirror 实例。编辑器模块虽然会在工作区数据加载后预取，但模块预取不能消除实例创建、内容解析、DOM 布局和首次聚焦的成本。

当前入口还存在以下可见断点：

- 画布卡片从预览分支直接切换到编辑器分支，`Suspense` 使用空 fallback；预览先消失，编辑器稍后出现。
- 画布通过逐帧等待 ref 后执行坐标聚焦，用户会看到内容出现和光标落点分成两个阶段。
- 右侧面板使用卡片 ID 作为 key，切换卡片会销毁并重建编辑器；重建期间没有内容连续性。
- 编辑弹窗的 0.5 秒形变动画与编辑器挂载同时发生，编辑器可能在容器运动、缩放或重排过程中突然出现。
- 三处各自声明或使用 lazy editor，没有统一的“编辑器已完成首次布局并可交互”语义。

## 目标

- 首次进入任一编辑入口时不出现空白帧或明显内容闪烁。
- 画布首次点击进入编辑时，内容、布局和光标在一次视觉切换中稳定呈现。
- 右侧面板连续切换卡片时保留明确、稳定的内容反馈，不让旧编辑器写入新卡片。
- 编辑弹窗在形变动画期间保持内容连续，编辑器准备好后再进入可交互状态。
- 不以常驻所有卡片编辑器为代价，不降低大画布的内存和帧率表现。
- 保留现有保存、历史快照、图片、卡片引用、标签、快捷键和选区行为。

## 非目标

- 不更换 BlockNote、ProseMirror 或现有卡片内容格式。
- 不重构整个卡片状态管理或编辑历史系统。
- 不提前为画布上的每张卡片创建编辑器实例。
- 不用模糊骨架屏掩盖真实内容；进入过程中优先维持当前卡片内容的视觉连续性。
- 不在本次工作中调整编辑器排版、工具栏功能或卡片尺寸规则。

## 方案比较

### 方案 A：分阶段显现（采用）

保留现有预览或等尺寸内容层，在其上挂载暂时不可见的编辑器。编辑器完成首次 DOM 布局、内容同步和必要聚焦后，在下一绘制帧切换为可见、可交互状态。

优点是直接消除空白帧和中途跳变，且只为正在进入编辑的入口创建实例。代价是需要一套明确的 readiness 协议和少量过渡状态。

### 方案 B：编辑器常驻

每张卡片同时保留预览和编辑器，只切换可见性。点击响应最快，但大画布会创建大量 ProseMirror 实例，显著增加启动成本、内存占用和后台订阅，因此不采用。

### 方案 C：仅增加 fallback 和淡入

给空 `Suspense` fallback 增加骨架或静态占位。改动最小，但不能解决焦点落点延迟、预览与编辑器布局不一致和弹窗动画期间重排，只能遮挡部分症状，因此不采用。

## 架构

### 1. 统一加载入口

三个入口都通过 `src/components/editor/cardEditorLoader.tsx` 导出的 lazy editor 和预加载函数加载编辑器，删除弹窗内重复的 lazy 声明。统一入口保证模块 Promise 和预加载行为只有一个来源。

### 2. 编辑器 readiness 协议

`CardBlockNoteEditor` 增加可选的 `onReady` 回调。回调只在当前编辑器实例首次满足以下条件后触发一次：

1. ProseMirror DOM 已挂载；
2. 初始内容已经进入 editor document；
3. 浏览器至少完成一次布局帧；
4. 若入口要求自动聚焦，焦点或坐标选区已经设置完成。

readiness 只描述“首次可稳定显示”，不参与保存逻辑，也不会在每次内容更新时重新触发。

为了避免 React effect 与父级聚焦形成竞态，画布入口负责传入初始聚焦意图；编辑器在自身 DOM 可用后执行该意图，再发出 `onReady`。后续点击已打开的编辑器仍使用现有 imperative handle。

### 3. 共享进入容器

新增一个轻量的编辑器进入容器，管理 `mounting → ready → interactive` 三个状态：

- `mounting`：保留真实内容预览，编辑器已挂载但不可见且不接收指针事件。
- `ready`：编辑器已完成首次布局；容器安排下一次 `requestAnimationFrame`，避免 readiness 与显现落在同一布局阶段。
- `interactive`：编辑器可见并接收输入，预览层移除。

容器不管理卡片数据、保存或编辑器实例，只管理视觉层和首次可交互时序。切换 `contentKey` 时必须重新进入 `mounting`，并丢弃上一卡片迟到的 readiness 信号。

默认显现采用短透明度过渡，不改变宽高、padding 或 transform。检测到 `prefers-reduced-motion: reduce` 时直接显现。

## 各入口行为

### 画布卡片内联编辑

- 用户点击预览时记录卡片 ID 和点击坐标。
- 卡片继续显示当前已净化的 HTML 预览，同时在相同内容盒中挂载编辑器。
- 编辑器使用记录的坐标完成首次选区定位；坐标定位完成后发出 readiness。
- 下一绘制帧切换到编辑器，避免先出现内容、再跳光标。
- 编辑器失焦退出时沿用现有 flush、历史快照和 `isEditing` 逻辑。
- 进入期间卡片的尺寸、滚动容器和 padding 与进入前保持一致，不触发卡片自动缩放或节点高度变化。

### 右侧编辑面板

- 切换 `editingCardId` 时立即展示目标卡片的真实内容预览，而不是空 fallback。
- 为目标卡片创建新编辑器，并用卡片 ID 作为 transition token；上一实例的迟到回调无法解锁新实例。
- 新编辑器进入 interactive 后移除预览。
- 保留按卡片 ID 重建实例的隔离边界，避免复用 ProseMirror history 或未提交状态到另一张卡片。

### 卡片编辑弹窗

- 改用共享 lazy editor。
- 弹窗外壳和标题、颜色控制立即显示；内容区先显示目标卡片真实预览。
- 编辑器可以与形变动画并行挂载，但只有 readiness 和弹窗首个稳定布局帧均完成后才显现。
- 不等待完整 0.5 秒动画结束，避免人为增加可编辑延迟；只要求内容区尺寸已经可用并完成至少一次布局。
- 弹窗关闭、删除和历史快照行为保持不变。

## 内容预览与样式

- 进入层复用现有 `previewHTML`；若调用方没有缓存预览，则通过现有 `getPreviewHTML(cardId)` 获取并使用 DOMPurify 净化。
- 预览与编辑器共享相同的字体大小、行高、内边距、文本颜色和滚动容器。
- 两层叠放期间，预览层不可选择、不接收指针事件，也不暴露重复的可访问性内容。
- 编辑器隐藏阶段使用 `visibility`/`opacity` 和 pointer-events 控制，但保持可布局，不能使用 `display: none`。
- 过渡不得作用于 transform、height、width、padding 或滚动位置。

## 数据一致性与异常处理

- 每次进入创建单调递增或卡片 ID 绑定的 transition token；只有当前 token 的 readiness 能推进状态。
- 组件卸载时取消未执行的 animation frame，避免卸载后 setState。
- 若 lazy import 失败，现有 ErrorBoundary 接管；预览内容保持可见，不留下空白内容区。
- 若编辑器 ref 或 ProseMirror DOM 未就绪，继续等待有限的绘制帧；正常路径不设置固定毫秒延迟。
- readiness 不触发 `onChange`，初始内容解析不得被当作用户编辑。
- 切卡、关闭弹窗或失焦时，仍由现有编辑器卸载/blur 路径刷新待保存内容。

## 性能约束

- 非编辑卡片不新增 BlockNote 实例、观察器或逐帧循环。
- 单个入口在 `mounting` 期间最多同时存在一份预览 DOM 和一份编辑器 DOM。
- readiness 完成后立即移除预览层和相关帧任务。
- 不在 pointer/click handler 中同步执行大段内容转换。
- 模块预加载仍在工作区 data-ready 后执行，且所有入口共享同一预加载实现。

## 测试与验收

### 单元与组件测试

- 状态机：仅当前 token 可从 `mounting` 推进到 `ready`/`interactive`。
- reduced-motion：readiness 后直接 interactive，不安排淡入等待。
- 卸载清理：取消待执行 animation frame。
- 共享 loader：弹窗、右侧面板和画布只使用统一 lazy editor。
- 画布首次聚焦：初始坐标在 readiness 前执行；后续点击继续走 imperative `focusAtCoords`。
- 切卡隔离：上一卡片的迟到 readiness 不会显示或解锁当前卡片编辑器。

### 交互回归

- 冷启动后首次点击画布卡片，内容区不存在空白帧，光标直接落到预期文本附近。
- 第二次及后续进入同一或其他卡片同样稳定。
- 右侧面板快速连续切换卡片，不显示上一卡片编辑器内容，不出现空白内容区。
- 弹窗从卡片位置放大时内容持续可见，编辑器不会在动画中途闪现或改变容器尺寸。
- 空卡片、长卡片、包含图片/引用/标签的卡片均可进入编辑。
- 浅色、深色和 reduced-motion 模式行为正确。
- 保存防抖、失焦 flush、历史快照、撤销/重做、两段式 `Ctrl/Cmd+A`、图片粘贴和引用跳转保持原行为。

### 验证命令

- 对新增和修改的编辑器相关测试运行聚焦 Vitest。
- 对修改文件运行定向 ESLint。
- 运行 TypeScript 类型检查。
- 运行单元测试全集。
- 运行 Electron 构建和 bundle budget 检查，确认统一 loader 没有造成重复编辑器 chunk。
- 运行编辑器入口相关 Playwright 子集，使用 `reuseExistingServer: false` 的独立服务验证首次进入行为。
- 运行 `git diff --check`，并在提交前运行 GitNexus `detect_changes()` 审核受影响符号和执行流程。

## 实施边界

预计修改集中在：

- `src/components/editor/BlockNoteEditor.tsx`
- `src/components/editor/cardEditorLoader.tsx`
- 新的共享进入容器及其测试
- `src/components/canvas/useCardNodeEditing.ts`
- `src/components/canvas/card/CardContent.tsx`
- `src/components/ui/RightPanel.tsx`
- `src/components/ui/CardEditDialog.tsx`
- `src/components/editor/card-blocknote-editor.css`
- 对应 `.test.ts` 与必要的编辑器入口 E2E 用例

实施前必须对实际要修改的函数、组件和 hook 分别执行 GitNexus upstream impact。若风险达到 HIGH 或 CRITICAL，先报告直接调用方、受影响流程和兼容策略，再继续编辑。
