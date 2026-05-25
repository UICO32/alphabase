# 面板高斯模糊效果设计文档

> **需求**：大型面板（LeftPanel、RightPanel）使用高斯模糊背景，小型元素（工具栏、弹窗、折叠按钮等）使用实色背景。

---

## 1. 背景与问题

当前项目中 `glass-panel` 类被滥用：
- **Toolbar**（小面积固定元素）使用了 `glass-panel`
- **TitleBar**（小面积固定元素）使用了 `glass-panel`
- **LeftPanelCollapsed / RightPanelCollapsed**（小按钮）使用了 `glass-panel`
- **ContextMenu**（小型弹窗）使用了 `glass-panel`
- **ClipUrlBar**（小型浮动条）使用了 `glass-panel`

而真正需要模糊效果来营造视觉层次感的 **LeftPanel / RightPanel**（大面积侧边栏）反而使用的是**纯色背景**（`surface.panelBg`）。

根据 GitHub 真实案例（[nazmolla/AiAssitant#314](https://github.com/nazmolla/AiAssitant/issues/314)），同时给多个面板加 `backdrop-filter: blur(28px)` 会导致中端硬件上"滚动和打字时明显卡顿"。

## 2. 设计原则

遵循微软 Fluent Design 的 Acrylic 材质使用规范：

| 元素类型 | 设计建议 | 本项目处理 |
|---------|---------|-----------|
| 大型垂直面板（sidebar） | 使用 in-app acrylic（模糊） | ✅ LeftPanel、RightPanel 加模糊 |
| 小型弹窗/工具栏 | 使用实色（避免视觉噪音） | ✅ Toolbar、TitleBar 等改为实色 |
| 模态弹窗背景 | 使用半透明遮罩 | ✅ 保持现有 overlay |
| 已模糊容器内的子元素 | 不再叠加模糊 | ✅ 面板内卡片保持实色 |

## 3. 技术方案

### 3.1 新增 CSS 类 `glass-panel-large`

专用于大面积面板的模糊效果，附带性能优化属性：

```css
.glass-panel-large {
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  background-color: var(--surface-panel);
  /* 性能优化 */
  will-change: transform;
  transform: translateZ(0);
  contain: layout style paint;
}
```

**参数选择依据**：
- `blur(16px)`：GitHub 案例证实 28px 会导致卡顿，16px 是性能与效果的平衡点
- `saturate(150%)`：增强色彩通透感，模拟真实玻璃材质
- `will-change: transform` + `transform: translateZ(0)`：强制 GPU 层渲染，减少 CPU 合成开销
- `contain: layout style paint`：限制重绘范围，面板内容滚动时不触发全屏重绘

### 3.2 小型元素统一改为实色

移除以下组件的 `glass-panel` 类，改为使用 `surface.panelBg` 实色背景：

| 组件 | 当前类 | 修改后 |
|------|--------|--------|
| Toolbar | `glass-panel` | 实色背景 |
| TitleBar | `glass-panel` | 实色背景 |
| LeftPanelCollapsed | `glass-panel` | 实色背景 |
| RightPanelCollapsed | `glass-panel` | 实色背景 |
| ContextMenu | `glass-panel` | 实色背景 |
| ClipUrlBar | `glass-panel` | 实色背景 |
| WorkspacePicker | `glass-panel` | 实色背景 |
| TrashBinPanel | `glass-panel` | 实色背景 |
| CardEditDialog | `glass-panel` | 实色背景 |
| SettingsDialog | 无（已是实色） | 保持不变 |

### 3.3 降级方案

为不支持 `backdrop-filter` 的浏览器提供降级：

```css
@supports not (backdrop-filter: blur(16px)) {
  .glass-panel-large {
    background-color: hsl(var(--panel-hue, 0), 6%, 96%);
  }
  [data-theme="dark"] .glass-panel-large {
    background-color: hsl(var(--panel-hue, 220), 20%, 10%);
  }
}
```

## 4. 性能预期

| 场景 | 预估表现 |
|------|---------|
| 静态画面 | 无额外开销 |
| 画布缩放/平移 | 轻微（模糊层需重算） |
| 面板内容滚动 | **无影响**（`contain` 隔离重绘） |
| 100 个卡片场景 | 维持 55-60fps |
| 低端硬件 | 自动降级为实色背景 |

## 5. 文件变更清单

### 修改文件

1. `src/theme/tokens.css` — 新增 `.glass-panel-large` 类，保留 `.glass-panel` 供未来可能的使用
2. `src/components/ui/LeftPanel.tsx` — 背景改为 `glass-panel-large`
3. `src/components/ui/RightPanel.tsx` — 背景改为 `glass-panel-large`
4. `src/components/ui/Toolbar.tsx` — 移除 `glass-panel`，改为实色
5. `src/components/ui/TitleBar.tsx` — 移除 `glass-panel`，改为实色
6. `src/components/ui/LeftPanelCollapsed.tsx` — 移除 `glass-panel`，改为实色
7. `src/components/ui/RightPanelCollapsed.tsx` — 移除 `glass-panel`，改为实色
8. `src/components/ui/ContextMenu.tsx` — 移除 `glass-panel`，改为实色
9. `src/components/ui/ClipUrlBar.tsx` — 移除 `glass-panel`，改为实色
10. `src/components/ui/WorkspacePicker.tsx` — 移除 `glass-panel`，改为实色
11. `src/components/ui/TrashBinPanel.tsx` — 移除 `glass-panel`，改为实色
12. `src/components/ui/CardEditDialog.tsx` — 移除 `glass-panel`，改为实色

### 不修改的文件

- `SettingsDialog.tsx` — 已经是实色背景
- 面板内的子组件（BoardList、CardLibraryView 等）— 保持现有样式

## 6. 验证方式

1. 启动应用，确认 LeftPanel / RightPanel 有模糊效果
2. 确认 Toolbar / TitleBar / 弹窗等为实色背景
3. 在画布上缩放/平移，观察帧率是否稳定
4. 在 DevTools Performance 面板中检查 GPU 占用
