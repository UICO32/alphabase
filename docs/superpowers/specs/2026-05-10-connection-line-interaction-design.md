# 连接线交互改造设计文档

**日期**: 2026-05-10
**状态**: 待实现
**关联**: React Flow 画布 v2 迁移项目

---

## 需求概述

改造当前连接线的创建方式，实现更直观的拖拽连线体验：

1. 卡片顶部中央放置连接图标，hover 时显示，点击后拖出连线
2. 拖线过程中虚线跟随鼠标，末端带箭头，靠近目标卡片时自动吸附到最近连接点并变实线
3. 卡片移动时，已存在的连接线自动跟随更新

---

## 架构设计

### 整体方案

采用 **React Flow 内置机制 + 自定义 ConnectionLine** 方案：

- 利用 React Flow 的 `connectionLineComponent` 自定义拖线样式
- 在 CardNode 顶部放置自定义 source Handle 作为连接触发点
- 保留现有的 connectionMediator 状态管理
- 复用 React Flow 内置的节点移动时连线自动更新能力

### 核心组件关系

```
ReactFlowCanvas
  ├── connectionLineComponent → CustomConnectionLine (新增)
  ├── nodeTypes
  │   └── card → CardNode (改造)
  │       └── ConnectionIcon (新增)
  └── edgeTypes
      └── connection → ConnectionEdge (保持)
```

---

## 组件设计

### 1. ConnectionIcon（连接图标）

**位置**: CardNode 顶部中央，边缘上方 8px

**样式**:
- 16x16 圆形按钮
- 蓝色背景 (#3b82f6)，白色 + 号
- 默认 opacity: 0，hover 卡片时 opacity: 1
- transition: opacity 150ms

**交互**:
- 本质是一个 source Handle，id 为 `connection-icon-source`
- 通过 CSS 隐藏 React Flow 默认的 Handle 圆点
- 自定义 div 作为视觉图标，覆盖在 Handle 上方
- 点击并拖拽时触发 React Flow 内置连线流程

**技术实现**:
```tsx
<Handle
  type="source"
  position={Position.Top}
  id="connection-icon-source"
  className="!opacity-0 !pointer-events-auto"
  style={{ top: -8, left: '50%', transform: 'translateX(-50%)' }}
/>
<div
  className="absolute w-4 h-4 rounded-full bg-blue-500 
            flex items-center justify-center text-white text-xs
            opacity-0 transition-opacity duration-150
            group-hover:opacity-100 cursor-crosshair"
  style={{ top: -8, left: '50%', transform: 'translateX(-50%)' }}
>
  +
</div>
```

### 2. CustomConnectionLine（自定义拖线）

**用途**: 替代 React Flow 默认拖线样式

**Props 接口**:
```tsx
interface CustomConnectionLineProps {
  fromX: number
  fromY: number
  fromPosition: Position
  toX: number
  toY: number
  toPosition: Position
  fromNode?: Node
  fromHandle?: Handle
}
```

**样式状态**:
- **拖线中（未靠近目标）**: 灰色虚线 `stroke: '#94a3b8'`, `strokeDasharray: '6,4'`, `strokeWidth: 2`
- **靠近目标（吸附中）**: 蓝色实线 `stroke: '#3b82f6'`, `strokeWidth: 3`

**吸附检测逻辑**:
- React Flow 的 `connectionLineComponent` 不直接提供目标节点信息
- 通过 `toX/toY` 坐标判断：当鼠标靠近画布上其他节点区域时（距离节点边界 50px 内），判定为"靠近目标"
- 在 `ReactFlowCanvas` 层通过 ref 保存当前所有节点位置，供 `CustomConnectionLine` 查询
- 靠近目标时，拖线样式从虚线切换为实线

**箭头实现**:
- 使用 SVG `<defs>` + `<marker>` 定义箭头
- 箭头颜色跟随当前拖线状态（灰色/蓝色）

### 3. CardNode 改造

**变更点**:
- 四角 Handle 保留但默认隐藏，仅在 hover 时显示
  - 用途：已有连线的 reconnect 目标吸附、拖线过程中的自动吸附检测
  - 不用于发起新连接（发起连接仅通过 ConnectionIcon）
- 新增 ConnectionIcon 作为唯一的连线触发入口
  - 本质是一个 source Handle + 自定义视觉图标
  - hover 卡片时显示

---

## 数据流

### 发起新连接

```
用户 hover 卡片 → ConnectionIcon 显示
  → 用户点击 ConnectionIcon 并拖拽
    → React Flow 内置连线流程启动
      → connectionLineComponent 渲染自定义拖线
        → 鼠标移动，拖线跟随
          → 靠近目标卡片 → connectionStatus 变化 → 拖线变实线
            → 释放鼠标到目标 Handle → onConnect 触发
              → connectionMediator.complete() → 创建 Edge
```

### 卡片移动时连线更新

```
用户拖拽卡片移动
  → React Flow 自动更新节点 position
    → 已连接的 Edge 自动重新计算路径
      → ConnectionEdge 组件重新渲染
        → 无需额外代码，React Flow 内置支持
```

---

## 状态管理

### 复用现有

- `connectionMediator`: 保持现有接口不变
- `useCardStore`: 卡片数据管理不变
- `useNodesState` / `useEdgesState`: React Flow 状态管理不变

### 新增状态

无需新增全局状态，所有拖线状态由 React Flow 内部管理。

---

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/components/canvas/CardNode.tsx` | 修改 | 添加 ConnectionIcon，调整 Handle 逻辑 |
| `src/components/canvas/CustomConnectionLine.tsx` | 新增 | 自定义拖线组件 |
| `src/components/canvas/ReactFlowCanvas.tsx` | 修改 | 注册 connectionLineComponent |
| `src/components/canvas/ConnectionEdge.tsx` | 保持 | 已存在连线样式，无需改动 |

---

## 边界情况处理

### 1. 拖线过程中点击空白区域
- React Flow 自动取消连线
- 拖线消失，connectionMediator 状态清空

### 2. 拖线到同一卡片
- `isValidConnection` 回调阻止自连接
- 拖线显示为无效状态（红色虚线）

### 3. 靠近目标的判定阈值
- 距离目标卡片边界 50px 内触发吸附
- 吸附到距离鼠标坐标最近的那个 Handle（上/下/左/右自动选择）

### 4. 快速连续创建连接
- React Flow 内置防抖
- 每次连接完成后需重新点击 ConnectionIcon 发起

### 5. 卡片被删除时
- 关联的 Edge 自动清理（React Flow 行为）
- 需在业务层同步清理数据

---

## 验证标准

- [ ] hover 卡片时顶部中央显示 + 图标
- [ ] 点击 + 图标可拖出虚线
- [ ] 拖线跟随鼠标移动，末端带箭头
- [ ] 靠近目标卡片时虚线变实线，自动吸附到最近连接点
- [ ] 释放鼠标到有效目标后创建连接线
- [ ] 拖拽卡片移动时，已存在的连接线自动跟随更新
- [ ] 点击空白区域取消连线
- [ ] 无法创建自连接
