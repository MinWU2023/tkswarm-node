# TkSwarm Rebuild

一个独立的新项目，用于重建账号矩阵管理系统。当前版本是第一阶段 MVP，不复用旧系统源码，也不会修改原 TkSwarm 安装目录。

## 已实现

- 响应式管理后台
- SQLite 数据库和自动建表
- 账号 CRUD、分组、代理绑定、状态维护
- 代理 CRUD、批量导入和 TCP 可达性检测
- 任务创建、排队、暂停和删除
- 账号/代理/消息/UID 分组
- 系统设置持久化
- Dashboard 统计
- WebSocket `/ws` 基础通道
- 健康检查 `/api/health`

## 尚未接入

- TikTok 登录与页面自动化
- 指纹浏览器 API
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
http://127.0.0.1:8400
```

开发模式：

```bash
npm run dev
```

## 环境变量

```text
TKSWARM_PORT=8400
TKSWARM_HOST=127.0.0.1
DB_PATH=绝对或相对数据库路径
DATA_DIR=数据目录
CORS_ORIGIN=允许的跨域来源
NODE_ENV=production
```

## 主要目录

```text
src/          后端、数据库与 API
public/       前端静态应用
data/         SQLite 数据（运行后生成）
docs/         分析和实施文档
```

## 安全说明

默认仅监听 `127.0.0.1`，不要在没有认证、HTTPS 和防火墙保护的情况下改成公网监听。代理密码目前存入本地 SQLite；正式版本会增加系统密钥加密。
