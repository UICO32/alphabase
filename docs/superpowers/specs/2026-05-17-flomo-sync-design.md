# Flomo 同步一期设计

## 概述

将 flomo（浮墨笔记）中的 memo 单向导入到卡片库。用户手动触发同步，增量拉取 flomo memo，转为 BlockNote 卡片写入工作区。

## 用户决策

| 决策项 | 选择 |
|--------|------|
| 同步方向 | 单向：flomo → 卡片库 |
| 触发方式 | 手动点击同步图标 |
| 标签处理 | flomo 标签 → 卡片 tags 字段 |
| 过滤范围 | 全部导入，不过滤 |
| 图片处理 | 下载到 workspace/assets/flomo/ |
| 重复处理 | 增量跳过已导入 memo（by slug） |

## 架构

### 数据流

```
用户点击同步图标
  → FlomoSyncService.sync()
  → IPC: flomo:login (首次) / flomo:fetchMemos
  → Electron Main (HTTP 请求 flomo API)
  → 返回 memo 列表
  → 过滤已导入 memo (by slug)
  → HTML → BlockNote blocks 转换 (flomoConverter)
  → 图片: IPC: flomo:downloadImg → workspace/assets/flomo/
  → cardStore.importCards() → syncEngine 自动落盘
  → 记录已导入 slug + lastSyncTime
```

### Electron 主进程代理

渲染进程不直接访问 flomo API（CORS 限制 + 密钥安全），所有 HTTP 请求通过 IPC 转发到主进程执行。

新增 IPC 通道：

| 通道 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `flomo:login` | `{ email, password }` | `{ accessToken }` | 登录获取 token |
| `flomo:fetchMemos` | `{ accessToken, lastSyncTime }` | `{ memos: FlomoMemo[] }` | 增量拉取 memo |
| `flomo:downloadImg` | `{ url, destPath }` | `{ success: boolean }` | 下载图片到本地 |

### flomo API 接口

| 接口 | 方法 | 用途 |
|------|------|------|
| `https://flomoapp.com/api/v1/user/login_by_email` | POST | 邮箱/密码登录 |
| `https://flomoapp.com/api/v1/memo/updated` | GET | 增量获取 memo |

签名算法：参数按 key 字母序排列 → `key=value&` 拼接 → 末尾加密钥 `dbbc3dd73364b4084c3a69346e0ce2b2` → MD5。

Token 失效检测：API 返回 `code == -10` 时自动重连。

## 核心组件

### FlomoSyncService (`src/utils/flomoSync.ts`)

渲染进程侧同步服务，职责：
- 管理同步状态（syncing 锁、进度）
- 调用 IPC 通道与主进程通信
- 过滤已导入 memo
- 调用 flomoConverter 转换内容
- 调用 cardStore.importCards 写入卡片
- 持久化同步元数据（lastSyncTime、importedSlugs）

### FlomoConverter (`src/utils/flomoConverter.ts`)

HTML → BlockNote blocks 转换器：
1. `turndown` 将 HTML 转 Markdown
2. 解析 Markdown 为 BlockNote block 数组
3. 处理图片路径替换（指向本地 assets/flomo/）
4. 处理标签格式（flomo `#标签` → tags 数组）

支持的 BlockNote block 类型：paragraph、heading、bulletListItem、numberedListItem、quote、codeBlock、image。

### 同步状态持久化

存储在工作区目录下 `flomo-sync.json`：

```json
{
  "lastSyncTime": "2026-05-17T14:30:00+08:00",
  "importedSlugs": ["abc123", "def456"],
  "accessToken": "xxx"
}
```

每个工作区独立的同步状态，切换工作区时互不影响。

## UI 变更

### 设置页分栏重构

当前设置页是单列布局，重构为左右分栏：
- 左侧导航：系统设置 / 同步设置 / 导入导出
- 右侧内容区：显示选中分类的内容

同步设置区块包含：
- Flomo 邮箱输入框
- Flomo 密码输入框
- 同步状态信息（上次同步时间、已导入数量）
- 登录/断开按钮

### 卡片库同步入口

在两个位置添加同步图标按钮（RefreshCw 图标）：
- 左面板 CardLibraryView 标题栏右侧
- 右侧面板卡片库标题栏右侧

点击触发 `FlomoSyncService.sync()`，同步中图标旋转，完成后显示 toast 提示。

## 错误处理

| 场景 | 处理 |
|------|------|
| 登录失败 | 提示"邮箱或密码错误" |
| Token 过期 | 自动重连（code == -10） |
| 网络错误 | 提示"网络连接失败，请稍后重试" |
| 同步进行中 | 图标旋转状态，禁止重复触发 |
| 无新 memo | 提示"没有新的 flomo 内容" |

## 新增/修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/utils/flomoSync.ts` | 新增 | 同步服务 |
| `src/utils/flomoConverter.ts` | 新增 | HTML → BlockNote 转换 |
| `electron/main.ts` | 修改 | 新增 flomo IPC 通道 |
| `electron/preload.ts` | 修改 | 暴露 electronAPI.flomo |
| `src/components/ui/SettingsDialog.tsx` | 修改 | 分栏重构 + 同步设置 |
| `src/components/ui/CardLibraryView.tsx` | 修改 | 添加同步图标 |
| `src/components/ui/LeftPanel.tsx` | 修改 | 添加同步图标 |

## 依赖

- `ts-md5` — flomo API 签名
- `turndown` — HTML → Markdown 转换
- `moment` — 时间格式化（项目已有）

## 不在范围内

- 反向同步（卡片 → flomo）
- 定时自动同步
- 标签过滤导入
- flomo memo 删除同步
