# TkSwarm Rebuild

一个独立的新项目，用于重建账号矩阵管理系统。当前版本是第一阶段 MVP，不复用旧系统源码，也不会修改原 TkSwarm 安装目录。

## 已实现

- 响应式管理后台
- PHP API（`tkswarm-api`）+ MySQL 业务数据
- Node 仅提供页面、WebSocket 与比特浏览器自动化，数据库同样是 MySQL，不再使用 SQLite
- 账号 CRUD、`账号----密码----2FA密钥` 批量导入、分组、代理绑定、状态维护
- 批量导入账号支持按代理 ID 顺序绑定、代理分组筛选、循环分配和不绑定代理
- 代理 CRUD、批量导入和 TCP 可达性检测
- 任务创建、排队、暂停和删除
- 账号/代理/消息/UID 分组
- 系统设置持久化
- Dashboard 统计
- WebSocket `/ws` 基础通道
- 比特浏览器 API 状态检测、环境同步、单个/批量创建、账号绑定、打开、关闭与删除
- 通过 CDP 检测 TikTok 会话 Cookie，并同步账号登录状态
- 健康检查 `/api/health`

## 尚未接入

- TikTok 表单登录辅助与页面自动化
- 浏览器环境的高级指纹模板与异步任务进度
- 视频发布执行器
- 私信实时同步与发送
- 翻译和 AI 自动回复
- 用户登录、权限和敏感信息加密

这些功能需要按模块接入，并使用你合法控制的账号、浏览器环境和第三方服务。

## 运行

要求 Node.js 22+。

```bash
npm install
npm start
```

默认地址：

```text
http://127.0.0.1:8999
```

开发模式：

```bash
npm run dev
```

## 环境变量

```text
TKSWARM_PORT=8999
TKSWARM_HOST=127.0.0.1
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=root
MYSQL_DATABASE=tkswarm
DATA_DIR=数据目录
CORS_ORIGIN=允许的跨域来源
NODE_ENV=production
```

## 主要目录

```text
src/          后端、数据库与 API
public/       前端静态应用
data/         素材、密钥与 MySQL 备份（运行后生成）
docs/         分析和实施文档
```

## 安全说明

默认仅监听 `127.0.0.1`，不要在没有认证、HTTPS 和防火墙保护的情况下改成公网监听。账号密码和 2FA 密钥使用本机生成的 AES-256-GCM 密钥加密保存。代理密码的加密迁移将在后续版本完成。请同时备份数据库与 `data/.secret-key`，缺少密钥将无法恢复账号凭据。
