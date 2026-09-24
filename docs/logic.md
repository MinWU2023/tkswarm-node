# TkSwarm 业务逻辑与流程图

> 来源：本地参考 `http://localhost:8399`、重建 `http://127.0.0.1:8400`、`refers/page_*.html`、官网 tkswarm.com  
> 缺口与分期见 [`plan.md`](./plan.md)

---

## 0. 两边架构对照

### 0.1 参考系统（8399）运行结构

```mermaid
flowchart TB
  subgraph Client[TKSwarm 客户端 UI :8399]
    Login["/page/index 登录"]
    Acc["/page/account 账号管理"]
    Proxy["/page/proxy 代理IP"]
    Agent["/page/agent AI机器人"]
    Pub["/page/publish AI矩阵"]
    Chat["/page/chat 客服聊天"]
    Set["/page/settings 系统设置"]
  end

  subgraph API[业务 API]
    TkAcc["/api/tk-account/*"]
    TkChat["/api/tk-chat/*"]
    TkIp["/api/tk-ip/* + /tiktok/ip/*"]
    Task["/api/task/*"]
    AgApi["/api/agent/*"]
    Mon["/api/account-monitor/*"]
    SetApi["/api/tk-setting/*"]
    User["/api/user/*"]
  end

  subgraph Realtime[实时]
    WS["/websocket/chat"]
    Conn["/api/websocket/connections/*"]
  end

  subgraph Ext[外部依赖]
    Bit[比特浏览器]
    CapCut[CapCut]
    Studio[TikTok Studio]
    CloudIP[云代理]
    LLM[AI/翻译服务]
  end

  Login --> User
  Acc --> TkAcc
  Acc --> Conn
  Proxy --> TkIp
  Agent --> AgApi
  Pub --> Task
  Chat --> TkChat
  Chat --> WS
  Set --> SetApi
  Acc --> Bit
  Pub --> Bit
  Pub --> CapCut
  Pub --> Studio
  Proxy --> CloudIP
  Agent --> LLM
  Chat --> LLM
```

### 0.2 当前系统（8400）运行结构

```mermaid
flowchart TB
  subgraph UI[Rebuild SPA :8400]
    Dash[控制台]
    Acc2[账号管理]
    Prox2[代理管理]
    Br[浏览器环境]
    Tasks[任务中心]
    Mat[素材库]
    Tpl[消息模板]
    Grp[分组管理]
    Set2[系统设置]
  end

  subgraph API2[Express /api]
    Accounts["/api/accounts"]
    Proxies["/api/proxies"]
    Browser["/api/browser"]
    TasksApi["/api/tasks"]
    Materials["/api/materials"]
    Templates["/api/message-templates"]
    Settings["/api/settings"]
  end

  subgraph Auto[自动化]
    LoginAssist[登录辅助填表]
    Sync[资料/视频同步]
    PrepPub[发布 prepare]
    PrepMsg[消息 prepare]
    Guard[验证码守卫]
  end

  subgraph Ext2[外部]
    Bit2[比特浏览器 CDP]
    DB[(MySQL)]
  end

  LogWS["/ws 操作日志"]

  Acc2 --> Accounts
  Acc2 --> Browser
  Prox2 --> Proxies
  Br --> Browser
  Tasks --> TasksApi
  Mat --> Materials
  Tpl --> Templates
  Set2 --> Settings
  Browser --> Bit2
  Browser --> LoginAssist
  Browser --> Sync
  Browser --> PrepPub
  Browser --> PrepMsg
  PrepPub --> Guard
  PrepMsg --> Guard
  TasksApi --> Sync
  TasksApi --> PrepPub
  TasksApi --> PrepMsg
  Accounts --> DB
  LogWS -.-> UI
```

### 0.3 能力覆盖对比（逻辑视角）

```mermaid
flowchart LR
  subgraph Ref[8399 能力面]
    R1[账号池+门禁]
    R2[代理池+云IP]
    R3[多通道发布]
    R4[群发+UID]
    R5[聚合聊天WS]
    R6[AI机器人]
    R7[激活/翻译配额]
  end

  subgraph Cur[8400 能力面]
    C1[账号CRUD+登录辅助]
    C2[代理CRUD+TCP]
    C3[发布prepare]
    C4[消息prepare]
    C5[资料/视频同步]
    C6[素材+任务队列]
  end

  R1 -.->|部分| C1
  R2 -.->|部分| C2
  R3 -.->|半自动| C3
  R4 -.->|半自动| C4
  R5 -.->|缺失| X1[无]
  R6 -.->|缺失| X2[无]
  R7 -.->|缺失| X3[无]
  C5 --> OK[已可用]
  C6 --> OK
```

---

## 1. 产品总闭环（参考业务）

```mermaid
flowchart TB
  subgraph S[系统准备]
    S1[配置/下载比特浏览器] --> S2[服务激活可选]
    S2 --> S3[消息同步与翻译设置]
    S2 --> S4[AI Token / 翻译配额可选]
  end

  subgraph P[代理池]
    P1[手动添加或云端 fetchIP] --> P2[批量检测]
    P2 --> P3[轮转周期]
  end

  subgraph A[账号池]
    A1[导入/批量添加/扫码] --> A2[分配代理]
    A2 --> A3[创建指纹环境并登录]
    A3 --> A4[CK / 指纹 / CapCut 门禁就绪]
    A4 --> A5[AI 更新账号数据]
    A4 --> A6[登录客服聊天建连]
  end

  subgraph M[AI矩阵]
    V[视频发布任务] --> Vrun[Studio/CapCut/Bit 执行]
    U[导入 UID] --> Mass[群发 API/WS]
  end

  subgraph C[客服转化]
    C1[聚合收发] --> C2[话术/翻译]
    C2 --> C3[标签/置顶/拉黑]
    C3 --> C4[AI 机器人托管]
  end

  S --> P --> A
  A --> M
  A --> C
  S4 --> C2
  S4 --> C4
```

---

## 2. 账号上线运营链路

### 2.1 参考侧（8399）

```mermaid
flowchart TD
  Start([开始]) --> Import{导入方式}
  Import -->|文本格式 1-10| Batch[批量添加/导入]
  Import -->|扫码| QR[二维码会话 generate/check/close]
  Batch --> Group[账号分组 groupType=5]
  QR --> Group
  Group --> BindIP[批量分配代理]
  BindIP --> CreateEnv[比特环境/指纹]
  CreateEnv --> Login[批量登录 batch-login]
  Login --> Gate{门禁}
  Gate -->|有指纹+CK| OpsReady[可运营]
  Gate -->|CapCut 授权| CapCutOK[可走 CapCut 发布]
  OpsReady --> Monitor[AI 更新账号 monitor/account-monitor]
  OpsReady --> ChatOn[批量登录客服 websocket batch-create]
  ChatOn --> Opts[可选: autoTranslate + syncMsg]
  Opts --> Online([在线可用])
  CapCutOK --> Online
  Monitor --> Online
```

### 2.2 当前侧（8400）实际路径

```mermaid
flowchart TD
  S([开始]) --> Imp[批量导入 账号----密码----2FA]
  Imp --> Grp[选账号分组]
  Grp --> Prox[顺序/统一/不绑定代理]
  Prox --> Create[创建并绑定比特环境]
  Create --> Assist[登录辅助填表 不自动提交]
  Assist --> Human[人工点 Log in / 2FA Next]
  Human --> Check[CDP 检测 session cookie]
  Check --> SyncOpt[可选: sync-profile / sync-videos]
  SyncOpt --> End([login_status=online])
```

### 2.3 账号状态机

```mermaid
stateDiagram-v2
  [*] --> 未登录: 导入账号

  state "参考 loginStatus" as RefLogin {
    [*] --> L0: 0 未登录
    L0 --> L1: 开始登录
    L1 --> L2: 成功
    L1 --> L3: 失败
    L2 --> L0: 掉线/退出
  }

  state "参考账号 status" as RefAcc {
    [*] --> N0: 0 正常
    N0 --> N_1: -1 封号
    N0 --> N1: 1 异常
    N0 --> N2: 2 受限
  }

  state "参考 chatStatus" as RefChat {
    [*] --> C0: 0 未登录
    C0 --> C1: 1 登录中
    C1 --> C2: 2 已登录
    C1 --> C3: 3 失败
    C2 --> C4: 4 已下线
  }

  state "8400 login_status" as Cur {
    [*] --> offline
    offline --> checking
    checking --> online
    checking --> offline
    online --> expired
    expired --> offline
  }
```

### 2.4 账号批操作逻辑（参考）

```mermaid
flowchart LR
  Sel[勾选账号或按分组] --> Act{批量动作}
  Act --> Login[登录]
  Act --> Move[转移分组]
  Act --> Profile[修改资料]
  Act --> DelVid[删除视频]
  Act --> Calib[校准国家/IP]
  Act --> ChatIn[登录客服]
  Act --> ChatOut[退出客服]
  Act --> DelAcc[删除账号]
  Act --> Export[导出]
```

---

## 3. 代理 IP 链路

### 3.1 参考侧

```mermaid
flowchart TD
  G1[代理分组 groupType=1] --> Add{来源}
  Add -->|手动| BatchAdd["/api/tk-ip/batchAdd"]
  Add -->|云端| Fetch["/tiktok/ip/fetchIP"]
  Fetch --> Geo[国家 → 州 → 城市]
  Geo --> Rotate[轮转周期 1-120 分钟]
  BatchAdd --> Test[批量检测 batchTest]
  Rotate --> Test
  Test --> OK{可用?}
  OK -->|是| Assign[分配到账号]
  OK -->|否| Fix[更换/删除]
  Assign --> AccLogin[账号登录走该出口]
```

### 3.2 当前侧

```mermaid
flowchart TD
  A[添加/批量导入代理] --> G[可选代理分组]
  G --> T[TCP 端口检测]
  T --> Bind[账号绑定 proxy_id]
  Bind --> Bit[创建比特环境时写入代理]
```

---

## 4. 矩阵视频发布链路

### 4.1 参考侧向导（AI矩阵 · 视频任务）

```mermaid
flowchart TD
  T0([创建发布任务]) --> Ch{pushChannel}
  Ch -->|1| Studio[TikTok Studio]
  Ch -->|2| CapCut[CapCut]
  Ch -->|3| Bit[比特浏览器]
  Studio --> Acc[选分组 → 选账号]
  CapCut --> Acc
  Bit --> Acc
  Acc --> Mat[素材文件夹]
  Mat --> Strat{publishStrategy}
  Strat -->|random| R1[随机分配]
  Strat -->|deduplicate| R2[去重分配]
  R1 --> Copy[caption / hashtag / @用户]
  R2 --> Copy
  Copy --> Cfg[线程 / 定时 / 备注 / 省流]
  Cfg --> Create["POST /api/task/video/create"]
  Create --> Run[start]
  Run --> Sub{子项}
  Sub -->|0→1→2| Done[成功]
  Sub -->|失败 3| Retry[批量重新发布]
  Retry --> Run
  Done --> Extra[可选: 定位 / 商品]
```

### 4.2 当前侧（半自动）

```mermaid
flowchart TD
  C0([创建 publish 任务]) --> Payload[accountIds + materialIds + caption]
  Payload --> Start[start 入队]
  Start --> Prep[preparePublish]
  Prep --> Open[打开 upload/Studio]
  Open --> File[setInputFiles]
  File --> Fill[填标题/描述]
  Fill --> Shot[截图诊断]
  Shot --> Stop{故意停止}
  Stop --> Manual[人工点发布]
  Stop --> Paused[security_paused / manual_required]
  Manual --> Done([平台侧发布成功 - 系统不保证感知])
```

### 4.3 任务状态机

```mermaid
stateDiagram-v2
  [*] --> draft

  state "8400 tasks.status" as T8400 {
    draft --> queued: start
    queued --> running
    running --> completed
    running --> failed
    running --> paused: 人工/安全暂停
    paused --> queued: 再 start
    queued --> cancelled
    running --> cancelled
    failed --> queued: retry
  }

  state "8399 任务 status" as T8399 {
    [*] --> S1: 1 待执行
    S1 --> S2: 2 执行中
    S2 --> S3: 3 已完成
    S2 --> S4: 4 已停止
    S2 --> S5: 5 失败
  }

  state "8399 视频子项" as VItem {
    [*] --> V0: 0 待发布
    V0 --> V1: 1 发布中
    V1 --> V2: 2 成功
    V1 --> V3: 3 失败
  }
```

---

## 5. 矩阵群发链路

### 5.1 参考侧

```mermaid
flowchart TD
  U0([导入 UID 组 groupType=9]) --> Mass([创建群发任务])
  Mass --> Ch{群发入口}
  Ch -->|1| API[API 群发]
  Ch -->|2| WS[WebSocket 群发]
  Ch -->|3| BitX[比特浏览器 - 开发中]
  API --> Acc[选账号]
  WS --> Acc
  Acc --> Content[多行内容]
  Content --> Target{sendTargetType}
  Target -->|1| NewF[新好友]
  Target -->|2| Unreply[未回复好友]
  Target -->|3| ImportF[导入好友]
  Target -->|4| Fixed[固定对象]
  NewF --> Cfg[间隔/重试/每账号条数/定时]
  Unreply --> Cfg
  ImportF --> Cfg
  Fixed --> Cfg
  Cfg --> SyncOpt[可选发送前同步粉丝/消息]
  SyncOpt --> Exec[子项: 待发送→发送中→完成/失败]
```

### 5.2 当前侧

```mermaid
flowchart TD
  M0([创建 message 任务]) --> Body[content / caption]
  Body --> Start[start]
  Start --> Prep[prepareMessage]
  Prep --> OpenMsg[打开 /messages]
  OpenMsg --> Fill[填收件人与内容]
  Fill --> Stop[不点击发送]
  Stop --> Human[等待人工发送]
```

### 5.3 UID 资源流（参考）

```mermaid
flowchart LR
  Imp[导入 UID] --> Stat[统计]
  Stat --> Dedup[去重成功 UID]
  Dedup --> Use[群发消费]
  Use --> Export[导出未使用]
  Use --> Del[按组删除]
```

---

## 6. 客服聊天链路

### 6.1 连接与收发（参考）

```mermaid
flowchart TD
  L1[账号登录客服] --> Create["connections/batch-create/{syncMsg}/{autoTranslate}"]
  Create --> WS["WS /websocket/chat"]
  WS --> HB[heartbeat]
  WS --> Ev{事件}
  Ev --> NM[new_message]
  Ev --> FS[friend_status]
  Ev --> MS[message_status]
  Ev --> AS[account_status]
  Ev --> RD[friend_msg_read_status]

  UI[三栏 UI] --> Filter[好友过滤器]
  Filter --> List[好友列表]
  List --> Thread[消息分页 getMessagesPage]
  Thread --> Send["POST /api/websocket/send"]
  Send --> WS

  UI --> Ops[已读/置顶/拉黑/标签/打招呼]
  UI --> Trans[翻译设置]
  UI --> Quick[快捷话术]
```

### 6.2 好友筛选逻辑（参考）

```mermaid
flowchart TB
  All[全部好友] --> F1[未读]
  All --> F2[我未回复]
  All --> F3[好友未回复]
  All --> F4[新好友]
  All --> F5[陌生人]
  All --> F6[失败]
  All --> F7[重粉]
  All --> F8[粉丝]
  All --> F9[拉黑]
  All --> F10[自定义标签]
```

### 6.3 消息类型（参考）

```mermaid
flowchart LR
  In[入站/出站消息] --> T7[7 文本]
  In --> T5[5 图片]
  In --> T8[8 视频]
  In --> T26[26 名片]
  In --> T15[15 贴纸]
  In --> T25[25 图集]
  In --> T1021[1021 直播分享]
  In --> T1805[1805 GIF]
  In --> T1[1 系统]
```

### 6.4 当前侧差距

```mermaid
flowchart TD
  Now[8400] --> A[无聊天页]
  Now --> B[无好友/消息表]
  Now --> C[无 /websocket/chat]
  Now --> D[仅 message-prepare]
  D --> E[人工在浏览器里发送]
```

---

## 7. AI 机器人与转化链路

### 7.1 参考侧 Agent 配置流

```mermaid
flowchart TD
  A0([创建智能体]) --> Base[头像/名称/描述/启停]
  Base --> Model{modelType}
  Model -->|0| BuiltIn[内置模型]
  Model -->|1| CustomAPI[自定义 API]
  Model -->|2| CustomAgent[自定义智能体]
  BuiltIn --> Dialog[开场白/角色/目标/规则/语气/温度]
  CustomAPI --> Dialog
  CustomAgent --> Dialog
  Dialog --> Term[成功/失败终止条件]
  Term --> Poll[号码轮询 TG/Line/WA 或推广链接]
  Poll --> Test[testChat]
  Test --> Save[save]
```

### 7.2 托管会话逻辑（目标态；参考 AI托管仍标开发中）

```mermaid
flowchart TD
  Msg[收到粉丝私信] --> Bind{会话是否绑定 Agent?}
  Bind -->|否| Human[人工/话术]
  Bind -->|是| AI[调用 Agent]
  AI --> Match{命中终止?}
  Match -->|成功关键词| OK[成功回复 + 下发资源]
  Match -->|失败关键词| Fail[失败回复并结束]
  Match -->|否| Reply[AI 回复继续聊]
  Reply --> Msg
  OK --> End([结束或转人工])
  Fail --> End
```

---

## 8. 系统设置与底座

### 8.1 参考设置结构

```mermaid
flowchart TB
  Set[系统设置] --> Br[浏览器设置]
  Set --> Act[服务激活]
  Set --> Msg[消息设置]
  Set --> Clock[多国时钟]
  Set --> DB[(数据库配置-隐藏)]

  Br --> Bit[browserType=bit]
  Br --> Headless[无头: scan/message/capcut/login/profile/publish]
  Br --> Cache[清缓存/语言/省内存]

  Act --> Lic[软件套餐]
  Act --> Tr[翻译字符配额]
  Act --> Tok[AI Token]
  Act --> IpCard[IP 更换次卡]

  Msg --> Sync[私信同步间隔]
  Msg --> Sound[提示音]
  Msg --> Mode[translateMode normal|ai]
```

### 8.2 当前设置结构

```mermaid
flowchart LR
  S[settings] --> K1[browserType / browserApiUrl / token]
  S --> K2[taskConcurrency / timeout / batchInterval / maxRetries]
  S --> K3[messageSyncInterval]
  S --> K4[useSystemProxy]
  S --> K5[language]
  K2 -.->|部分未消费| Runner[task-runner]
  K3 -.->|未消费| X[无聊天同步]
```

---

## 9. 端到端主路径对照

### 9.1 参考：从 0 到发布 + 聊天

```mermaid
sequenceDiagram
  participant U as 用户
  participant UI as 8399 UI
  participant API as 业务API
  participant Bit as 比特浏览器
  participant TT as TikTok
  participant WS as Chat WS

  U->>UI: 登录系统
  U->>UI: 设置浏览器 / 导入代理
  U->>UI: 导入账号并分配代理
  UI->>API: batch-login / 扫码
  API->>Bit: 打开环境
  Bit->>TT: 登录拿会话
  U->>UI: 创建发布任务
  UI->>API: task/video/create + start
  API->>Bit: 按通道上传发布
  Bit->>TT: 发布视频
  U->>UI: 批量登录客服
  UI->>API: websocket connections batch-create
  API->>WS: 建立账号连接
  WS-->>UI: new_message
  U->>UI: 回复/话术/翻译
  UI->>API: websocket/send
```

### 9.2 当前：从 0 到半自动准备

```mermaid
sequenceDiagram
  participant U as 用户
  participant UI as 8400 UI
  participant API as Express API
  participant Bit as 比特浏览器
  participant TT as TikTok

  U->>UI: 直接进入后台(无登录)
  U->>UI: 导入代理/账号
  U->>UI: 批量创建环境
  UI->>API: /api/browser/accounts/batch-create
  API->>Bit: 创建 profile + 代理
  U->>UI: 登录辅助
  UI->>API: login-assist
  API->>Bit: CDP 填表
  U->>TT: 人工点击登录
  U->>UI: 创建 publish 任务并 start
  UI->>API: /api/tasks/:id/start
  API->>Bit: preparePublish
  Bit->>TT: 打开上传并填表
  API-->>UI: manual_required / paused
  U->>TT: 人工点击发布
  Note over U,TT: 无聚合聊天、无群发自动发送、无 AI 机器人
```

---

## 10. 分组类型与实体关系

### 10.1 参考 groupType

| 值 | 用途 |
|----|------|
| 1 | 代理池 |
| 5 | 账号池 |
| 8 | 话术分类 |
| 9 | 群发 UID/好友组 |

### 10.2 当前 groups.type

| 值 | 用途 | 前端 |
|----|------|------|
| account | 账号分组 | 有 |
| proxy | 代理分组 | 有 |
| message | 消息分组 | Tab 有，业务弱 |
| uid | UID 分组 | **无 UI** |

### 10.3 核心实体关系（目标对齐参考）

```mermaid
erDiagram
  GROUPS ||--o{ ACCOUNTS : account_group
  GROUPS ||--o{ PROXIES : proxy_group
  GROUPS ||--o{ UID_TARGETS : uid_group
  GROUPS ||--o{ MSG_MODELS : message_category
  PROXIES ||--o{ ACCOUNTS : binds
  ACCOUNTS ||--o| BROWSER_PROFILE : has
  ACCOUNTS ||--o{ TASK_ITEMS : executes
  ACCOUNTS ||--o{ FRIENDS : chats
  FRIENDS ||--o{ MESSAGES : has
  ACCOUNTS ||--o| CHAT_CONNECTION : online
  MATERIALS ||--o{ TASK_ITEMS : used_by
  TASKS ||--o{ TASK_ITEMS : contains
  AGENTS ||--o{ FRIENDS : optional_host
  ACCOUNTS ||--o{ TIKTOK_VIDEOS : owns
  ACCOUNTS ||--o| TIKTOK_PROFILES : syncs
```

---

## 11. 模块依赖顺序（实施时逻辑依赖）

```mermaid
flowchart TD
  B0[浏览器 Provider 稳定] --> B1[账号登录态/门禁]
  B1 --> B2[代理真实可用]
  B2 --> B3[发布执行器]
  B1 --> B4[聊天连接与收发]
  B4 --> B5[群发 + UID]
  B4 --> B6[翻译]
  B6 --> B7[AI 机器人 / 托管]
  B3 --> B8[Studio/CapCut 通道]
  B1 --> B9[账号监控与统计]
  B4 --> B10[话术/标签运营]
  B0 --> B11[无头功能位/多浏览器]
```

与 [`plan.md`](./plan.md) 中 Phase A→F 一致：先发布与聊天闭环，再群发与 AI，最后生产化。

---

## 12. 附录：本地实测快照

| 项 | 8399 | 8400 |
|----|------|------|
| 根路径 | 登录页「TKSwarm - 登录」 | Rebuild 控制台 |
| 业务页 | account/proxy/agent/publish/chat/settings 均 200 | 单页 SPA 九视图 |
| 鉴权 | 业务 API 401 | 无鉴权 200 |
| 健康 | `/actuator` 200；无 `/api/health` | `/api/health` 200，version 0.1.0 |
| 页面内功能词 | 扫码/CapCut/群发/AI托管/激活/翻译等齐全 | 无 AI/翻译/扫码/CapCut/聊天 WS |
| 数据示例 | 需登录后可见 | 8 账号 online、100 代理、1 条 paused 发布任务、比特 API offline |

*文档随实现推进应同步更新状态机与「当前侧」流程图。*
