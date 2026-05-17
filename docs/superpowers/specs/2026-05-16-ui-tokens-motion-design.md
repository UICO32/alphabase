# UI Token 变量、设计规范与动效系统 设计文档

## 1. 设计目标

- 建立统一的 CSS Token 变量体系，覆盖色彩、圆角、阴影、字重、字号、字色、间距、动效等维度。
- 所有 UI 模块（CardNode、SectionNode、ConnectionEdge、MediaNode、面板、按钮、输入框、弹窗等）共享同一套 Token，消除硬编码色值和样式碎片。
- 引入丝滑的贝塞尔动画效果，统一 hover、select、active、focus、disabled、forbidden 等交互状态。
- 文字先采用系统默认字体栈，不引入外部字体文件。
- 兼容 Tailwind CSS v4，Token 通过 CSS 自定义属性定义，Tailwind 工具类可直接消费。

## 2. Token 体系架构

### 2.1 技术选型

- **CSS 自定义属性（CSS Variables）**：定义在 `:root` 和 `[data-theme="dark"]` 下，运行时切换主题无需重新构建。
- **Tailwind v4 兼容**：Token 命名与 Tailwind 默认变量不冲突，同时可作为任意值使用（如 `bg-[var(--surface-panel)]`）。
- **TS 类型辅助**：提供 `theme.ts` 读取当前 token 值（用于 Canvas 节点等无法直接用 CSS 变量的场景）。

### 2.2 Token 分层

| 层级 | 前缀 | 说明 |
|------|------|------|
| Primitive | `--color-*` | 基础色板（灰阶、品牌色、语义色） |
| Semantic | `--surface-*` | 表面色（背景、面板、卡片、输入框） |
| Semantic | `--text-*` | 文字色（主文字、次要、禁用、反色） |
| Semantic | `--border-*` | 边框色（默认、悬浮、激活、错误） |
| Semantic | `--shadow-*` | 阴影层级（sm / md / lg / xl / glow） |
| Component | `--radius-*` | 圆角（none / sm / md / lg / xl / full） |
| Component | `--font-size-*` | 字号（xs / sm / base / md / lg / xl） |
| Component | `--font-weight-*` | 字重（normal / medium / semibold / bold） |
| Motion | `--ease-*` | 贝塞尔曲线 |
| Motion | `--duration-*` | 时长（fast / normal / slow / slower） |

### 2.3 完整 Token 定义（Light Theme）

```css
:root {
  /* Primitive Colors */
  --color-white: #ffffff;
  --color-black: #000000;
  --color-gray-50: #fafafa;
  --color-gray-100: #f4f4f5;
  --color-gray-200: #e4e4e7;
  --color-gray-300: #d4d4d8;
  --color-gray-400: #a1a1aa;
  --color-gray-500: #71717a;
  --color-gray-600: #52525b;
  --color-gray-700: #3f3f46;
  --color-gray-800: #27272a;
  --color-gray-900: #18181b;
  --color-blue-50: #eff6ff;
  --color-blue-100: #dbeafe;
  --color-blue-400: #60a5fa;
  --color-blue-500: #3b82f6;
  --color-blue-600: #2563eb;
  --color-green-400: #4ade80;
  --color-green-500: #22c55e;
  --color-red-400: #f87171;
  --color-red-500: #ef4444;
  --color-red-600: #dc2626;

  /* Surface */
  --surface-app: #fafafa;
  --surface-panel: #fafafa;
  --surface-panel-alt: #fafaf9;
  --surface-card: #ffffff;
  --surface-card-hover: #fafafa;
  --surface-card-active: #f4f4f5;
  --surface-input: #ffffff;
  --surface-input-hover: #fafafa;
  --surface-overlay: rgba(0, 0, 0, 0.5);

  /* Text */
  --text-primary: #18181b;
  --text-secondary: #71717a;
  --text-tertiary: #a1a1aa;
  --text-disabled: #d4d4d8;
  --text-inverse: #ffffff;
  --text-link: #3b82f6;
  --text-link-hover: #2563eb;
  --text-danger: #ef4444;

  /* Border */
  --border-default: #e5e5e5;
  --border-hover: #d4d4d8;
  --border-active: #3b82f6;
  --border-focus: rgba(59, 130, 246, 0.35);
  --border-danger: #ef4444;

  /* Shadow */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 8px 24px rgba(15, 23, 42, 0.10);
  --shadow-xl: 0 18px 40px rgba(15, 23, 42, 0.12);
  --shadow-glow-blue: 0 0 0 2px rgba(59, 130, 246, 0.22), 0 8px 24px rgba(59, 130, 246, 0.15);
  --shadow-glow-green: 0 0 0 2px rgba(34, 197, 94, 0.40), 0 4px 16px rgba(34, 197, 94, 0.15);
  --shadow-glow-red: 0 0 0 2px rgba(239, 68, 68, 0.35);
  --shadow-inner: inset 0 0 0 1px var(--border-default);
  --shadow-inner-active: inset 0 0 0 1px var(--border-active);

  /* Radius */
  --radius-none: 0px;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 18px;
  --radius-full: 9999px;

  /* Font Size */
  --font-size-xs: 11px;
  --font-size-sm: 12px;
  --font-size-base: 13px;
  --font-size-md: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 20px;

  /* Font Weight */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;

  /* Motion */
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-smooth: cubic-bezier(0.25, 0.1, 0.25, 1);

  --duration-fast: 120ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --duration-slower: 400ms;
}
```

### 2.4 Dark Theme

```css
[data-theme="dark"] {
  /* Surface */
  --surface-app: #0a0f1a;
  --surface-panel: #0f172a;
  --surface-panel-alt: #111c31;
  --surface-card: #0b1220;
  --surface-card-hover: #111c31;
  --surface-card-active: #1e293b;
  --surface-input: #0b1220;
  --surface-input-hover: #111c31;
  --surface-overlay: rgba(0, 0, 0, 0.65);

  /* Text */
  --text-primary: #e5e7eb;
  --text-secondary: #94a3b8;
  --text-tertiary: #64748b;
  --text-disabled: #475569;
  --text-inverse: #0f172a;
  --text-link: #60a5fa;
  --text-link-hover: #93c5fd;
  --text-danger: #f87171;

  /* Border */
  --border-default: rgba(51, 65, 85, 0.9);
  --border-hover: rgba(71, 85, 105, 0.9);
  --border-active: #3b82f6;
  --border-focus: rgba(96, 165, 250, 0.35);
  --border-danger: #ef4444;

  /* Shadow */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.25);
  --shadow-lg: 0 10px 30px rgba(2, 6, 23, 0.35);
  --shadow-xl: 0 18px 40px rgba(2, 6, 23, 0.45);
  --shadow-glow-blue: 0 0 0 2px rgba(96, 165, 250, 0.28), 0 8px 24px rgba(96, 165, 250, 0.2);
  --shadow-glow-green: 0 0 0 2px rgba(34, 197, 94, 0.45), 0 4px 20px rgba(34, 197, 94, 0.2);
  --shadow-glow-red: 0 0 0 2px rgba(239, 68, 68, 0.4);
  --shadow-inner: inset 0 0 0 1px var(--border-default);
  --shadow-inner-active: inset 0 0 0 1px var(--border-active);
}
```

## 3. 交互状态规范

### 3.1 通用状态定义

| 状态 | Token 后缀 | 说明 |
|------|-----------|------|
| Default | （基础值） | 默认样式 |
| Hover | `-hover` | 鼠标悬浮，背景/边框/阴影提升 |
| Active / Pressed | `-active` | 鼠标按下，scale(0.98) + 背景加深 |
| Focus | `-focus` | 键盘聚焦，ring 光环 |
| Selected | `-selected` | 选中状态，蓝色 glow + 边框 |
| Disabled | `-disabled` | 禁用，opacity 0.45 + pointer-events none |
| Forbidden | `-forbidden` | 禁止操作，红色 glow 或 cursor not-allowed |

### 3.2 状态动效参数

| 状态变化 | 属性 | 时长 | 曲线 |
|---------|------|------|------|
| Hover 进入 | background, border, shadow, transform | 200ms | ease-default |
| Hover 离开 | background, border, shadow, transform | 150ms | ease-out |
| Active / Click | transform: scale(0.98) | 100ms | ease-in |
| Active 释放 | transform: scale(1) | 200ms | ease-bounce |
| Focus | box-shadow (ring) | 200ms | ease-default |
| Selected | box-shadow, border-color | 250ms | ease-default |
| Disabled | opacity | 150ms | ease-default |
| Panel 展开/折叠 | width, opacity | 300ms | ease-smooth |
| Card 出现 | opacity, transform(scale+translateY) | 300ms | ease-out |
| Card 消失 | opacity, transform(scale) | 200ms | ease-in |
| Edge 选中 | stroke, stroke-width, stroke-dasharray | 250ms | ease-default |

## 4. 各模块状态设计

### 4.1 CardNode

| 状态 | 样式 |
|------|------|
| Default | shadow-md, border-default, radius-lg |
| Hover | shadow-lg, translateY(-1px), border-hover |
| Selected | shadow-glow-blue, border-active, ring |
| Active (Press) | scale(0.99) |
| Connecting Source | shadow-glow-blue, pulse 动画 |
| Connection Target | shadow-glow-green |
| Nearby Target | shadow-glow-green, scale(1.02) |
| Editing | shadow-xl, border-active |
| Forbidden (连接无效) | shadow-glow-red, cursor not-allowed |

### 4.2 SectionNode

| 状态 | 样式 |
|------|------|
| Default | border-dashed, border-default, radius-lg, bg-transparent |
| Hover | border-hover, bg-surface-card-hover |
| Selected | border-active, shadow-glow-blue |
| Active (Resize) | border-active, cursor se-resize |

### 4.3 ConnectionEdge

| 状态 | 样式 |
|------|------|
| Default | stroke: text-secondary, strokeWidth: 2, strokeDasharray: 6,4 |
| Hover | strokeWidth: 3, stroke: text-primary |
| Selected | stroke: border-active, strokeWidth: 3, strokeDasharray: 8,3 |
| Forbidden | stroke: text-danger, strokeDasharray: 4,4 |

### 4.4 MediaNode

| 状态 | 样式 |
|------|------|
| Default | border-transparent, radius-sm |
| Hover | shadow-md |
| Selected | shadow-glow-blue, outline border-active |
| Loading | opacity 0.6 + pulse |

### 4.5 面板 (LeftPanel / RightPanel)

| 状态 | 样式 |
|------|------|
| Default | surface-panel, border-default |
| Tab Hover | surface-card-hover |
| Tab Selected | surface-card, text-primary |
| Collapse Button Hover | scale(1.05), shadow-lg |

### 4.6 按钮 / IconButton

| 状态 | 样式 |
|------|------|
| Default | surface-card, text-primary |
| Hover | surface-card-hover, shadow-sm |
| Active | scale(0.96), surface-card-active |
| Focus | ring (border-focus) |
| Disabled | opacity 0.45, cursor not-allowed |
| Primary | bg-blue-500, text-inverse |
| Primary Hover | bg-blue-600, shadow-md |
| Danger | bg-red-500/10, text-danger |
| Danger Hover | bg-red-500/20 |

### 4.7 输入框 (SearchInput / 文本输入)

| 状态 | 样式 |
|------|------|
| Default | surface-input, border-default |
| Hover | border-hover |
| Focus | border-active, shadow-glow-blue (ring) |
| Disabled | opacity 0.45, bg-surface-card |
| Error | border-danger, shadow-glow-red |

### 4.8 弹窗 (Dialog / Modal)

| 状态 | 样式 |
|------|------|
| Backdrop | surface-overlay, opacity 0 → 1 |
| Content Enter | scale(0.96) → scale(1), opacity 0 → 1, 300ms ease-out |
| Content Leave | scale(1) → scale(0.96), opacity 1 → 0, 200ms ease-in |

### 4.9 列表项 / 卡片库项

| 状态 | 样式 |
|------|------|
| Default | surface-card, border-default |
| Hover | surface-card-hover, shadow-sm, translateX(2px) |
| Active | scale(0.98), surface-card-active |
| Selected | border-active, shadow-glow-blue |
| Dragging | shadow-xl, scale(1.02), opacity 0.9, rotate(1deg) |

## 5. 全局动画关键帧

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-12px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(12px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
```

## 6. 文件结构

```
src/
  theme/
    tokens.css          # Token 变量定义（light + dark）
    tokens.ts           # TS 辅助：读取 token 值、theme 切换
    animations.css      # 全局 keyframes + 工具类
    index.ts            # 统一导出
```

## 7. 迁移策略

1. **新增文件**：创建 `tokens.css`、`animations.css`、`tokens.ts`。
2. **入口引入**：在 `main.tsx` 或 `index.css` 中 `@import` 新 CSS 文件。
3. **逐步替换**：按模块替换硬编码色值：
   - 第1轮：App、面板框架（LeftPanel、RightPanel、Toolbar）
   - 第2轮：CardNode、SectionNode、MediaNode、ConnectionEdge
   - 第3轮：弹窗、输入框、按钮、列表项
   - 第4轮：清理废弃的 `panelSurface.ts`、`cardVariantStyles.ts`
4. **验证**：每轮替换后启动 dev server，检查视觉一致性。

## 8. 兼容性

- 保留现有 `getPanelSurface()` 和 `getCardVariantStyles()` 的返回值结构，在 `tokens.ts` 中做适配层映射，避免一次性改动过大。
- CardNode 的 `backdropFilter` 等无法通过 CSS Variable 在 style 属性中直接使用的属性，继续通过 TS 计算，但色值来源改为 token。
