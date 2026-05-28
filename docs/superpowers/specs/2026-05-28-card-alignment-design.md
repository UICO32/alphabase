# Card Alignment Feature Design

## Overview

选中 2+ 张卡片时，在选中区域的包围盒上方浮现对齐工具条，提供 8 个对齐操作。

## Trigger

- **条件**：选中 2+ 张卡片（type === 'card' 或 type === 'media'）
- **显示**：浮动工具条出现在选中区域包围盒上方居中
- **隐藏**：选中数量 < 2 时消失；点击空白区域取消选中后消失

## Floating Toolbar Position

- 默认位置：选中卡片包围盒上方居中，距包围盒顶部 8px
- 边界处理：包围盒顶部距屏幕上边缘 < 48px 时，工具条移到包围盒下方
- 工具条坐标使用屏幕像素（fixed positioning），需要根据 React Flow viewport zoom 和 offset 计算

计算方式：
1. 收集所有选中节点的 position + width/height，算出包围盒的 flow 坐标 (minX, minY, maxX, maxY)
2. 用 reactFlowInstance.flowToScreenPosition() 转换包围盒的四个角到屏幕坐标
3. 工具条水平居中 = 屏幕包围盒水平中点
4. 工具条垂直位置 = 屏幕包围盒 top - 8px（或 bottom + 8px 边界情况）

## Toolbar Content

一行 8 个图标按钮，分两组：

**对齐组（6 个）**：
| 操作 | 图标 | 逻辑 |
|------|------|------|
| 左对齐 | AlignStartHorizontal | 所有卡片 x = min(x) |
| 水平居中 | AlignCenterHorizontal | 所有卡片 x = (minX + maxX) / 2 - cardWidth / 2 |
| 右对齐 | AlignEndHorizontal | 所有卡片 x = max(x + width) - cardWidth |
| 上对齐 | AlignStartVertical | 所有卡片 y = min(y) |
| 垂直居中 | AlignCenterVertical | 所有卡片 y = (minY + maxY) / 2 - cardHeight / 2 |
| 下对齐 | AlignEndVertical | 所有卡片 y = max(y + height) - cardHeight |

**分布组（2 个）**：
| 操作 | 图标 | 逻辑 |
|------|------|------|
| 水平等间距 | AlignSpaceHorizontally | 在 minX 和 maxX+width 之间均匀分布卡片中心点 |
| 垂直等间距 | AlignSpaceVertically | 在 minY 和 maxY+height 之间均匀分布卡片中心点 |

两组之间用细分隔线隔开。

分布逻辑详细说明：
- 水平等间距：保持最左卡片不动、最右卡片不动，中间卡片在水平方向等间距分布
- 垂直等间距：保持最上卡片不动、最下卡片不动，中间卡片在垂直方向等间距分布
- 仅在选中 3+ 张卡片时分布按钮可点击，2 张时显示为 disabled

## Alignment Algorithm

所有对齐以选中卡片包围盒为参考，不改变包围盒的整体位置：

```
boundingBox = {
  minX: min(node.position.x),
  minY: min(node.position.y),
  maxX: max(node.position.x + nodeWidth),
  maxY: max(node.position.y + nodeHeight)
}

// 左对齐
node.position.x = boundingBox.minX

// 水平居中
node.position.x = (boundingBox.minX + boundingBox.maxX) / 2 - nodeWidth / 2

// 右对齐
node.position.x = boundingBox.maxX - nodeWidth

// 上对齐
node.position.y = boundingBox.minY

// 垂直居中
node.position.y = (boundingBox.minY + boundingBox.maxY) / 2 - nodeHeight / 2

// 下对齐
node.position.y = boundingBox.maxY - nodeHeight

// 水平等间距（3+ nodes）
totalSpace = boundingBox.maxX - boundingBox.minX
totalCardWidth = sum(nodeWidths)
gap = (totalSpace - totalCardWidth) / (nodeCount - 1)
// 按原 x 顺序排列，从 minX 开始依次放置

// 垂直等间距（3+ nodes）
同理，按原 y 顺序排列
```

## Undo/Redo Support

对齐操作前调用 snapshotNow()，对齐后调用 recordCurrentState()，确保支持 undo/redo。

## Component Architecture

新增组件：
1. `src/components/canvas/AlignmentToolbar.tsx` — 浮动对齐工具条 UI
2. `src/utils/alignment.ts` — 对齐计算纯函数

修改组件：
- `src/components/canvas/ReactFlowCanvas.tsx` — 集成 AlignmentToolbar，传入选中节点信息和 reactFlowInstance

AlignmentToolbar 接口：
```ts
interface AlignmentToolbarProps {
  selectedNodes: Node[]    // 选中且可对齐的节点列表
  reactFlowInstance: ReactFlowInstance
  onAlign: (updates: Map<string, { x: number; y: number }>) => void
  snapshotNow: () => void
  recordCurrentState: () => void
}
```

onAlign 回调在 ReactFlowCanvas 中实现，调用 setNodes 更新节点位置。

## Edge Cases

1. 选中 1 张卡片或 0 张 → 不显示工具条
2. 选中 2 张卡片 → 分布按钮禁用（disabled 样式 + title 提示"需要至少 3 张卡片"）
3. 卡片在 Frame 内选中 → 仍可对齐（对齐基于 flow 坐标，不受 Frame 限制）
4. 选中包含 Frame 节点 → 排除 Frame，只对齐 card/media 节点
5. 所有卡片尺寸相同 → 等间距分布退化为等间距排列中心点
6. 视口缩放 → 工具条位置随缩放实时更新

## Performance

- 工具条位置计算：选中节点变化或 viewport 变化时重新计算，用 useMemo 缓存
- 对齐操作本身：纯数学计算，O(n) 遍历选中节点，无需担心性能