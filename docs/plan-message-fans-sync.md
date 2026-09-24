# 计划：消息设置 / AI 翻译 / 比特拉粉丝 / API 模式私信同步

> 状态：**已按全量落地（代码）** — 2026-09-22  
> 约束：**业务数据一律走 PHP + MySQL + HTTP 接口**；本机 Node 只做比特/浏览器自动化与任务执行  
> **诚实说明**：`dm_sync` 已进入二期：**API HTTP 探测** + **Bit 拦截真实 IM XHR / DOM 只读爬取**（可开关降级）。失败仍标记 `unsupported`，**不写假消息**。非官方全量 IM SDK。


---

## 0. 一句话目标

把客服「消息设置」做成真能力：设置可存、翻译走 PHP、客服/群发能用 AI 多语言；比特能把**粉丝列表**拉进 `chat_friends`；具备 **API 模式** 账号时按间隔从 TikTok 拉私信进库。不伪造「未接通通道却显示同步成功」。

---

## 1. 需求拆解（客服 + 截图）

| # | 需求点 | 含义 |
|---|--------|------|
| R1 | 消息模板 ↔ TikTok 私信 | 话术明确用于私信客服/群发，可开关启用 |
| R2 | 私信同步 | 开关 + 间隔（分钟）；**仅 API 模式**可用 |
| R3 | 通知同步 | 开关 + 检查间隔（分钟）+ 提示音 + 试听 |
| R4 | 翻译模式 | 普通翻译 / AI 智能翻译（耗 Token/配额） |
| R5 | 保存设置 | 写入 settings（MySQL） |
| R6 | 比特拉粉丝 | 打开环境，把账号粉丝列表导入为客服好友（非仅刷新粉丝数） |
| R7 | 批量私信可用粉丝 | 群发目标可选「粉丝/互关」等，数据来自 R6 或本地 relation |

---

## 2. 现状差距（相对本仓库）

| 能力 | 现状 | 缺口 |
|------|------|------|
| 消息设置 UI | 有局部设置；文案已标明「本地标记」 | 未对齐截图：分钟间隔、API 模式说明、通知间隔、试听可用 |
| 私信同步 | `privateMessageSync` → `chat_connections.sync_messages` 本地标记 | **不拉** TikTok 收件箱 |
| 翻译 | Node `translator.js` + `/api/translate` | **PHP 无** `/api/translate`；Chat 发送不翻译 |
| 试听 | UI 有按钮 | `playTipSound` 未实现 |
| 刷新粉丝 | Bit 同步主页 **粉丝数** | **不导入粉丝 UID 列表** |
| 群发目标 | `imported` / `new` / `unreplied` / `fixed` | 无「从比特刚拉的粉丝」一键目标；`follower` 依赖本地 relation |
| API 模式 | 无账号字段；mass 有 `api/ws/bit` 通道（api=本地会话） | 无 cookie/指纹 TikTok IM HTTP 客户端 |
| PHP 任务执行 | `TaskRunnerCommand` 多为 stub | 真拉粉丝/真同步需 Node 执行器 + PHP 任务 CRUD |

---

## 3. 架构原则（硬性）

```
前端 SPA ──HTTP──► PHP API (tkswarm-api) ──► MySQL
                         │
                         │ 写 tasks / 读 settings / 写 chat_*
                         ▼
              本机 Node task-runner / Bit Playwright
                         │
                         └── 结果回写 PHP（或 Node 直写同一 MySQL，以 PHP schema 为准）
```

- **设置、模板、翻译配额、好友、消息、任务元数据**：只经 PHP 接口。  
- **打开比特、爬粉丝列表、爬收件箱、UI 发私信**：本机 Node。  
- 前端默认 `API_BASE` 指向 PHP；本机自动化仍可走 Node（与现有 warm/bit 一致）。

---

## 4. 分期与交付物

### 阶段 0 — 准备（0.5d）

- [ ] 冻结字段名与字典：`message_sync_mode`、`dm_mode`（api|browser）、settings 键对照表  
- [ ] 迁移脚本单语句规范（与现有 `011+`）  
- [ ] 冒烟账号：至少 1 个已登录 Bit 环境；1 个有 CK/指纹可试 API（若暂无则 API 同步标「可配置、真机后验」）

### 阶段 1 — 消息设置对齐 + PHP 翻译（M1，约 2–3d）

**交付：截图能力可配置、可保存；客服收发可走 PHP 翻译。**

#### 1.1 Settings 键（MySQL `settings`）

| Key | 类型 | 说明 |
|-----|------|------|
| `privateMessageSync` | bool | 是否启用私信同步调度 |
| `messageSyncInterval` | int | **改为分钟**（UI 与文档统一；迁移时若旧值≤120 且曾当秒用，做一次换算规则写进 migrate 注释） |
| `messageSyncMode` | enum | `api`（默认）\|`browser`；浏览器模式保存可开但调度跳过并记日志 |
| `notificationSync` | bool | 新消息桌面/声音提示 |
| `notificationInterval` | int | 分钟；前端轮询未读用 |
| `notificationSound` | string | chime\|soft\|alert\|none |
| `translationMode` | enum | `off`\|`basic`\|`ai`（UI 文案：普通 / AI；兼容参考 `normal`→`basic`） |
| `translationOnReceive` | bool | 客服连接默认收信翻译 |
| `translationApiUrl` / `ApiKey` / `ModelId` / `Target` / `Quota` / `Used` | 既有 | AI 与普通共用 URL/Key 字段；一期 **不做**单独「AI Token 激活码」流程（若你要激活码，单列变更） |
| `dmTemplateEnabled` | bool | 「消息模板用于 TikTok 私信」总开关 |

#### 1.2 UI（`public/app.js` 消息设置）

- 按截图三块：私信同步 / 通知同步 / 翻译模式 + 保存  
- 私信同步：开关、间隔（分钟）、模式单选（API / 浏览器）、提示「仅 API 模式会调度拉取」  
- 通知：开关、间隔、音效、**试听**（修复 `playTipSound`，音源走 `/api/audio` 或静态资源）  
- 翻译：普通 / AI + API 配置 + 配额展示  
- 话术页/模板页角标：「用于 TikTok 私信」+ 受 `dmTemplateEnabled` 控制

#### 1.3 PHP `POST /api/translate`

- 新建 `TranslateController` + `Services/Translator.php`  
- 行为对齐 Node：`basic`（HTTP 查询类翻译 URL）、`ai`（OpenAI 兼容 chat/completions）  
- 读 settings；成功后递增 `translationUsed`；超配额返回明确错误  
- `GET /api/translate/config`：模式、是否已配 Key、配额（不回明文 Key）  
- Chat 发消息 / 可选收信钩子：需要翻译时调同一服务（PHP 内聚，不经 Node）

#### 1.4 验收

- 保存设置后刷新仍在  
- 未配 Key 时 AI 模式失败提示清晰，不写假译文  
- 配好 Key 后中↔英一轮成功，`translated` 落库，配额 +1  
- 试听可出声

---

### 阶段 2 — 比特拉粉丝列表（M2，约 2–3d）

**交付：客服「刷新粉丝」= 导入粉丝 UID 到 `chat_friends`，不只刷新数字。**

#### 2.1 数据

- 继续用 `chat_friends.relation ∈ {follower, mutual, ...}`  
- 可选表 `tiktok_followers_sync`（account_id, friend_uid, synced_at）便于去重与审计——**推荐加**，避免重复爬爆库  
- `tiktok_profiles` 仍更新 followers_count

#### 2.2 接口形态

| 层 | 接口 | 职责 |
|----|------|------|
| PHP | `POST /api/chat/accounts/:id/refresh-fans` | 鉴权+数据范围；创建 `tasks.type=sync_fans` 或直接派本机执行标记；返回 jobId |
| PHP | `GET /api/chat/accounts/:id/refresh-fans/status` | 进度：已拉 N、写入 M、错误 |
| Node | 执行器 `tiktok-fans.js`（新） | Bit 打开粉丝列表页，滚动分页解析 UID/昵称/头像，批量 upsert 好友 |

前端：客服「刷新粉丝」改调 PHP；轮询状态；完成后 toast「新增 x / 更新 y」。

#### 2.3 爬取策略（Node）

- 前置：`assertChatGate`（有 `browser_profile_id` + 登录）  
- 打开 `https://www.tiktok.com/@{handle}/followers`（或站内粉丝面板，以真机选择器为准）  
- 滚动加载；解析列表项 → `{uid, username, nickname, avatar}`  
- 上限：settings `fansSyncMaxPerRun`（默认 500）防一次拖死  
- 失败截图进 `data/automation/`（与 warm 一致）

#### 2.4 群发衔接

- `mass_target` 增加或启用：`followers`（本地 `relation in ('follower','mutual')`）  
- 向导文案：「请先刷新粉丝再选粉丝目标」  
- 可选 payload：`requireFreshFansWithinMinutes`

#### 2.5 验收

- 真机：刷新后好友列表出现粉丝，relation 正确  
- 二次刷新：增量更新、不炸重复主键  
- 无 Bit / 未登录：明确错误，不标成功  
- 群发选粉丝目标能命中刚导入 UID

---

### 阶段 3 — API 模式定时拉 TikTok 私信（M3，约 4–6d，风险最高）

**交付：开启私信同步且模式=API 时，按间隔把会话/消息写入 MySQL；浏览器模式不调度。**

#### 3.1 账号「API 模式」判定（建议）

一期不强制新枚举字段也可，用组合条件：

```
dmCapableApi = has_session(CK) AND fingerprint 非空 AND 非仅依赖 Bit 打开页
```

可选增强（推荐一并做）：

- `accounts.dm_channel`：`auto|api|browser`（默认 auto）  
- 设置里全局 `messageSyncMode=api` 时，仅调度 `dm_channel≠browser` 且 CK 有效的账号

浏览器模式账号：允许客服手工 Bit 发信；**不进**定时收件箱同步队列。

#### 3.2 调度

| 组件 | 位置 | 说明 |
|------|------|------|
| 配置源 | PHP settings | `privateMessageSync` + `messageSyncInterval`(分钟) |
| 调度器 | PHP `Schedule` 或独立 CLI + cron | 每分钟扫一次：到期账号入队 |
| 任务 | `tasks.type = 'dm_sync'` | payload: accountIds / cursor |
| 执行 | 本机 Node | 读 CK/指纹 → 调 TikTok 私信相关 HTTP（实现见 3.3）→ 结果 upsert |

并发：受 `taskConcurrency` 限制；单账号互斥锁（避免双开同步）。

#### 3.3 拉信实现策略（必须诚实）

TikTok **无公开稳定官方 IM API**。可选实现路径（按可行性排序，实施时选定一条并写死）：

| 路径 | 做法 | 风险 |
|------|------|------|
| **P-A（优先尝试）** | 用账号 `cookie_encrypted` + 已采集 fingerprint，逆向/抓包对齐网页 IM 接口（参考站若存在「API 模式」即此类） | 接口易变、风控、法律合规需你方自担 |
| **P-B（降级）** | API 模式暂不可用时：调度跳过并标记 `dm_sync_status=unsupported`；浏览器模式用 Bit 打开 `/messages` **只读爬列表**（慢、不稳定） | 与截图「仅 API」不完全一致，作降级说明 |
| **P-C（禁止）** | 写入假 inbox 消息冒充已同步 | **不做** |

计划默认：**先 P-A 调研 1–2d（抓包 + 最小 PoC）**；若 PoC 失败，停在「设置+调度骨架+状态 unsupported」，再与你确认是否启用 P-B。

#### 3.4 数据写入

- `chat_friends`：会话列表 upsert（uid、昵称、未读、last_message、last_direction）  
- `chat_messages`：按平台 message id 去重（需新列 `external_id` VARCHAR + 唯一索引 `(account_id, external_id)`）  
- `chat_connections.sync_messages=1` 且 `last_synced_at`  
- 新消息：若 `notificationSync`，经已有 WS/轮询让前端提示+试听

#### 3.5 翻译串联

- 同步写入后：若好友 `translate_in` 或账号 `auto_translate`，调 PHP Translator 填 `translated`  
- 群发/客服发信 `translate_out` 同样走 PHP

#### 3.6 验收

- 设置开启 + 间隔 1 分钟 + API 合格账号：库内出现真实会话/消息（PoC 成功前提下）  
- 浏览器-only 账号：日志「跳过：非 API 模式」  
- 关闭开关后不再入队  
- 重复同步不产生重复气泡（external_id）  
- 前端客服列表未读数变化 + 可选提示音

---

### 阶段 4 — 串联与文档（M4，约 1d）

- [ ] 菜单/权限：消息设置、刷新粉丝、同步任务只读日志  
- [ ] 更新 `docs/功能闭环盘点.md`：撤销「明确不做真实私信同步」中与本计划冲突的表述，改为「已实现范围 / 降级说明」  
- [ ] README / 运维：cron 如何跑 `dm_sync`、本机 Node 必须在线  
- [ ] 冒烟清单（见 §6）

---

## 5. 任务与表变更清单（汇总）

### 5.1 新/改 tasks.type

| type | 用途 |
|------|------|
| `sync_fans` | 比特拉粉丝列表 |
| `dm_sync` | API 模式拉私信 |
| `message`（已有） | 群发；目标扩展 followers |

### 5.2 Schema（PHP migration，单语句文件）

- `chat_messages.external_id` + 唯一索引  
- `chat_connections.last_synced_at`（若无）  
- `accounts.dm_channel`（可选但推荐）  
- `tiktok_followers_sync`（可选）  
- settings 新键靠 seed，无需改表结构

### 5.3 新 PHP 文件（预期）

- `Controllers/Api/TranslateController.php`  
- `Services/Translator.php`  
- ChatController：refresh-fans 派发、messages 去重字段  
- `Commands/DmSyncCommand.php` / 扩展 Scheduler  
- SeedMeta：字典 `message_sync_mode`、`dm_channel`、`mass_target.followers`

### 5.4 新 Node 文件（预期）

- `src/services/browser/tiktok-fans.js`  
- `src/services/browser/tiktok-dm-sync.js`（P-A 或 P-B）  
- `task-runner.js` 分支：`sync_fans` / `dm_sync`  
- 修复/补齐 `playTipSound` 相关前端逻辑

---

## 6. 冒烟清单（你验收用）

1. 消息设置保存 → 刷新仍在；试听有声  
2. PHP `/api/translate` basic + ai 各一次  
3. 客服好友开关收/发翻译 → 气泡显示译文  
4. 比特在线账号「刷新粉丝」→ 好友列表新增粉丝  
5. 群发目标选粉丝 → 任务 targets 非空  
6. 开启私信同步（API）→ 有合格 CK 账号出现 sync 任务；浏览器账号被跳过  
7. （PoC 过）收件箱有新私信 → 库内可见且不重复  
8. 关闭同步 → 不再产生新 `dm_sync` 任务  

---

## 7. 风险与决策点（执行前请拍板）

| # | 决策 | 建议默认 |
|---|------|----------|
| D1 | AI 是否要「Token 激活码」流程 | **否**，沿用 URL/Key/配额 |
| D2 | `messageSyncInterval` 旧「秒」兼容 | 迁移：若值≤120 视为秒÷60 取整分钟，最少 1 |
| D3 | API 拉信失败时 | **已批准 P-B**：默认开启 `dmSyncBitFallback`；Bit 拦截优先、DOM 兜底；仍失败则 unsupported |
| D4 | 粉丝单次上限 | 500，可配置 |
| D5 | Node 写库 vs 只回写 PHP | 与现网 warm 一致：执行器可写同一 MySQL，但**任务创建/查询走 PHP** |
| D6 | 是否改历史文档「明确不做全量同步」 | 执行本计划后改为「按 API 模式有限同步」 |

---

## 8. 工作量粗估

| 阶段 | 人天（约） |
|------|------------|
| M1 设置 + PHP 翻译 | 2–3 |
| M2 比特拉粉丝 + 群发衔接 | 2–3 |
| M3 API 私信同步（含 PoC） | 4–6（PoC 失败则 2d 骨架） |
| M4 串联文档冒烟 | 1 |
| **合计** | **9–13** |

---

## 9. 建议执行口令（确认后用）

你回复其一即可开工：

- **`执行 plan-message-fans-sync：M1+M2`** — 设置/翻译/比特拉粉丝先上，API 拉信先不做  
- **`执行 plan-message-fans-sync：全量`** — M1→M4；M3 先 PoC，失败按 D3  
- **`执行 plan-message-fans-sync：全量 + 批准 P-B`** — PoC 失败时允许 Bit 只读爬收件箱作降级  
- **`不执行`**

---

## 10. 与客服原文的映射

| 客服/截图 | 落点 |
|-----------|------|
| 消息模板对应 TikTok 私信、开启功能 | `dmTemplateEnabled` + 模板/设置文案（M1） |
| AI 多语言翻译 | PHP Translator + 客服/同步串联（M1/M3） |
| 私信同步间隔、仅 API | settings + `dm_sync` 调度（M3） |
| 通知同步/试听 | settings + 前端音效（M1） |
| （方案 A 全量·比特拉粉丝） | `sync_fans` + 群发 followers（M2） |

---

## 11. 落地清单（2026-09-22）

| 项 | 状态 |
|----|------|
| M1 消息设置对齐（分钟/API模式/通知间隔/试听） | ✅ `public/app.js` + SystemController |
| M1 PHP `/api/translate` + Chat 发信翻译 | ✅ Translator.php / TranslateController / ChatController::send |
| M2 比特拉粉丝列表 `sync_fans` | ✅ tiktok-fans.js + task-runner + PHP refresh-fans |
| M2 群发目标 followers | ✅ mass-sender + SeedMeta + UI 提示 |
| M3 `dm_sync` API + Bit 降级 | ✅ HTTP IM 探测；失败可 Bit 拦截 XHR / DOM 爬取；`dmSyncBitFallback`；失败 → unsupported |
| Schema 迁移 011–018 | ✅ external_id / last_synced_at / dm_channel / followers_sync / 字典 |
| 运维 | ✅ `php artisan dm:sync`；本机 Node 执行队列；PHP task:run 不再 stub 完成自动化任务 |

**部署后请执行：** `php migrate.php`（或逐条跑 011–018），重启 Node，cron 挂上 `dm:sync`。
