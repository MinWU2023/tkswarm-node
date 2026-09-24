# 系统体检与修复计划

> 盘点日期：2026-09-22  
> 范围：前端 SPA（`public/`）+ PHP API（`tkswarm-api/`）+ 本机 Node 自动化（`src/`）  
> 架构假设：业务数据默认走 **PHP + MySQL**；比特/备份/上传/音频/`bit-send` 走本机 Node  
> 状态：**阶段 A+B+C 已落地（代码）** — 2026-09-22；二期 D 未做

---

## 0. 总览结论

系统主路径（账号/代理/素材/任务创建/设置/翻译/养号入队）大体可用，但存在几类会直接导致「点了报错 / 假闭环 / 样式缺口」的问题：

| 类别 | 严重程度概览 |
|------|----------------|
| ① 前端交互异常 | **P0**：2 个死方法；若干接口打到 PHP 404 |
| ② 样式不合理 | **P2**：操作菜单、统计 chip、若干仅作选择器的 class |
| ③ 后端异常风险 | **P0**：迁移/旧 schema 与代码不一致；**P1**：翻译字段反转、IDOR、JSON_CONTAINS |
| ④ 功能未打通 | **P0/P1**：客服搜索/模拟收信/同步标记；dm_sync 仅为探测骨架；Agent 自定义模型无效 |
| ⑤ 死按钮 / 半死开关 | **P0/P1**：见 §5；另有设置项保存后后端忽略 |

**建议执行顺序：** P0 路由与死按钮 → P0 迁移安全 → P1 行为/安全 → P2 样式与文案诚实度。

**执行记录（A+B+C+D）：** A–C 见上。**阶段 D**：`tiktok-dm-sync.js` 增强 API HTTP + Bit 拦截/DOM 爬收件箱；`DmSyncCommand` 支持 browser 模式与 `dmSyncBitFallback`；设置页可配置。仍非官方 IM SDK，失败不写假消息。

---

## 1. 前端交互异常 / 报错

### P0

| ID | 问题 | 证据 | 建议修复 |
|----|------|------|----------|
| F-01 | `app.selectUidGroup` **未定义**，UID 侧栏点分组报错 | `renderUids` 中 `onclick="app.selectUidGroup(${g.id})"`；方法扫描缺失 | 补方法：设 `uidGroupId` 后 `refresh()` |
| F-02 | `app.addChatTagFromModal` **未定义**，「管理标签 → 添加」死按钮 | `manageChatTags` 内 onclick；有 `deleteChatTag` 无 add | 读 modal 表单 → `POST /chat/tags` → 关窗刷新 |
| F-03 | 客服「搜索用户」→ PHP **404** | `GET /chat/search-user` 未走 `useLocalNode`；`web.php` 无路由；Node 有 | **优先** PHP 移植；或临时加入 `useLocalNode` |
| F-04 | 「写入本地测试消息」→ PHP **404** | `POST /chat/messages/simulate-in` 同理 | PHP 实现（含 AI 托管触发策略）或改打 Node |
| F-05 | 「开启/取消同步标记」→ PHP **404** | `POST /chat/accounts/batch-sync` 同理 | PHP 实现更新 `chat_connections.sync_messages` |

### P1

| ID | 问题 | 证据 | 建议修复 |
|----|------|------|----------|
| F-06 | 「取消翻译」发 `clearTranslate:true`，PHP `patchFriend` **不识别** | Node `chat.js` 处理；PHP 无 | PHP 增加 clear 分支，关 translate_in/out |
| F-07 | 设置里自定义 **WebSocket 地址无效** | `config.js` 有 `getWsBase()`；`connectLiveLogs` 仍用 `location.host` | `connectLiveLogs` 改用 `getWsBase()` |
| F-08 | 任务「入队成功」但 Node 离线时一直 `queued`，无健康提示 | PHP `TaskRunnerCommand` 跳过自动化类型 | 任务列表/刷新粉丝增加「等待本机 Node」状态与探测 |

### P2

| ID | 问题 | 建议 |
|----|------|------|
| F-09 | 试听用 WebAudio，非 `/api/audio` | 可保留；文档写清即可 |
| F-10 | 图片上传走 Node `/uploads`，跨域打开可能 404 | 统一静态域名或 PHP 代理上传 |

---

## 2. 样式不合理 / 不美观

> 不做大改视觉体系；只列影响可用性的缺口。

| ID | 问题 | 证据 | 建议修复 |
|----|------|------|----------|
| S-01 | `.ops-menu` 被 JS/`ui.js` 使用，**无 CSS 规则** | 仅有 `.ops-dropdown` | 补 `.ops-menu` 定位/层级，与左侧操作浮层一致 |
| S-02 | `.stat-chip.fans` 无主题色 | 仅有 `.info/.ok/.warn` | 给 `.fans` 配色或改用已有修饰类 |
| S-03 | 勾选 class（`account-check` 等）无样式 | 功能正常，属选择器 class | 可不改；若需统一勾选间距可加 `gap` |
| S-04 | 消息设置区块信息密度偏高 | 多行说明+多开关 | 分区小标题 + 折叠次要项（翻译 Key 等） |
| S-05 | 客服三栏在窄屏易挤 | `.chat-*` 已有但缺断点 | `@media` 改为单栏堆叠 |

**不做：** 整站换肤、紫渐变/暗黑跟风改造。

---

## 3. 后端代码异常 / 报错风险

### P0

| ID | 问题 | 证据 | 建议修复 |
|----|------|------|----------|
| B-01 | 迁移 `004` 聊天表结构（`peer_uid`/`sender`）与运行时代码（`friend_uid`/`direction`）**不一致** | `004_chat_tables.sql` vs `ChatController` | 新迁移重建/改名到 Node 对等结构；勿依赖 IF NOT EXISTS 改形态 |
| B-02 | `011/013/014` 的 `AFTER xxx` 依赖可能不存在的列/表 | 如 `AFTER translated`、`chat_connections`、`chat_status` | ALTER 改为幂等、去掉脆弱 `AFTER`；先保证表存在 |
| B-03 | `install.sql` 与现网 schema 脱节 | 无 payload/现代账号字段 | 废弃或从现行 schema 重生；安装文档只认 migrate |

### P1

| ID | 问题 | 证据 | 建议修复 |
|----|------|------|----------|
| B-04 | PHP 发信 `translate_out`：**译文进 content、原文进 translated**，与 Node 相反 | `ChatController::send` | 对齐 Node：`content=原文`，`translated=译文` |
| B-05 | `DataScope::ensureColumns` 把所有 `owner_id IS NULL` 刷成 `1` | `DataScope.php` | 取消 blanket UPDATE；仅 INSERT 打标 |
| B-06 | `dm:sync` 入队任务无 `owner_id` | `DmSyncCommand` | 用账号 `owner_id` 写入 |
| B-07 | `DmSyncCommand` SELECT `has_session`/`fingerprint` 未在 CLI 内 ensure | 纯 cron 库可能缺列 | CLI 内 ensure 或只依赖 `account_sessions` |
| B-08 | 账号部分批量/导出 **未做 owner 过滤**（IDOR） | `batchAssignProxy` 等 | 统一 `assertOwns` / `ownerSql` |
| B-09 | `JSON_CONTAINS` 查重失败可直接 500 | refresh-fans / dm:sync | try/catch + 兼容字符串 ID |
| B-10 | `external_id` 唯一索引仅靠迁移 012，runtime ensure 未加 | DM 去重失效 | ensureSchema 补 unique |

### P2

| ID | 问题 | 建议 |
|----|------|------|
| B-11 | Router OPTIONS 未放行 `X-Acting-As` | 与 CorsMiddleware 对齐 |
| B-12 | 仪表盘粉丝汇总未按 owner 过滤 | join accounts + ownerSql |
| B-13 | 统计卡全局数字对子账号可见 | 同上 |

**已确认正常：** `web.php` 路由方法均存在；`TaskRunnerCommand` **不会再 stub 假完成** Node 任务。

---

## 4. 功能未实现 / 未打通

| ID | 功能 | 现状 | 建议 |
|----|------|------|------|
| G-01 | 客服搜索用户 / 模拟收信 / 批量同步标记 | UI 有，PHP 无 → 默认环境断 | 见 F-03~05 |
| G-02 | API 私信同步「全量」 | 仅 CK 探测；失败 `unsupported`，不写假消息 | 文案降级为「骨架」；真同步单列二期 |
| G-03 | Agent「自定义 API 模型」试聊 | PHP 仍走 builtin 规则回复 | 接 HTTP chat/completions 或试聊改打 Node |
| G-04 | 云代理 API URL | 设置可存，`ProxyController::fetch` 忽略 | 实现拉取或移除表单项 |
| G-05 | `dmTemplateEnabled` | 仅文案提示，不拦截群发/客服 | 真正禁用模板选择，或去掉开关 |
| G-06 | 账号 `dm_channel` | 库字段有，前端无编辑 | 账号编辑加下拉，或隐藏 API 同步承诺 |
| G-07 | Node 离线时任务队列 | 一直 queued | 健康检查 + 超时失败 |
| G-08 | 文档互相矛盾 | 闭环盘点 vs plan-message-fans-sync | 统一「有限同步/骨架」表述 |
| G-09 | 比特发布/改资料选择器 | 代码有，真机半成品 | 保持「半成品真机」；不伪造成功 |
| G-10 | `requireFreshFansWithinMinutes` | 计划有、未做 | P2 可选 |

**已打通（依赖 Node 在线）：** 发布/群发/养号入队、`sync_fans`、PHP 翻译、消息设置键读写、比特 `bit-send`（本机）。

---

## 5. 死按钮 / 半死控件清单

| 控件 | 位置 | 现象 | 级别 |
|------|------|------|------|
| UID 分组侧栏点击 | AI 矩阵 → UID | `selectUidGroup` 缺失 → 控制台报错 | P0 |
| 添加标签 | 客服 → 管理标签 | `addChatTagFromModal` 缺失 | P0 |
| 搜索用户 | 客服 | PHP 404 | P0 |
| 写入本地测试消息 | 客服会话菜单 | PHP 404 | P0 |
| 开启/取消同步标记 | 账号批量 | PHP 404 | P0 |
| 取消翻译 | 客服翻译条 | 请求成功但设置未清（PHP） | P1 |
| 自定义 WS 地址保存 | 环境设置 | 保存了但不生效 | P1 |
| 云代理 API | 浏览器设置 | 保存无效 | P1 |
| 启用私信话术开关 | 消息设置 | 不强制禁用模板 | P1 |
| Agent 自定义模型试聊 | AI 机器人 | 看起来成功，实为规则回复 | P1 |
| 下载比特浏览器 | 设置 | **有效**（外链） | — |
| 试听提示音 | 消息设置 | **有效**（WebAudio） | — |
| 比特发送 | 客服 | **有效**（打本机 Node） | — |

---

## 6. 分期修复方案（供评估）

### 阶段 A — 止血（约 1–2d）【建议先做】

1. 补 `selectUidGroup`、`addChatTagFromModal`  
2. PHP 实现或 `useLocalNode`：`search-user` / `simulate-in` / `batch-sync`  
3. PHP `clearTranslate`  
4. 修正发信翻译字段方向（B-04）  
5. 迁移 011–014 幂等化 + 文档注明迁移风险（B-01/B-02）

### 阶段 B — 诚实与安全（约 2–3d）

1. DataScope 取消 NULL→1；DmSync 写 owner_id  
2. 账号批量/导出补数据范围  
3. JSON_CONTAINS 容错；external_id 唯一索引 runtime ensure  
4. Agent 自定义模型真正调用或 UI 标注「未接」  
5. `getWsBase` 接入；云代理实现或下线表单项  
6. 任务/刷新粉丝 Node 离线提示  
7. 统一文档：dm_sync = 骨架，非全量收件箱

### 阶段 C — 体验（约 1–2d）

1. `.ops-menu` / `.stat-chip.fans` / 客服窄屏  
2. 消息设置分区  
3. `dm_channel` UI；`dmTemplateEnabled` 真拦截  
4. 粉丝目标预检（本地 0 粉丝时向导提示）

### 阶段 D — 二期（已落地）

1. ~~真实 TikTok IM API~~ → HTTP 探测 + **Bit 拦截页面真实 IM XHR**（比伪造签名更稳）  
2. ~~Bit 爬收件箱降级~~ → 已实现（`dmSyncBitFallback`，DOM 兜底）  
3. Studio/CapCut 官方通道（明确不做）

---

## 7. 验收清单（修完后勾）

- [x] UID 点分组可切换列表，无控制台报错  
- [x] 客服可添加/删除标签  
- [x] 搜索用户、模拟收信、同步标记在 PHP 环境下成功  
- [x] 取消翻译后好友 translate 开关关闭  
- [x] 发信开启「发送翻译」后：气泡原文 + 译文位置与 Node 一致  
- [x] `php migrate.php` 在干净库可跑完 011–018（或文档说明需先 ensure）— 另增 019  
- [x] 非超管无法改他人账号代理/导出全库  
- [x] 设置 WebSocket 地址后日志 WS 连到该地址  
- [x] Agent 自定义模型：真调用或明确提示未启用  
- [x] 文案不再宣称「已全量拉 TikTok 私信」  

---

## 8. 执行口令（请回复其一）

- **`执行体检计划：阶段 A`** — 只止血（死按钮 + 404 路由 + 翻译字段 + 迁移安全）  
- **`执行体检计划：A+B`** — 止血 + 安全/诚实  
- **`执行体检计划：全量 A+B+C`** — 含样式体验  
- **`不执行`** — 仅保留本文档  

文档路径：`docs/plan-system-audit.md`
