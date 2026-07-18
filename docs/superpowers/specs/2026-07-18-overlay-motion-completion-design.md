# 浮层与动效全量收口设计

**关联设计：** `2026-07-18-interaction-ui-consistency-design.md`

**已确认范围：** 用户选择全量治理现有浮层与动效，但继续遵守保守视觉方案，不改变品牌、信息架构、编辑语义或画布数据行为。

## 1. 目标

- 所有共享及高频自定义浮层使用同一套层级、表面、边框、阴影、圆角和进入方向规则。
- Tooltip、菜单、选择器、底部命令条和模态编辑器各自表达清晰的空间来源。
- 移除 zoom、bounce、持续呼吸及不必要的按压缩放，避免布局属性参与常规动画。
- 键盘焦点、Escape、外部点击和关闭后焦点回收保持可预测。
- `prefers-reduced-motion: reduce` 下关闭位移、缩放和装饰性动画。

## 2. 浮层类型

| 类型 | 组件 | 行为 |
| --- | --- | --- |
| Tooltip | `shadcn/tooltip.tsx` | 120–150ms 淡入和 2px 来源位移，无缩放 |
| 菜单 | Dropdown、ContextMenu、自定义格式/画板菜单 | 150ms 淡入和 4px 来源位移，统一菜单项状态 |
| Select | `shadcn/select.tsx` | 与菜单共享表面和方向，但保留 Radix viewport/position 逻辑 |
| 浮动工具栏 | Alignment、Image、Frame 工具栏 | 150–180ms 淡入和小位移，不改变定位算法 |
| 底部命令条 | `ClipUrlBar` | 180ms 淡入并从底部上移 6px，保持非模态 |
| 模态编辑器 | `CardEditDialog` | 视口安全 Dialog、焦点约束、Escape/遮罩关闭和焦点回收 |

## 3. 共享样式边界

在现有主题层建立并复用以下语义类，不新增视觉系统：

- `.ui-floating-surface`：菜单/选择器/工具栏的表面、边框、阴影和层级基础。
- `.ui-floating-content`：基于 `data-side` 的短距离进入/退出动画。
- `.ui-tooltip-content`：更轻的 Tooltip 表面和 2px 位移。
- `.ui-command-bar`：底部命令条专用进入/退出动画。
- `.ui-modal-overlay`、`.ui-modal-content`：继续由 Dialog foundation 承载，不允许自定义高层级遮罩分叉。

组件定位、碰撞检测、业务事件和内容结构保持不变。

## 4. 动效规则

- hover/pressed：100–140ms；pressed 使用 `translateY(1px)` 或表面变化，不使用 `scale`。
- Tooltip：140ms；菜单/Select/浮动工具栏：150–180ms；Dialog：200ms。
- 只动画 `transform`、`opacity`、颜色和阴影。进度条宽度属于信息表达例外。
- 进入方向必须来自触发器、所属边缘或底部锚点。
- reduced-motion 下空间移动、缩放、stagger、shimmer、循环 pulse 和 view transition 均关闭。

## 5. 迁移范围

本轮包含：

- `shadcn/context-menu.tsx`、`select.tsx`、`tooltip.tsx`。
- `SummaryFormatMenu`、`BoardSubmenu`、`AlignmentToolbar`、`ImageToolbar`、Frame 的颜色/布局菜单。
- `ClipUrlBar`、`CardEditDialog`。
- Card Library、Board Library、设置色板、通用 `.active-press`、`.animate-fadeInUp` 等已识别动效债务。

不改变卡片编辑器内容、BlockNote 行为、菜单命令含义、Frame 布局算法、画布定位或数据读写。

## 6. 验收标准

- 各共享浮层不再包含 zoom/bounce 类，表面 token 与 z-index token 一致。
- ContextMenu、Select、Tooltip 可通过键盘打开/操作/关闭；方向动画与 `data-side` 一致。
- 自定义画布菜单保持原定位和命令行为，视觉表面及动效统一。
- CardEditDialog 在 480px 宽度内有至少 16px 安全边距，焦点受约束，Escape/遮罩关闭后返回触发点。
- 常规模式无明显跳动；reduced-motion 下 computed style 不包含空间动画。
- 类型检查、定向 ESLint、相关 Vitest 和多视口 Playwright 全部通过。

