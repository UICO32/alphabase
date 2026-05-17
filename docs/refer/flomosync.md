# Flomo Sync 核心原理与逻辑分析

## 一、项目概述

`plugin-flomo-sync` 是一个**思源笔记（SiYuan）插件**，用于将 [flomo](https://flomoapp.com/)（浮墨笔记）中的 memo 同步到思源笔记中。插件以思源 Plugin API 为基础，通过调用 flomo 官方 Web API 拉取数据，经格式转换后写入思源笔记。

### 核心技术栈

| 技术 | 用途 |
|---|---|
| `siyuan` Plugin API | 思源插件开发框架 |
| `ts-md5` | 生成 flomo API 签名 |
| `turndown` | HTML → Markdown 转换 |
| `moment` | 时间格式化处理 |
| `fetch` (浏览器原生) | HTTP 请求 |

---

## 二、整体同步流程

```
┌─────────────┐    ┌──────────────┐    ┌───────────────┐    ┌──────────────┐    ┌──────────────┐
│  用户点击     │───▶│  登录/校验    │───▶│  拉取 flomo   │───▶│  处理内容     │───▶│  写入思源     │
│  顶栏按钮     │    │  accessToken │    │  增量 memo    │    │  Markdown    │    │  daily note  │
└─────────────┘    └──────────────┘    └───────────────┘    └──────────────┘    └──────────────┘
                                                                                        │
                                                                    ┌───────────────────┘
                                                                    ▼
                                                          ┌──────────────┐    ┌──────────────┐
                                                          │  回写标签     │───▶│  记录同步时间  │
                                                          │  到 flomo    │    │  更新配置     │
                                                          └──────────────┘    └──────────────┘
```

### 流程详解

1. **触发同步**：用户点击顶栏 flomo 图标，或思源同步完成事件 `sync-end` 触发
2. **初始化配置**：加载存储的配置数据（accessToken、上次同步时间等）
3. **拉取增量数据**：以 `lastSyncTime` 为起点，分页调用 flomo API 获取新增/更新的 memo
4. **过滤数据**：排除已删除的、已标记同步的 memo，按标签策略（包含/排除）过滤
5. **格式转换**：将 flomo 的 HTML 内容转为 Markdown，处理图片引用路径
6. **下载图片**：将 flomo 图片下载到思源的 `assets/flomo/` 目录
7. **写入思源**：将 Markdown 内容追加到目标文档（daily note 或指定文档）
8. **回写标签**：在 flomo 原始 memo 上添加同步成功标签（可选）
9. **更新同步时间**：将当前时间记录为 `lastSyncTime`，供下次增量同步使用

---

## 三、核心原理

### 3.1 增量同步机制

插件采用**基于时间戳的增量同步**策略，核心参数为 `lastSyncTime`：

```typescript
let lastSyncTime = this.data[STORAGE_NAME]["lastSyncTime"]
let latest_updated = moment(lastSyncTime, 'YYYY-MM-DD HH:mm:ss').toDate()
  || moment(today, 'YYYY-MM-DD 00:00:00').toDate()
```

- 首次同步默认从**当天 00:00:00** 开始
- 每次同步完成后，将当前时间写入 `lastSyncTime`
- 下次同步时，仅拉取 `lastSyncTime` 之后更新的 memo

### 3.2 分页拉取

flomo API 每次最多返回 200 条记录，通过 `latest_slug` + `latest_updated_at` 实现分页：

```typescript
const LIMIT = "200";
while (true) {
  let param = {
    api_key: "flomo_web",
    app_version: "2.0",
    latest_slug: latest_slug,           // 上一页最后一条的 slug
    latest_updated_at: latest_updated_at_timestamp,  // 上一页最后一条的更新时间
    limit: LIMIT,
    timestamp: ts,
    tz: "8:0",
    webp: "1"
  }
  // ... 请求 API
  let records = data["data"];
  let noMore = records.length < LIMIT;  // 不足 200 条说明没有更多
  if (records.length == 0) break;
  latest_updated = moment(records[records.length - 1]["updated_at"]).toDate();
  latest_slug = records[records.length - 1]["slug"];
  if (noMore) break;
}
```

### 3.3 API 签名算法

flomo Web API 使用 MD5 签名进行请求验证，签名逻辑如下：

```typescript
createSign2(param) {
  const SECRET = 'dbbc3dd73364b4084c3a69346e0ce2b2'
  // 1. 按 key 字母序排列参数
  const sortParam = {};
  Object.keys(param).sort().forEach(function(key) {
    sortParam[key] = param[key];
  });

  // 2. 拼接参数字符串
  let paramString = ''
  for (let key in sortParam) {
    let value = sortParam[key]
    if (typeof value === 'undefined' || (!value && value !== 0)) continue
    if (Array.isArray(value)) {
      value.sort(function (a, b) {
        return a && b ? a.toString().localeCompare(b.toString()) : 0
      })
      for (let index in value) {
        paramString += key + '[]=' + value[index] + '&'
      }
    } else {
      paramString += key + '=' + value + '&'
    }
  }
  paramString = paramString.substring(0, paramString.length - 1)

  // 3. 拼接密钥后取 MD5
  let sign = new Md5().appendStr(paramString + SECRET).end();
  return sign
}
```

**签名步骤**：
1. 将所有请求参数按 key 字母序排列
2. 按 `key=value&` 格式拼接（数组参数用 `key[]=value` 格式）
3. 去掉末尾多余的 `&`
4. 在末尾拼接固定密钥 `dbbc3dd73364b4084c3a69346e0ce2b2`
5. 对整个字符串取 MD5 哈希

### 3.4 登录与认证

使用邮箱/密码登录获取 `accessToken`，后续请求通过 `Authorization: Bearer <token>` 鉴权：

```typescript
async connect() {
  let url = "https://flomoapp.com/api/v1/user/login_by_email"
  let data = {
    api_key: "flomo_web",
    app_version: "2.0",
    email: config.username,
    password: config.password,
    timestamp: timestamp,
    webp: "1",
  }
  data["sign"] = this.createSign2(data);

  let response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${this.data[STORAGE_NAME]["accessToken"]}`,
      'Content-Type': 'application/json',
      'User-Agent': USG
    },
    body: JSON.stringify(data)
  })

  const resData = await response.json();
  if (resData.code === 0) {
    this.data[STORAGE_NAME]["accessToken"] = resData.data["access_token"];
    await this.saveData(STORAGE_NAME, this.data[STORAGE_NAME]);
  }
}
```

**Token 失效自动重连**：当 API 返回 `code == -10` 时，自动重新调用 `connect()` 刷新 token：

```typescript
async check_authorization_and_reconnect(resData) {
  if (resData.code == -10) {
    await this.connect();
    await this.pushErrMsg(`正重新登录，请重新再试`);
    return false;
  }
  return resData.code == 0;
}
```

---

## 四、数据处理逻辑

### 4.1 标签过滤

支持两种标签过滤模式：

| 模式 | 值 | 行为 |
|---|---|---|
| 排除标签 | `syncTagMode = "0"` | 排除包含指定标签的 memo（默认） |
| 包含标签 | `syncTagMode = "1"` | 仅同步包含指定标签的 memo |

```typescript
if (syncTagMode === "0") {
  // 排除模式：memo 的标签中不能包含任何排除标签
  allRecords = allRecords.filter(record => {
    let memoTags = record["tags"];
    if (memoTags.length == 0) return true;
    return syncExcludeTagsArr.every(myTag => memoTags.includes(myTag) == false)
  });
} else {
  // 包含模式：memo 的标签中至少包含一个包含标签
  allRecords = allRecords.filter(record => {
    let memoTags = record["tags"];
    return syncIncludeTagsArr.some(myTag => memoTags.includes(myTag))
  });
}
```

此外，**已删除的 memo** 和**已标记同步成功标签的 memo** 始终被过滤：

```typescript
allRecords = allRecords.concat(records.filter(record => {
  return !record["deleted_at"] && !record["tags"].includes(syncSuccessTag);
}));
```

### 4.2 HTML → Markdown 转换

flomo 的内容为 HTML 格式，使用 `turndown` 库转换为 Markdown，并做额外处理：

```typescript
handleMarkdown(memos) {
  const LIST_MAX_NUM = 50;  // 每 50 条作为一个列表块，避免卡顿
  memos.every((memo, idx) => {
    let content = memo.content;
    let files = memo.files;

    // 拼接图片 Markdown
    files.forEach(img => {
      let imgName = img["name"];
      if (!(imgName.endsWith(".png") || imgName.endsWith(".gif"))) {
        imgName = imgName + '.png'
      }
      let imgMd = "![" + img["name"] + "](" + FLOMO_ASSETS_DIR + "/" + img["id"] + "_" + imgName + ") ";
      content += imgMd
    })

    // HTML → Markdown
    content = new TurndownService().turndown(content);

    // 修复转义问题 & 标签格式
    content = content.replaceAll('\\\[', '[').replaceAll('\\\]', ']').replaceAll('\\\_', '_')
    content = content.replaceAll(/(?<=#)(.+?)(?=\s)/g, "$1#");  // 标签后加 # 适配思源

    // 缩进处理
    content = content.split("\n").reduce((result, line) => {
      if (line.trim() == "") line = ""
      return result + "\t" + line + "\n"
    }, "")

    // 每条 memo 作为一个列表项
    blockContent += '*  \n' + content;

    // 分块：每 50 条或最后一批
    if (((idx + 1) % LIST_MAX_NUM == 0) || (idx + 1 == memos.length)) {
      blockContent = blockContent.replace(/\n*$/g, "").replace(/^\n*/g, "")
      contentArr.push(blockContent)
      blockContent = ""
    }
  })
  return { contentArr, imgs }
}
```

**关键处理**：
- 图片路径格式：`assets/flomo/{imgId}_{imgName}`，确保与思源资源路径一致
- 标签格式转换：flomo 的 `#标签` 转为思源兼容的 `#标签#` 格式
- 内容分块：每 50 条 memo 为一个列表块，防止内容过长导致卡顿
- 每条 memo 以 `*  \n` 开头，作为思源的列表项

### 4.3 图片下载

将 flomo 中的图片下载到思源的工作空间 `assets/flomo/` 目录：

```typescript
async downloadImgs(imgs) {
  imgs.every(async img => {
    let imgName = img["name"];
    if (!(imgName.endsWith(".png") || imgName.endsWith(".gif"))) {
      imgName = imgName + '.png'
    }
    let imgPath = "data/" + FLOMO_ASSETS_DIR + "/" + img["id"] + "_" + imgName;
    let imgRespon = await fetch(img["url"]);
    let fileBlob = await imgRespon.blob();
    await this.addFile(imgPath, fileBlob);
  })
}

async addFile(f, file) {
  const fd = new FormData();
  fd.append('path', f);
  fd.append('isDir', 'false');
  fd.append('file', file);
  return await fetch('/api/file/putFile', { method: 'POST', body: fd });
}
```

### 4.4 写入思源

将转换后的 Markdown 内容追加到目标文档：

```typescript
async writeSiyuan(contentArr: string[]) {
  let targetPage = await this.getTargetPage();
  for (let blockContent of contentArr) {
    let data = {
      data: blockContent,
      dataType: "markdown",
      parentID: targetPage
    }
    await fetchSyncPost("/api/block/appendBlock", data);
  }
  // 写入后打开目标页面
  if (this.isMobile) {
    openMobileFileById(this.app, targetPage)
  } else {
    openTab({ app: this.app, doc: { id: targetPage } });
  }
}
```

**目标页面选择**：

```typescript
async getTargetPage() {
  let locationMode = this.data[STORAGE_NAME].locationMode;
  if (locationMode === "0") {
    // 方案一：写入指定笔记本的今日 daily note
    let notebook = this.data[STORAGE_NAME].dailnoteNotebook;
    if (!notebook) notebook = this.siyuanStorage["local-dailynoteid"];
    let todayId = await this.getTodayId(notebook);
    return todayId;
  } else {
    // 方案二：写入指定文档
    return this.data[STORAGE_NAME].pageId;
  }
}
```

### 4.5 回写标签到 flomo

同步完成后，可选地在 flomo 原始 memo 上添加同步成功标签，防止重复同步：

```typescript
async writeBackTag(memos: any[]) {
  let syncSuccessTag = this.data[STORAGE_NAME]["syncSuccessTag"]
  if (!syncSuccessTag) return;

  let baseUrl = "https://flomoapp.com/api/v1/memo"
  memos.every(async memo => {
    let timestamp = Math.floor(Date.now() / 1000).toFixed();
    let url = baseUrl + "/" + memo["slug"];

    // 在内容开头插入标签
    let addTag1 = `<p>#${syncSuccessTag} `
    let content = memo["content"].includes("<p>") ?
      memo["content"].replace("<p>", addTag1) :
      `<p>#${syncSuccessTag} </p>`.concat(memo["content"])

    let data = {
      api_key: "flomo_web",
      app_version: "2.0",
      content: content,
      created: memo["created"],
      file_ids: memo["files"].map(file => file.id),
      local_updated_at: timestamp,
      platform: "web",
      timestamp: timestamp,
      tz: "8:0",
      webp: "1"
    }
    data["sign"] = this.createSign2(data);

    await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.data[STORAGE_NAME]["accessToken"]}`,
        'Content-Type': 'application/json',
        'User-Agent': USG
      },
      body: JSON.stringify(data)
    })
  })
}
```

---

## 五、flomo API 接口汇总

| 接口 | 方法 | 用途 |
|---|---|---|
| `https://flomoapp.com/api/v1/user/login_by_email` | POST | 邮箱/密码登录，获取 accessToken |
| `https://flomoapp.com/api/v1/memo/updated` | GET | 增量获取 memo 列表 |
| `https://flomoapp.com/api/v1/memo/{slug}` | PUT | 更新指定 memo（回写标签） |

### 请求通用参数

| 参数 | 说明 |
|---|---|
| `api_key` | 固定值 `flomo_web` |
| `app_version` | 固定值 `2.0` |
| `timestamp` | 当前 Unix 时间戳（秒） |
| `tz` | 时区，如 `8:0` |
| `webp` | 固定值 `1` |
| `sign` | MD5 签名（由 `createSign2` 生成） |

### 认证方式

所有请求通过 HTTP Header 携带 Bearer Token：
```
Authorization: Bearer <accessToken>
```

---

## 六、配置项说明

| 配置项 | 说明 | 默认值 |
|---|---|---|
| `username` | flomo 手机号/邮箱 | 空 |
| `password` | flomo 密码 | 空 |
| `accessToken` | 登录后获取的令牌 | 空 |
| `lastSyncTime` | 上次同步时间 | 当天 00:00:00 |
| `syncSuccessTag` | 同步成功后回写 flomo 的标签 | 空（不回写） |
| `locationMode` | 写入位置方案：`0`=daily note，`1`=指定文档 | `0` |
| `dailnoteNotebook` | daily note 笔记本 ID | 默认笔记本 |
| `pageId` | 指定文档 ID | 空 |
| `syncTagMode` | 标签过滤模式：`0`=排除，`1`=包含 | `0` |
| `syncIncludeTags` | 包含标签列表（空格分隔） | 空 |
| `syncExcludeTags` | 排除标签列表（空格分隔） | 空 |

---

## 七、防重入与状态管理

```typescript
private syncing: boolean = false;

async runSync() {
  if (this.syncing == true) return;  // 防止并发同步
  this.syncing = true;
  try {
    // ... 同步逻辑
  } finally {
    this.syncing = false;
  }
}
```

**顶栏图标状态**：
- 🟢 flomo 图标：空闲/同步完成
- 🔄 刷新图标：正在同步
- ⬇️ 待同步图标：检测到 flomo 有新数据未同步

---

## 八、数据流图

```
flomo API                          plugin-flomo-sync                        思源笔记
─────────                          ────────────────                        ────────
                                   
  GET /memo/updated ──────────────▶ getLatestMemos()
  (增量拉取 memo)                    │
                                    ├─ 过滤已删除/已同步
                                    ├─ 标签过滤(包含/排除)
                                    │
                                    ▼
                                   handleMarkdown()
                                    │
                                    ├─ Turndown: HTML→MD
                                    ├─ 图片路径替换
                                    ├─ 标签格式转换(#tag→#tag#)
                                    ├─ 分块(50条/块)
                                    │
                          ┌─────────┴──────────┐
                          ▼                    ▼
                    downloadImgs()       writeSiyuan()
                    fetch(img[url])      /api/block/appendBlock
                          │                    │
                          ▼                    ▼
                   /api/file/putFile     daily note / 指定文档
                   (保存到assets/flomo)
                          
  PUT /memo/{slug} ◀────────────── writeBackTag()
  (回写同步标签)                     │
                                    └─ 添加 #syncSuccessTag
                                    
                                    saveData()
                                    └─ 更新 lastSyncTime
```
