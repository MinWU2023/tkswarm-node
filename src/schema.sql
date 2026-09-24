PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('account','proxy','message','uid')),
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, type)
);

CREATE TABLE IF NOT EXISTS proxies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  protocol TEXT NOT NULL DEFAULT 'http' CHECK(protocol IN ('http','https','socks5')),
  host TEXT NOT NULL,
  port INTEGER NOT NULL CHECK(port BETWEEN 1 AND 65535),
  username TEXT NOT NULL DEFAULT '',
  password TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'unchecked' CHECK(status IN ('unchecked','available','unavailable')),
  latency_ms INTEGER,
  last_checked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(protocol, host, port, username)
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
  proxy_id INTEGER REFERENCES proxies(id) ON DELETE SET NULL,
  browser_type TEXT NOT NULL DEFAULT 'bit',
  browser_profile_id TEXT NOT NULL DEFAULT '',
  login_status TEXT NOT NULL DEFAULT 'offline' CHECK(login_status IN ('offline','online','expired','checking')),
  chat_status TEXT NOT NULL DEFAULT 'offline' CHECK(chat_status IN ('offline','online','error')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS account_secrets (
  account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  password_encrypted TEXT NOT NULL DEFAULT '',
  totp_secret_encrypted TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tiktok_profiles (
  account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  handle TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  followers_count INTEGER,
  following_count INTEGER,
  likes_count INTEGER,
  videos_count INTEGER,
  verified INTEGER NOT NULL DEFAULT 0 CHECK(verified IN (0,1)),
  source_url TEXT NOT NULL DEFAULT '',
  last_synced_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'never' CHECK(sync_status IN ('never','success','failed')),
  sync_error TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tiktok_stat_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  followers_count INTEGER,
  following_count INTEGER,
  likes_count INTEGER,
  videos_count INTEGER,
  captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tiktok_videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  video_url TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT NOT NULL DEFAULT '',
  views_count INTEGER,
  likes_count INTEGER,
  comments_count INTEGER,
  shares_count INTEGER,
  published_at TEXT,
  last_synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(account_id, video_id)
);

CREATE TABLE IF NOT EXISTS message_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  variables TEXT NOT NULL DEFAULT '',
  group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT '',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ready' CHECK(status IN ('ready','disabled','missing')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'prepared' CHECK(status IN ('prepared','confirmed','cancelled')),
  plan_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TEXT
);

CREATE TABLE IF NOT EXISTS task_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'info' CHECK(level IN ('info','warn','error')),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_action_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('success','failed','skipped')),
  result_json TEXT NOT NULL DEFAULT '{}',
  error_message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('running','success','failed','skipped')),
  error_message TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('publish','message','sync','profile','warm','sync_fans','dm_sync')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','queued','running','paused','completed','failed','cancelled')),
  group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  total_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  scheduled_at TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_accounts_group ON accounts(group_id);
CREATE INDEX IF NOT EXISTS idx_accounts_proxy ON accounts(proxy_id);
CREATE INDEX IF NOT EXISTS idx_accounts_login_status ON accounts(login_status);
CREATE INDEX IF NOT EXISTS idx_proxies_group ON proxies(group_id);
CREATE INDEX IF NOT EXISTS idx_proxies_status ON proxies(status);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
CREATE INDEX IF NOT EXISTS idx_task_runs_task ON task_runs(task_id, id);
CREATE INDEX IF NOT EXISTS idx_task_action_results_task ON task_action_results(task_id, id);
CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id, id);
CREATE INDEX IF NOT EXISTS idx_task_plans_task ON task_plans(task_id, id);
CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status);
CREATE INDEX IF NOT EXISTS idx_message_templates_enabled ON message_templates(enabled);
CREATE INDEX IF NOT EXISTS idx_tiktok_profiles_sync ON tiktok_profiles(sync_status, last_synced_at);
CREATE INDEX IF NOT EXISTS idx_tiktok_videos_account ON tiktok_videos(account_id, last_synced_at);
CREATE INDEX IF NOT EXISTS idx_tiktok_stats_account ON tiktok_stat_snapshots(account_id, captured_at);

CREATE TABLE IF NOT EXISTS task_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  material_id INTEGER REFERENCES materials(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','publishing','success','failed','skipped')),
  error_message TEXT NOT NULL DEFAULT '',
  result_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(task_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_task_items_task ON task_items(task_id, id);

CREATE TABLE IF NOT EXISTS chat_friends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  friend_uid TEXT NOT NULL DEFAULT '',
  username TEXT NOT NULL DEFAULT '',
  nickname TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  relation TEXT NOT NULL DEFAULT 'stranger' CHECK(relation IN ('friend','follower','following','mutual','stranger','blocked')),
  tags TEXT NOT NULL DEFAULT '',
  unread_count INTEGER NOT NULL DEFAULT 0,
  is_pinned INTEGER NOT NULL DEFAULT 0 CHECK(is_pinned IN (0,1)),
  is_new INTEGER NOT NULL DEFAULT 0 CHECK(is_new IN (0,1)),
  last_message TEXT NOT NULL DEFAULT '',
  last_direction TEXT NOT NULL DEFAULT '' CHECK(last_direction IN ('','in','out')),
  last_message_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(account_id, friend_uid)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  friend_id INTEGER NOT NULL REFERENCES chat_friends(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK(direction IN ('in','out')),
  msg_type TEXT NOT NULL DEFAULT 'text' CHECK(msg_type IN ('text','image','video','system')),
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'sent' CHECK(status IN ('pending','sent','failed','read')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_connections (
  account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offline' CHECK(status IN ('offline','connecting','online','error')),
  auto_translate INTEGER NOT NULL DEFAULT 0 CHECK(auto_translate IN (0,1)),
  sync_messages INTEGER NOT NULL DEFAULT 1 CHECK(sync_messages IN (0,1)),
  connected_at TEXT,
  last_error TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_friends_account ON chat_friends(account_id, is_pinned DESC, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_friend ON chat_messages(friend_id, id);
CREATE INDEX IF NOT EXISTS idx_chat_connections_status ON chat_connections(status);

CREATE TABLE IF NOT EXISTS uid_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  uid TEXT NOT NULL,
  username TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unused' CHECK(status IN ('unused','used','failed')),
  used_by_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  used_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_id, uid)
);

CREATE INDEX IF NOT EXISTS idx_uid_targets_group ON uid_targets(group_id, status, id);

CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  model_type TEXT NOT NULL DEFAULT 'builtin' CHECK(model_type IN ('builtin','custom')),
  model_id TEXT NOT NULL DEFAULT 'builtin',
  api_base TEXT NOT NULL DEFAULT '',
  api_key TEXT NOT NULL DEFAULT '',
  temperature REAL NOT NULL DEFAULT 0.7,
  reply_tone TEXT NOT NULL DEFAULT 'friendly',
  reply_language TEXT NOT NULL DEFAULT 'zh',
  role_info TEXT NOT NULL DEFAULT '',
  mission TEXT NOT NULL DEFAULT '',
  rules TEXT NOT NULL DEFAULT '',
  openings_json TEXT NOT NULL DEFAULT '[]',
  success_terminate_json TEXT NOT NULL DEFAULT '{}',
  fail_terminate_json TEXT NOT NULL DEFAULT '{}',
  poll_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agents_enabled ON agents(enabled, id);

CREATE TABLE IF NOT EXISTS account_sessions (
  account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  cookie_encrypted TEXT NOT NULL DEFAULT '',
  storage_encrypted TEXT NOT NULL DEFAULT '',
  fingerprint TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS account_monitor_config (
  id INTEGER PRIMARY KEY CHECK(id=1),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  interval_minutes INTEGER NOT NULL DEFAULT 60 CHECK(interval_minutes BETWEEN 5 AND 1440),
  sync_profile INTEGER NOT NULL DEFAULT 1 CHECK(sync_profile IN (0,1)),
  sync_videos INTEGER NOT NULL DEFAULT 0 CHECK(sync_videos IN (0,1)),
  account_ids_json TEXT NOT NULL DEFAULT '[]',
  last_run_at TEXT,
  last_result_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO account_monitor_config(id,enabled,interval_minutes) VALUES (1,0,60);

CREATE TABLE IF NOT EXISTS local_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('admin','operator','viewer')),
  role_id INTEGER,
  nickname TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id, expires_at);

CREATE TABLE IF NOT EXISTS navigation_menus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER REFERENCES navigation_menus(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '',
  path TEXT NOT NULL DEFAULT '',
  view TEXT NOT NULL DEFAULT '',
  subview TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1 CHECK(visible IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_navigation_menus_parent ON navigation_menus(parent_id, sort_order);

-- RBAC（权限 / 角色 / 后台用户 / 审计日志）统一在 schema 建表，不放在路由里
CREATE TABLE IF NOT EXISTS admin_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  permissions TEXT NOT NULL DEFAULT '[]',
  status INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nickname TEXT NOT NULL DEFAULT '',
  role_id INTEGER NOT NULL DEFAULT 1,
  status INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL DEFAULT 0,
  module TEXT NOT NULL DEFAULT 'system',
  action TEXT NOT NULL,
  ip TEXT NOT NULL DEFAULT '',
  user_agent TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 智能体预置模板（业务数据，不放在 JS 常量）
CREATE TABLE IF NOT EXISTS agent_templates (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 视图 → 权限码映射（前端/菜单裁剪共用）
CREATE TABLE IF NOT EXISTS view_permissions (
  view TEXT PRIMARY KEY,
  codes_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 通用字典（状态、协议、筛选等）
CREATE TABLE IF NOT EXISTS app_dicts (
  domain TEXT NOT NULL,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  meta_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY(domain, code)
);

-- 客服客户端代码版本包
CREATE TABLE IF NOT EXISTS client_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL DEFAULT 'stable',
  file_name TEXT NOT NULL DEFAULT '',
  file_path TEXT NOT NULL DEFAULT '',
  file_size INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  is_latest INTEGER NOT NULL DEFAULT 0 CHECK(is_latest IN (0,1)),
  download_count INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_client_versions_version_channel ON client_versions(version, channel);

