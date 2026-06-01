# P0/P1 测试补充设计

## 目标

为项目核心模块补充单元测试，覆盖数据层 Store CRUD + 持久化写入、纯函数边界值。

## 测试分层

| 优先级 | 层级 | 模块 | 测试文件 |
|--------|------|------|---------|
| P0 | 数据层 | cardStore | `src/stores/cardStore.test.ts` |
| P0 | 数据层 | boardStore | `src/stores/boardStore.test.ts` |
| P0 | 数据层 | trashStore | `src/stores/trashStore.test.ts` |
| P0 | 数据层 | syncEngine（补全） | `src/sync/syncEngine.test.ts` |
| P1 | 纯函数 | geometry | `src/utils/geometry.test.ts` |
| P1 | 纯函数 | cardStyles | `src/utils/cardStyles.test.ts` |
| P1 | 纯函数 | fileUtils | `src/utils/fileUtils.test.ts` |

## P0 — 数据层测试

### cardStore.test.ts

Store 是 Zustand 内存状态，测试状态转换逻辑。syncEngine 的 flushActiveSyncEngine 调用需 mock。

**场景：**
- 添加卡片 → cards 中存在
- 更新卡片属性 → updatedAt 变化
- 更新 content → previewHTML 被清空
- 软删除 → deletedAt 有值，卡片仍在 cards 中
- 恢复卡片 → deletedAt 被移除
- 硬删除 → cards 中不存在
- importCards → 合并到现有 cards
- loadCardsFromDB → isLoaded 变 true，重复调用不覆盖
- undo/redo 内容历史

### boardStore.test.ts

**场景：**
- setBoards → boards 被设置，isLoaded 变 true
- addBoard → boards 数组追加
- updateBoard → 指定 board 属性更新
- deleteBoard → boards 移除 + boardData 清除 + activeBoardId 重置
- setActiveBoard → activeBoardId 切换
- saveBoardData / getBoardData → boardData 存取

### trashStore.test.ts

**场景：**
- addItem → 自动填充 deletedAt 和 expiresAt（30天后）
- removeItem → 从 items 中移除
- restoreItem → 返回 item 并从 items 中移除
- restoreItem 不存在 → 返回 undefined
- clearExpired → 过期项被清除，未过期项保留

### syncEngine.test.ts（补全现有）

现有测试只覆盖了拖拽抑制，需补充：

**场景：**
- scheduleWriteCard → 防抖后调用 writeFile + rename（原子写入）
- scheduleDeleteCard → 防抖后调用 deleteFile
- flushAll → 立即写入所有 pending
- stop → 调用 flushAll
- 重复 scheduleWrite → 后者覆盖前者（防抖合并）
- isDragging 时 board 不写，card 仍写

## P1 — 纯函数测试

### geometry.test.ts

**edgePointOnRect：**
- 目标在右侧 → 返回右边缘中点
- 目标在下方 → 返回下边缘中点
- 目标在左上 → 返回左边缘中点
- 目标在正上方 → 返回上边缘中点

**getBestHandles：**
- 目标在右下 → source=right, target=left-target
- 目标在左上 → source=left, target=right-target
- 目标在正下方 → source=bottom, target=top-target
- 目标在正上方 → source=top, target=bottom-target

**positionToHandleId：**
- Top/Bottom/Left/Right 四种映射

### cardStyles.test.ts

**getCardFill：**
- 10 种颜色 × 亮/暗模式 = 20 组
- undefined → 默认白色

**getCardStroke：**
- 10 种颜色各返回对应 stroke
- undefined → 默认白色 stroke

**getCardTextColor / getCardMutedTextColor：**
- 亮/暗模式各返回正确颜色
- white/undefined 的 muted 特殊处理

### fileUtils.test.ts

**generateId：**
- 默认前缀 'id-' 开头
- 自定义前缀
- 格式：`{prefix}-{timestamp}-{6位随机}`

**fileToDataUrl：**
- 非 image 文件 → 直接 readAsDataUrl
- SVG/GIF → 不压缩
- 小于 300KB → 不压缩
- 大图片 → 压缩到 1600px 宽度内

## Mock 策略

- Store 测试：mock `flushActiveSyncEngine`（syncEngineRef），避免真实文件写入
- syncEngine 测试：mock `../utils/workspace/fs` 的所有方法，用 vi.fn() 记录调用
- 纯函数：无需 mock
- fileUtils.fileToDataUrl：mock Image/FileReader/Canvas（浏览器 API），或仅测 generateId

## 运行命令

```bash
pnpm test:unit              # 跑所有单元测试
pnpm test:unit:watch        # 监听模式
pnpm test:unit -- --reporter=verbose  # 详细输出
```
