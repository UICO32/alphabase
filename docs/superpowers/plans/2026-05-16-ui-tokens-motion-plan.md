# UI Token 变量、设计规范与动效系统 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立统一的 CSS Token 变量体系与动效系统，覆盖所有 UI 模块的交互状态，消除硬编码色值，引入丝滑贝塞尔动画。

**Architecture:** 使用 CSS 自定义属性（CSS Variables）定义 Token，通过 `data-theme` 属性切换 light/dark 模式。全局动画关键帧和过渡工具类统一放在 `animations.css`。提供 `tokens.ts` 作为 TS 辅助层，将 Token 值映射到现有 `getPanelSurface()` 和 `getCardVariantStyles()` 的返回结构，保证平滑迁移。

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind CSS v4 + CSS Variables

---

## 文件结构

```
src/
  theme/
    tokens.css          # 新建：Token 变量定义（light + dark）
    animations.css      # 新建：全局 keyframes + 动画工具类
    tokens.ts           # 新建：TS 辅助、theme 切换、token 读取
    index.ts            # 新建：统一导出
  index.css             # 修改：引入新 CSS 文件
  main.tsx              # 修改：初始化 theme
```

---

## Task 1: 创建 Token CSS 文件

**Files:**
- Create: `src/theme/tokens.css`

- [ ] **Step 1: 编写 tokens.css**

```css
/* ============================================
   Design Token System
   ============================================ */

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

/* ============================================
   Dark Theme
   ============================================ */

[data-theme="dark"] {
  --surface-app: #0a0f1a;
  --surface-panel: #0f172a;
  --surface-panel-alt: #111c31;
  --surface-card: #0b1220;
  --surface-card-hover: #111c31;
  --surface-card-active: #1e293b;
  --surface-input: #0b1220;
  --surface-input-hover: #111c31;
  --surface-overlay: rgba(0, 0, 0, 0.65);

  --text-primary: #e5e7eb;
  --text-secondary: #94a3b8;
  --text-tertiary: #64748b;
  --text-disabled: #475569;
  --text-inverse: #0f172a;
  --text-link: #60a5fa;
  --text-link-hover: #93c5fd;
  --text-danger: #f87171;

  --border-default: rgba(51, 65, 85, 0.9);
  --border-hover: rgba(71, 85, 105, 0.9);
  --border-active: #3b82f6;
  --border-focus: rgba(96, 165, 250, 0.35);
  --border-danger: #ef4444;

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

- [ ] **Step 2: Commit**

```bash
git add src/theme/tokens.css
git commit -m "feat(theme): add design token CSS variables for light and dark themes"
```

---

## Task 2: 创建动画 CSS 文件

**Files:**
- Create: `src/theme/animations.css`

- [ ] **Step 1: 编写 animations.css**

```css
/* ============================================
   Global Animations & Transition Utilities
   ============================================ */

/* Keyframes */
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

/* Transition Utility Classes */
.transition-theme {
  transition-property: background-color, border-color, color, fill, stroke, opacity, box-shadow, transform;
  transition-duration: var(--duration-normal);
  transition-timing-function: var(--ease-default);
}

.transition-fast {
  transition-duration: var(--duration-fast);
}

.transition-slow {
  transition-duration: var(--duration-slow);
}

.transition-transform {
  transition-property: transform;
}

.transition-shadow {
  transition-property: box-shadow;
}

/* Hover Lift Effect */
.hover-lift {
  transition: transform var(--duration-normal) var(--ease-default),
              box-shadow var(--duration-normal) var(--ease-default);
}

.hover-lift:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

/* Active Press Effect */
.active-press:active {
  transform: scale(0.98);
  transition-duration: var(--duration-fast);
  transition-timing-function: var(--ease-in);
}

/* Focus Ring */
.focus-ring:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--border-focus);
  transition: box-shadow var(--duration-normal) var(--ease-default);
}

/* Selected Glow */
.selected-glow {
  box-shadow: var(--shadow-glow-blue);
  transition: box-shadow var(--duration-slow) var(--ease-default);
}

/* Forbidden State */
.forbidden-state {
  cursor: not-allowed;
  opacity: 0.6;
}

.forbidden-glow {
  box-shadow: var(--shadow-glow-red);
}

/* Animation Classes */
.animate-fadeIn {
  animation: fadeIn var(--duration-slow) var(--ease-out) forwards;
}

.animate-fadeInUp {
  animation: fadeInUp var(--duration-slow) var(--ease-out) forwards;
}

.animate-scaleIn {
  animation: scaleIn var(--duration-slow) var(--ease-out) forwards;
}

.animate-pulse {
  animation: pulse 2s var(--ease-default) infinite;
}

.animate-shake {
  animation: shake var(--duration-normal) var(--ease-default);
}

.animate-slideInLeft {
  animation: slideInLeft var(--duration-slow) var(--ease-out) forwards;
}

.animate-slideInRight {
  animation: slideInRight var(--duration-slow) var(--ease-out) forwards;
}

/* Modal Transitions */
.modal-backdrop {
  transition: opacity var(--duration-slow) var(--ease-default);
}

.modal-content {
  transition: opacity var(--duration-slow) var(--ease-out),
              transform var(--duration-slow) var(--ease-out);
}

.modal-content-enter {
  opacity: 0;
  transform: scale(0.96);
}

.modal-content-enter-active {
  opacity: 1;
  transform: scale(1);
}

.modal-content-exit {
  opacity: 1;
  transform: scale(1);
}

.modal-content-exit-active {
  opacity: 0;
  transform: scale(0.96);
  transition-timing-function: var(--ease-in);
  transition-duration: var(--duration-normal);
}

/* Card Node Specific */
.card-node-default {
  transition: box-shadow var(--duration-normal) var(--ease-default),
              outline-color var(--duration-normal) var(--ease-default),
              transform var(--duration-fast) var(--ease-default);
}

.card-node-hover:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-1px);
}

.card-node-selected {
  box-shadow: var(--shadow-glow-blue);
}

.card-node-connecting-source {
  animation: pulse 1.5s var(--ease-default) infinite;
  box-shadow: var(--shadow-glow-blue);
}

.card-node-nearby-target {
  box-shadow: var(--shadow-glow-green);
  transform: scale(1.02);
}

.card-node-forbidden {
  box-shadow: var(--shadow-glow-red);
  cursor: not-allowed;
}

/* Edge Specific */
.edge-default {
  transition: stroke var(--duration-normal) var(--ease-default),
              stroke-width var(--duration-normal) var(--ease-default),
              stroke-dasharray var(--duration-normal) var(--ease-default);
}

.edge-hover:hover {
  stroke-width: 3;
}

.edge-selected {
  stroke: var(--border-active);
  stroke-width: 3;
  stroke-dasharray: 8, 3;
}

.edge-forbidden {
  stroke: var(--text-danger);
  stroke-dasharray: 4, 4;
}

/* Panel Specific */
.panel-tab {
  transition: background-color var(--duration-normal) var(--ease-default),
              color var(--duration-normal) var(--ease-default);
}

.panel-tab-hover:hover {
  background-color: var(--surface-card-hover);
}

.panel-tab-selected {
  background-color: var(--surface-card);
  color: var(--text-primary);
}

/* Button Specific */
.btn-base {
  transition: background-color var(--duration-normal) var(--ease-default),
              box-shadow var(--duration-normal) var(--ease-default),
              transform var(--duration-fast) var(--ease-in);
}

.btn-base:active {
  transform: scale(0.96);
}

.btn-primary {
  background-color: var(--color-blue-500);
  color: var(--text-inverse);
}

.btn-primary:hover {
  background-color: var(--color-blue-600);
  box-shadow: var(--shadow-md);
}

.btn-danger {
  background-color: rgba(239, 68, 68, 0.1);
  color: var(--text-danger);
}

.btn-danger:hover {
  background-color: rgba(239, 68, 68, 0.2);
}

/* Input Specific */
.input-base {
  transition: border-color var(--duration-normal) var(--ease-default),
              box-shadow var(--duration-normal) var(--ease-default);
}

.input-base:hover {
  border-color: var(--border-hover);
}

.input-base:focus {
  outline: none;
  border-color: var(--border-active);
  box-shadow: var(--shadow-glow-blue);
}

.input-error {
  border-color: var(--border-danger);
  box-shadow: var(--shadow-glow-red);
}

/* List Item / Card Library Item */
.list-item {
  transition: background-color var(--duration-normal) var(--ease-default),
              box-shadow var(--duration-normal) var(--ease-default),
              transform var(--duration-normal) var(--ease-default);
}

.list-item:hover {
  background-color: var(--surface-card-hover);
  box-shadow: var(--shadow-sm);
  transform: translateX(2px);
}

.list-item:active {
  transform: scale(0.98);
  background-color: var(--surface-card-active);
}

.list-item-selected {
  border-color: var(--border-active);
  box-shadow: var(--shadow-glow-blue);
}

/* Section Node */
.section-node {
  transition: border-color var(--duration-normal) var(--ease-default),
              background-color var(--duration-normal) var(--ease-default),
              box-shadow var(--duration-normal) var(--ease-default);
}

.section-node:hover {
  border-color: var(--border-hover);
  background-color: var(--surface-card-hover);
}

.section-node-selected {
  border-color: var(--border-active);
  box-shadow: var(--shadow-glow-blue);
}

/* Media Node */
.media-node {
  transition: box-shadow var(--duration-normal) var(--ease-default);
}

.media-node:hover {
  box-shadow: var(--shadow-md);
}

.media-node-selected {
  box-shadow: var(--shadow-glow-blue);
  outline: 2px solid var(--border-active);
}

/* Loading State */
.loading-pulse {
  animation: pulse 1.5s var(--ease-default) infinite;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/theme/animations.css
git commit -m "feat(theme): add global animation keyframes and transition utility classes"
```

---

## Task 3: 创建 TS Token 辅助层

**Files:**
- Create: `src/theme/tokens.ts`
- Create: `src/theme/index.ts`

- [ ] **Step 1: 编写 tokens.ts**

```typescript
/**
 * Token 辅助层
 * 提供运行时读取 CSS Variable 的能力，以及 theme 切换逻辑。
 * 同时提供兼容层，将新 Token 映射到旧的 getPanelSurface / getCardVariantStyles 返回结构。
 */

export type ThemeMode = 'light' | 'dark'

/**
 * 读取指定 CSS 变量的当前计算值
 */
export function getTokenValue(name: string, fallback?: string): string {
  if (typeof window === 'undefined') return fallback ?? ''
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || (fallback ?? '')
}

/**
 * 批量读取一组 token
 */
export function getTokens(names: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  names.forEach((name) => {
    result[name] = getTokenValue(name)
  })
  return result
}

/**
 * 设置 data-theme 属性以切换主题
 */
export function setTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', mode)
  localStorage.setItem('hepta-theme', mode)
}

/**
 * 获取当前主题
 */
export function getTheme(): ThemeMode {
  const stored = localStorage.getItem('hepta-theme')
  if (stored === 'dark' || stored === 'light') return stored
  return 'light'
}

/**
 * 初始化主题（在应用启动时调用）
 */
export function initTheme(): void {
  const mode = getTheme()
  document.documentElement.setAttribute('data-theme', mode)
}

/**
 * 切换主题
 */
export function toggleTheme(): ThemeMode {
  const current = getTheme()
  const next = current === 'light' ? 'dark' : 'light'
  setTheme(next)
  return next
}

// ============================================
// 兼容层：映射到旧的 PanelSurface 结构
// ============================================

export type PanelSurface = {
  appBg: string
  panelBg: string
  panelAlt: string
  surface: string
  card: string
  cardBorder: string
  text: string
  muted: string
  divider: string
  shadow: string
}

export function getPanelSurface(isDarkMode: boolean): PanelSurface {
  // 设置临时主题以读取正确值
  const prevTheme = document.documentElement.getAttribute('data-theme')
  if (isDarkMode) {
    document.documentElement.setAttribute('data-theme', 'dark')
  } else {
    document.documentElement.setAttribute('data-theme', 'light')
  }

  const surface: PanelSurface = {
    appBg: getTokenValue('--surface-app'),
    panelBg: getTokenValue('--surface-panel'),
    panelAlt: getTokenValue('--surface-panel-alt'),
    surface: getTokenValue('--surface-card'),
    card: getTokenValue('--surface-card'),
    cardBorder: getTokenValue('--border-default'),
    text: getTokenValue('--text-primary'),
    muted: getTokenValue('--text-secondary'),
    divider: getTokenValue('--border-default'),
    shadow: isDarkMode
      ? '-12px 0 30px rgba(2,6,23,0.28)'
      : '-12px 0 20px rgba(15,23,42,0.02)',
  }

  // 恢复之前的主题
  if (prevTheme) {
    document.documentElement.setAttribute('data-theme', prevTheme)
  }

  return surface
}

// ============================================
// 兼容层：映射到旧的 CardVariantStyles 结构
// ============================================

import { CARD_COLORS, type CardColor, type CardVariant } from '../types/card'

export type CardVariantStyles = {
  cardBg: string
  border: string
  boxShadow: string
  backdropFilter: string
  textColor: string
  mutedTextColor: string
  menuBg: string
  buttonBg: string
}

const darkSurfaceMap: Record<CardColor, { bg: string; border: string; accent: string }> = {
  white:  { bg: '#1e293b', border: '#334155', accent: '#94a3b8' },
  yellow: { bg: '#3b3416', border: '#6b5b16', accent: '#facc15' },
  blue:   { bg: '#172554', border: '#2563eb', accent: '#60a5fa' },
  green:  { bg: '#052e16', border: '#15803d', accent: '#4ade80' },
  pink:   { bg: '#4a044e', border: '#be185d', accent: '#f472b6' },
  purple: { bg: '#2e1065', border: '#7c3aed', accent: '#a78bfa' },
}

function lightGlass(colors: typeof CARD_COLORS[CardColor], isFocused: boolean): CardVariantStyles {
  return {
    cardBg: 'rgba(255,255,255,0.76)',
    border: colors.border,
    boxShadow: isFocused
      ? getTokenValue('--shadow-glow-blue', '0 0 0 2px rgba(59,130,246,0.22), 0 18px 40px rgba(15,23,42,0.12)')
      : getTokenValue('--shadow-lg', '0 8px 24px rgba(15,23,42,0.10)'),
    backdropFilter: 'blur(16px)',
    textColor: getTokenValue('--text-primary', '#0f172a'),
    mutedTextColor: getTokenValue('--text-secondary', '#64748b'),
    menuBg: getTokenValue('--surface-card', 'rgba(255,255,255,0.98)'),
    buttonBg: getTokenValue('--surface-card', 'rgba(255,255,255,0.95)'),
  }
}

function lightOutline(colors: typeof CARD_COLORS[CardColor], isFocused: boolean): CardVariantStyles {
  return {
    cardBg: getTokenValue('--color-white', '#ffffff'),
    border: colors.accent,
    boxShadow: isFocused
      ? `0 0 0 2px rgba(59,130,246,0.18), inset 0 0 0 1px ${colors.accent}`
      : `inset 0 0 0 1px ${colors.border}`,
    backdropFilter: 'none',
    textColor: getTokenValue('--text-primary', '#0f172a'),
    mutedTextColor: getTokenValue('--text-secondary', '#64748b'),
    menuBg: getTokenValue('--surface-card', 'rgba(255,255,255,0.98)'),
    buttonBg: getTokenValue('--surface-card', 'rgba(255,255,255,0.95)'),
  }
}

function lightSolid(colors: typeof CARD_COLORS[CardColor], isFocused: boolean): CardVariantStyles {
  return {
    cardBg: colors.bg,
    border: colors.border,
    boxShadow: isFocused
      ? getTokenValue('--shadow-glow-blue', '0 0 0 2px rgba(59,130,246,0.25), 0 8px 24px rgba(0,0,0,0.12)')
      : getTokenValue('--shadow-sm', '0 2px 8px rgba(0,0,0,0.08)'),
    backdropFilter: 'none',
    textColor: getTokenValue('--text-primary', '#0f172a'),
    mutedTextColor: getTokenValue('--text-secondary', '#64748b'),
    menuBg: getTokenValue('--surface-card', 'rgba(255,255,255,0.98)'),
    buttonBg: getTokenValue('--surface-card', 'rgba(255,255,255,0.95)'),
  }
}

function darkGlass(isFocused: boolean): CardVariantStyles {
  return {
    cardBg: 'linear-gradient(180deg, rgba(30,41,59,0.90), rgba(15,23,42,0.82))',
    border: 'rgba(148,163,184,0.28)',
    boxShadow: isFocused
      ? getTokenValue('--shadow-glow-blue', '0 0 0 2px rgba(96,165,250,0.28), 0 18px 40px rgba(2,6,23,0.45)')
      : getTokenValue('--shadow-lg', '0 10px 30px rgba(2,6,23,0.35)'),
    backdropFilter: 'blur(18px)',
    textColor: getTokenValue('--text-primary', '#e2e8f0'),
    mutedTextColor: getTokenValue('--text-secondary', '#94a3b8'),
    menuBg: getTokenValue('--surface-panel', 'rgba(15,23,42,0.95)'),
    buttonBg: getTokenValue('--surface-card', 'rgba(30,41,59,0.92)'),
  }
}

function darkOutline(darkSurface: { accent: string; border: string }, isFocused: boolean): CardVariantStyles {
  return {
    cardBg: getTokenValue('--surface-app', '#0f172a'),
    border: darkSurface.accent,
    boxShadow: isFocused
      ? `0 0 0 2px rgba(96,165,250,0.24), inset 0 0 0 1px ${darkSurface.accent}`
      : `inset 0 0 0 1px ${darkSurface.border}`,
    backdropFilter: 'none',
    textColor: getTokenValue('--text-primary', '#e2e8f0'),
    mutedTextColor: getTokenValue('--text-secondary', '#94a3b8'),
    menuBg: getTokenValue('--surface-panel', 'rgba(15,23,42,0.95)'),
    buttonBg: getTokenValue('--surface-card', 'rgba(30,41,59,0.92)'),
  }
}

function darkSolid(darkSurface: { bg: string; border: string }, isFocused: boolean): CardVariantStyles {
  return {
    cardBg: darkSurface.bg,
    border: darkSurface.border,
    boxShadow: isFocused
      ? getTokenValue('--shadow-glow-blue', '0 0 0 2px rgba(96,165,250,0.28), 0 10px 28px rgba(2,6,23,0.38)')
      : getTokenValue('--shadow-md', '0 4px 14px rgba(2,6,23,0.28)'),
    backdropFilter: 'none',
    textColor: getTokenValue('--text-primary', '#e2e8f0'),
    mutedTextColor: getTokenValue('--text-secondary', '#94a3b8'),
    menuBg: getTokenValue('--surface-panel', 'rgba(15,23,42,0.95)'),
    buttonBg: getTokenValue('--surface-card', 'rgba(30,41,59,0.92)'),
  }
}

export function getCardVariantStyles(
  color: CardColor | string | undefined,
  variant: CardVariant | string | undefined,
  isDarkMode: boolean,
  isFocused: boolean,
): CardVariantStyles {
  const safeColor = (color && Object.keys(CARD_COLORS).includes(color)) ? color as CardColor : 'white'
  const safeVariant = (variant && ['solid', 'glass', 'outline'].includes(variant)) ? variant as CardVariant : 'solid'

  const colors = CARD_COLORS[safeColor]

  if (isDarkMode) {
    const darkSurface = darkSurfaceMap[safeColor]
    switch (safeVariant) {
      case 'glass':  return darkGlass(isFocused)
      case 'outline': return darkOutline(darkSurface, isFocused)
      case 'solid':
      default:        return darkSolid(darkSurface, isFocused)
    }
  }

  switch (safeVariant) {
    case 'glass':  return lightGlass(colors, isFocused)
    case 'outline': return lightOutline(colors, isFocused)
    case 'solid':
    default:        return lightSolid(colors, isFocused)
  }
}
```

- [ ] **Step 2: 编写 index.ts**

```typescript
export {
  getTokenValue,
  getTokens,
  setTheme,
  getTheme,
  initTheme,
  toggleTheme,
  getPanelSurface,
  getCardVariantStyles,
} from './tokens'

export type {
  ThemeMode,
  PanelSurface,
  CardVariantStyles,
} from './tokens'
```

- [ ] **Step 3: Commit**

```bash
git add src/theme/tokens.ts src/theme/index.ts
git commit -m "feat(theme): add TS token helper layer with theme switching and backward compatibility"
```

---

## Task 4: 修改入口文件引入新 CSS

**Files:**
- Modify: `src/index.css`
- Modify: `src/main.tsx`

- [ ] **Step 1: 修改 index.css 引入 token 和动画**

```css
@import "tailwindcss";
@import "./theme/tokens.css";
@import "./theme/animations.css";

html, body, #root {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* 允许 ReactFlow viewport 内的弹出层不被裁切 */
.react-flow,
.react-flow__renderer,
.react-flow__pane {
  overflow: visible !important;
}

.react-flow__renderer,
.react-flow__viewport {
  background: transparent !important;
}

/* 全局隐藏滚动条，保留滚动功能 */
* {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
*::-webkit-scrollbar {
  display: none;
}

body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: var(--surface-app);
  color: var(--text-primary);
}
```

- [ ] **Step 2: 修改 main.tsx 初始化 theme**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initAPI } from './utils/api'
import { initTheme } from './theme'
import './index.css'

initAPI()
initTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 3: Commit**

```bash
git add src/index.css src/main.tsx
git commit -m "feat(theme): integrate token CSS and animation utilities into app entry"
```

---

## Task 5: 更新面板组件使用 Token 和动效

**Files:**
- Modify: `src/components/ui/LeftPanel.tsx`
- Modify: `src/components/ui/RightPanel.tsx`
- Modify: `src/components/ui/Toolbar.tsx`
- Modify: `src/components/ui/SharedUI.tsx`

- [ ] **Step 1: 修改 LeftPanel.tsx**

在 LeftPanel.tsx 中，将所有硬编码的 `surface.*` 引用替换为 CSS Variable 引用，并为列表项添加 hover/active 动效类。

关键改动点：
1. 保留 `getPanelSurface(isDarkMode)` 调用（兼容层正常工作）。
2. 为画板列表项添加 `list-item` class。
3. 为按钮添加 `btn-base` class。
4. 为输入框添加 `input-base` class。
5. 将 `transition-colors` 替换为 `transition-theme`。

示例改动（画板列表项）：
```tsx
<div
  key={board.id}
  onClick={() => handleBoardClick(board.id)}
  onDoubleClick={() => handleBoardDoubleClick(board.id, board.name)}
  onContextMenu={(e) => handleBoardContextMenu(e, board.id)}
  className="list-item group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer"
  style={{
    backgroundColor: board.id === activeBoardId ? 'var(--surface-card)' : 'transparent',
    border: `1px solid ${board.id === activeBoardId ? 'var(--border-active)' : 'transparent'}`,
    color: board.id === activeBoardId ? 'var(--text-primary)' : 'var(--text-secondary)',
  }}
>
```

- [ ] **Step 2: 修改 RightPanel.tsx**

为 Tab 按钮添加 `panel-tab` 和 `panel-tab-hover` class：
```tsx
<button
  onClick={() => setRightPanelActiveTab('library')}
  className="panel-tab panel-tab-hover flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
  style={{
    backgroundColor: rightPanelActiveTab === 'library' ? 'var(--surface-card)' : 'transparent',
    color: rightPanelActiveTab === 'library' ? 'var(--text-primary)' : 'var(--text-secondary)',
  }}
>
```

- [ ] **Step 3: 修改 Toolbar.tsx**

为工具栏按钮添加 `btn-base` class，主按钮添加 `btn-primary` class：
```tsx
<button
  onClick={onAddCard}
  className="btn-base btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
>
  <Plus size={14} />
  <span>卡片</span>
</button>

<button
  onClick={() => window.dispatchEvent(new CustomEvent('hepta-zoom-out'))}
  className="btn-base p-2 rounded-lg"
  style={{ color: 'var(--text-primary)' }}
  title="缩小"
>
  <ZoomOut size={16} />
</button>
```

- [ ] **Step 4: 修改 SharedUI.tsx**

为 PanelButton、SearchInput、CollapseButton 等组件添加动效类：

```tsx
// PanelButton
<button
  onClick={onClick}
  className={`btn-base flex items-center gap-1.5 rounded-lg ${sizeClasses[size]}`}
  style={variantStyles[variant]}
>

// SearchInput
<input
  type="text"
  value={value}
  onChange={(e) => onChange(e.target.value)}
  placeholder={placeholder}
  className="input-base w-full px-3 py-2 rounded-lg text-sm outline-none"
  style={{
    backgroundColor: 'var(--surface-input)',
    color: 'var(--text-primary)',
    border: `1px solid var(--border-default)`,
  }}
/>

// CollapseButton
<button
  onClick={(e) => {
    e.stopPropagation()
    onClick()
  }}
  className="btn-base flex items-center justify-center w-6 h-6 rounded"
  style={{ color: 'var(--text-secondary)' }}
>
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/LeftPanel.tsx src/components/ui/RightPanel.tsx src/components/ui/Toolbar.tsx src/components/ui/SharedUI.tsx
git commit -m "feat(ui): apply token-based styles and motion effects to panels and shared UI"
```

---

## Task 6: 更新 Canvas 节点使用 Token 和动效

**Files:**
- Modify: `src/components/canvas/CardNode.tsx`
- Modify: `src/components/canvas/SectionNode.tsx`
- Modify: `src/components/canvas/MediaNode.tsx`
- Modify: `src/components/canvas/ConnectionEdge.tsx`

- [ ] **Step 1: 修改 CardNode.tsx**

将 CardNode 的 style 属性中的硬编码色值替换为 CSS Variable，并添加动效类：

```tsx
<div
  className="card-node-default card-node-hover relative rounded-2xl"
  style={{
    width: (data.width ?? DEFAULT_CARD_WIDTH) as number,
    height: (data.height ?? DEFAULT_CARD_HEIGHT) as number,
    backgroundColor: styles.cardBg,
    outline: `${outlineWidth}px solid ${outlineColor}`,
    outlineOffset: 0,
    boxShadow: isConnectingSource
      ? 'var(--shadow-glow-blue)'
      : isNearbyTarget
        ? 'var(--shadow-glow-green)'
      : isConnectionTarget && isHovered
        ? 'var(--shadow-glow-green)'
      : isHovered
        ? 'var(--shadow-lg)'
        : selected
          ? 'var(--shadow-glow-blue)'
          : 'var(--shadow-sm)',
    cursor: isEditing ? 'auto' : (isConnectionTarget || isNearbyTarget ? 'crosshair' : 'grab'),
  }}
  onMouseEnter={handleMouseEnter}
  onMouseLeave={handleMouseLeave}
  onClick={handleCardClick}
>
```

连接按钮也使用 token：
```tsx
<button
  className="absolute flex items-center justify-center rounded-full cursor-crosshair z-10 shadow-md btn-base"
  style={{
    top: -14,
    right: -14,
    width: 28,
    height: 28,
    backgroundColor: 'var(--color-blue-500)',
    color: 'var(--text-inverse)',
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1,
    border: '3px solid var(--color-white)',
    opacity: showConnectionIcon ? 1 : 0,
    pointerEvents: showConnectionIcon ? 'auto' : 'none',
  }}
>
```

- [ ] **Step 2: 修改 SectionNode.tsx**

```tsx
<div
  className="section-node rounded-xl border-2 border-dashed relative"
  style={{
    width: size.width,
    height: size.height,
    borderColor: selected ? 'var(--border-active)' : (color ?? 'var(--border-default)'),
    backgroundColor: selected ? 'var(--surface-card-hover)' : `${borderColor}10`,
    boxShadow: selected ? 'var(--shadow-glow-blue)' : 'none',
  }}
  onDoubleClick={handleDoubleClick}
>
```

- [ ] **Step 3: 修改 MediaNode.tsx**

```tsx
<div
  className="media-node relative overflow-hidden"
  style={{
    width: '100%',
    height: '100%',
    outline: selected ? '2px solid var(--border-active)' : '1px solid transparent',
    outlineOffset: 0,
    borderRadius: 'var(--radius-sm)',
    lineHeight: 0,
  }}
>
```

Loading 状态添加 pulse：
```tsx
<div
  className="loading-pulse flex items-center justify-center"
  style={{ width: '100%', height: '100%', minWidth: 60, minHeight: 60 }}
>
  <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)' }}>Loading...</span>
</div>
```

- [ ] **Step 4: 修改 ConnectionEdge.tsx**

```tsx
<BaseEdge
  path={edgePath}
  markerEnd={markerEnd}
  className="edge-default"
  style={{
    ...style,
    stroke: selected ? 'var(--border-active)' : 'var(--text-secondary)',
    strokeWidth: selected ? 3 : 2,
    strokeDasharray: selected ? '8,3' : '6,4',
    cursor: 'pointer',
  }}
/>
```

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/CardNode.tsx src/components/canvas/SectionNode.tsx src/components/canvas/MediaNode.tsx src/components/canvas/ConnectionEdge.tsx
git commit -m "feat(canvas): apply token-based styles and motion effects to nodes and edges"
```

---

## Task 7: 更新弹窗和列表组件

**Files:**
- Modify: `src/components/ui/CardEditDialog.tsx`
- Modify: `src/components/ui/SettingsDialog.tsx`
- Modify: `src/components/ui/TrashBinPanel.tsx`
- Modify: `src/components/ui/WorkspacePicker.tsx`
- Modify: `src/components/ui/BoardLibraryView.tsx`
- Modify: `src/components/ui/CardLibraryView.tsx`

- [ ] **Step 1: 修改 CardEditDialog.tsx**

Backdrop 和 content 使用 modal 动画类：
```tsx
<div
  className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center animate-fadeIn"
  style={{ backgroundColor: 'var(--surface-overlay)' }}
  onClick={onClose}
>
  <div
    className="modal-content animate-scaleIn w-[700px] h-[600px] max-h-[85vh] rounded-xl shadow-2xl flex flex-col"
    style={{ backgroundColor: 'var(--surface-panel)' }}
    onClick={(e) => e.stopPropagation()}
  >
```

按钮使用 token：
```tsx
<button
  onClick={() => { /* delete */ }}
  className="btn-base btn-danger flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
>
  <Trash2 size={14} />
  删除
</button>

<button
  onClick={onClose}
  className="btn-base p-2 rounded-lg"
  style={{ color: 'var(--text-secondary)' }}
>
  <X size={18} />
</button>
```

- [ ] **Step 2: 修改 SettingsDialog.tsx**

同样的 modal 动画类应用。主题切换按钮：
```tsx
<button
  onClick={() => setDarkMode(false)}
  className="btn-base flex-1 flex items-center justify-center gap-2 p-4 rounded-lg"
  style={{
    backgroundColor: !isDarkMode ? 'var(--text-primary)' : 'var(--surface-card)',
    color: !isDarkMode ? 'var(--surface-panel)' : 'var(--text-primary)',
    border: `1px solid var(--border-default)`,
  }}
>
```

- [ ] **Step 3: 修改 TrashBinPanel.tsx**

列表项使用 `list-item` class，按钮使用 `btn-base` / `btn-danger`。

- [ ] **Step 4: 修改 WorkspacePicker.tsx**

创建按钮和最近工作区列表项使用 `list-item` class 和 token。

- [ ] **Step 5: 修改 BoardLibraryView.tsx**

画板卡片使用 `list-item` class：
```tsx
<div
  key={board.id}
  onClick={() => handleBoardClick(board.id)}
  className="list-item group relative p-4 rounded-xl cursor-pointer"
  style={{
    backgroundColor: 'var(--surface-card)',
    border: `1px solid ${board.id === activeBoardId ? 'var(--border-active)' : 'var(--border-default)'}`,
  }}
>
```

- [ ] **Step 6: 修改 CardLibraryView.tsx**

卡片库项使用 `list-item` class：
```tsx
<div
  key={card.id}
  draggable
  onDragStart={(e) => handleDragStart(e, card.id)}
  onClick={() => setEditingCardId(card.id)}
  className="list-item group relative p-3 rounded-lg cursor-pointer active:cursor-grabbing"
  style={{
    aspectRatio: '1',
    backgroundColor: 'var(--surface-card)',
    border: `1px solid var(--border-default)`,
  }}
>
```

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/CardEditDialog.tsx src/components/ui/SettingsDialog.tsx src/components/ui/TrashBinPanel.tsx src/components/ui/WorkspacePicker.tsx src/components/ui/BoardLibraryView.tsx src/components/ui/CardLibraryView.tsx
git commit -m "feat(ui): apply token-based styles and motion effects to dialogs and list views"
```

---

## Task 8: 更新折叠面板按钮

**Files:**
- Modify: `src/components/ui/LeftPanelCollapsed.tsx`
- Modify: `src/components/ui/RightPanelCollapsed.tsx`

- [ ] **Step 1: 修改 LeftPanelCollapsed.tsx**

```tsx
<button
  onClick={() => setLeftPanelCollapsed(false)}
  className="btn-base fixed top-1/2 -translate-y-1/2 left-0 z-50 flex items-center justify-center w-6 h-10 rounded-r-lg shadow-lg hover:shadow-xl"
  style={{
    backgroundColor: 'var(--surface-panel)',
    color: 'var(--text-primary)',
    boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
  }}
>
  <ChevronRight size={14} />
</button>
```

- [ ] **Step 2: 修改 RightPanelCollapsed.tsx**

```tsx
<button
  onClick={() => setRightPanelCollapsed(false)}
  className="btn-base fixed top-1/2 -translate-y-1/2 right-0 z-50 flex items-center justify-center w-6 h-12 rounded-l-lg shadow-lg hover:shadow-xl"
  style={{
    backgroundColor: 'var(--surface-panel)',
    color: 'var(--text-primary)',
    border: `1px solid var(--border-default)`,
    borderRight: 'none',
  }}
>
  <ChevronLeft size={14} />
</button>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/LeftPanelCollapsed.tsx src/components/ui/RightPanelCollapsed.tsx
git commit -m "feat(ui): apply token styles and hover effects to collapsed panel buttons"
```

---

## Task 9: 更新 App.tsx 背景色

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 修改 App.tsx 根容器背景**

找到 App 组件的最外层 div，添加背景色 token：
```tsx
<div
  className="flex h-full w-full"
  style={{ backgroundColor: 'var(--surface-app)' }}
>
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): set app background using design token"
```

---

## Task 10: 清理旧文件（可选，建议验证后执行）

**Files:**
- Delete: `src/theme/panelSurface.ts`
- Delete: `src/theme/cardVariantStyles.ts`
- Modify: 所有引用旧文件的 import

> **注意：** 由于 `tokens.ts` 中已经提供了同名兼容函数 `getPanelSurface` 和 `getCardVariantStyles`，并且 `index.ts` 统一导出，建议先验证所有组件正常工作后再删除旧文件。

- [ ] **Step 1: 更新 import 路径**

将所有文件中的：
```typescript
import { getPanelSurface } from '../../theme/panelSurface'
import { getCardVariantStyles } from '../../theme/cardVariantStyles'
```

替换为：
```typescript
import { getPanelSurface, getCardVariantStyles } from '../../theme'
```

- [ ] **Step 2: 删除旧文件**

```bash
git rm src/theme/panelSurface.ts src/theme/cardVariantStyles.ts
```

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor(theme): remove legacy panelSurface and cardVariantStyles in favor of token system"
```

---

## Task 11: 验证与测试

- [ ] **Step 1: 启动开发服务器**

```bash
pnpm dev
```

- [ ] **Step 2: 视觉检查清单**

- [ ] Light 模式下所有面板背景色正确
- [ ] Dark 模式下所有面板背景色正确
- [ ] 主题切换后色值实时更新
- [ ] CardNode hover 时有阴影提升和轻微上移
- [ ] CardNode selected 时有蓝色 glow
- [ ] SectionNode hover 时边框变亮
- [ ] ConnectionEdge selected 时变粗且变蓝
- [ ] 按钮 hover/active 有 scale 效果
- [ ] 输入框 focus 有 ring 光环
- [ ] 弹窗出现时有 scaleIn 动画
- [ ] 列表项 hover 有轻微右移和阴影
- [ ] MediaNode loading 时有 pulse 动画
- [ ] 折叠按钮 hover 有 shadow 提升

- [ ] **Step 3: 运行 lint/typecheck（如有）**

```bash
pnpm lint
pnpm typecheck
```

---

## Spec Coverage Checklist

| Spec 要求 | 对应 Task |
|-----------|----------|
| CSS 自定义属性 Token 体系 | Task 1 |
| Light + Dark 主题 | Task 1 |
| 圆角、色彩、字重、字号、字色、阴影 Token | Task 1 |
| 贝塞尔动画曲线 | Task 1 (Motion tokens) |
| 全局动画关键帧 | Task 2 |
| hover 状态 | Task 5, 6, 7, 8 |
| select 状态 | Task 5, 6, 7 |
| active/click 状态 | Task 5, 6, 7 |
| focus 状态 | Task 5 |
| disabled 状态 | Task 2 (utility class) |
| forbidden 状态 | Task 2, 6 |
| CardNode 状态 | Task 6 |
| SectionNode 状态 | Task 6 |
| ConnectionEdge 状态 | Task 6 |
| MediaNode 状态 | Task 6 |
| 面板状态 | Task 5 |
| 按钮状态 | Task 5 |
| 输入框状态 | Task 5 |
| 弹窗状态 | Task 7 |
| 列表项状态 | Task 7 |
| TS 兼容层 | Task 3 |
