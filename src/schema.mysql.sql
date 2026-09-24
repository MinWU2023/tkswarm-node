CREATE TABLE IF NOT EXISTS `groups` (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(191) NOT NULL,
  `type` VARCHAR(191) NOT NULL CHECK(type IN ('account','proxy','message','uid')),
  description VARCHAR(512) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS proxies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  protocol VARCHAR(16) NOT NULL DEFAULT 'http' CHECK(protocol IN ('http','https','socks5')),
  `host` VARCHAR(191) NOT NULL,
  port INT NOT NULL CHECK(port BETWEEN 1 AND 65535),
  username VARCHAR(128) NOT NULL DEFAULT '',
  password VARCHAR(255) NOT NULL DEFAULT '',
  country VARCHAR(64) NOT NULL DEFAULT '',
  group_id INT REFERENCES `groups`(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'unchecked' CHECK(status IN ('unchecked','available','unavailable')),
  latency_ms INT,
  last_checked_at TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(protocol, host, port, username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(191) NOT NULL UNIQUE,
  nickname VARCHAR(512) NOT NULL DEFAULT '',
  country VARCHAR(512) NOT NULL DEFAULT '',
  group_id INT REFERENCES `groups`(id) ON DELETE SET NULL,
  proxy_id INT REFERENCES proxies(id) ON DELETE SET NULL,
  browser_type VARCHAR(512) NOT NULL DEFAULT 'bit',
  browser_profile_id VARCHAR(512) NOT NULL DEFAULT '',
  login_status VARCHAR(512) NOT NULL DEFAULT 'offline' CHECK(login_status IN ('offline','online','expired','checking')),
  chat_status VARCHAR(512) NOT NULL DEFAULT 'offline' CHECK(chat_status IN ('offline','online','error')),
  enabled INT NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  notes VARCHAR(512) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS account_secrets (
  account_id INT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  password_encrypted VARCHAR(512) NOT NULL DEFAULT '',
  totp_secret_encrypted VARCHAR(512) NOT NULL DEFAULT '',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tiktok_profiles (
  account_id INT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  handle VARCHAR(512) NOT NULL DEFAULT '',
  display_name VARCHAR(512) NOT NULL DEFAULT '',
  bio VARCHAR(512) NOT NULL DEFAULT '',
  avatar_url VARCHAR(512) NOT NULL DEFAULT '',
  followers_count INT,
  following_count INT,
  likes_count INT,
  videos_count INT,
  verified INT NOT NULL DEFAULT 0 CHECK(verified IN (0,1)),
  source_url VARCHAR(512) NOT NULL DEFAULT '',
  last_synced_at TEXT,
  sync_status VARCHAR(512) NOT NULL DEFAULT 'never' CHECK(sync_status IN ('never','success','failed')),
  sync_error VARCHAR(512) NOT NULL DEFAULT '',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tiktok_stat_snapshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  followers_count INT,
  following_count INT,
  likes_count INT,
  videos_count INT,
  captured_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tiktok_videos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  `video_id` VARCHAR(191) NOT NULL,
  video_url TEXT NOT NULL,
  description VARCHAR(512) NOT NULL DEFAULT '',
  thumbnail_url VARCHAR(512) NOT NULL DEFAULT '',
  views_count INT,
  likes_count INT,
  comments_count INT,
  shares_count INT,
  published_at TEXT,
  last_synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(account_id, video_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS message_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(191) NOT NULL UNIQUE,
  content TEXT NOT NULL,
  variables VARCHAR(512) NOT NULL DEFAULT '',
  group_id INT REFERENCES `groups`(id) ON DELETE SET NULL,
  enabled INT NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name TEXT NOT NULL,
  file_path VARCHAR(512) NOT NULL DEFAULT '',
  file_name VARCHAR(512) NOT NULL DEFAULT '',
  mime_type VARCHAR(512) NOT NULL DEFAULT '',
  size_bytes INT NOT NULL DEFAULT 0,
  sha256 VARCHAR(512) NOT NULL DEFAULT '',
  description VARCHAR(512) NOT NULL DEFAULT '',
  tags VARCHAR(512) NOT NULL DEFAULT '',
  status VARCHAR(512) NOT NULL DEFAULT 'ready' CHECK(status IN ('ready','disabled','missing')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  status VARCHAR(512) NOT NULL DEFAULT 'prepared' CHECK(status IN ('prepared','confirmed','cancelled')),
  plan_json VARCHAR(512) NOT NULL DEFAULT '{}',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  level VARCHAR(512) NOT NULL DEFAULT 'info' CHECK(level IN ('info','warn','error')),
  message TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_action_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  account_id INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('success','failed','skipped')),
  result_json VARCHAR(512) NOT NULL DEFAULT '{}',
  error_message VARCHAR(512) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  account_id INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('running','success','failed','skipped')),
  error_message VARCHAR(512) NOT NULL DEFAULT '',
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('publish','message','sync','profile','warm','sync_fans','dm_sync')),
  status VARCHAR(512) NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','queued','running','paused','completed','failed','cancelled')),
  group_id INT REFERENCES `groups`(id) ON DELETE SET NULL,
  payload VARCHAR(512) NOT NULL DEFAULT '{}',
  total_count INT NOT NULL DEFAULT 0,
  success_count INT NOT NULL DEFAULT 0,
  fail_count INT NOT NULL DEFAULT 0,
  scheduled_at TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(191) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  account_id INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  material_id INT REFERENCES materials(id) ON DELETE SET NULL,
  status VARCHAR(512) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','publishing','success','failed','skipped')),
  error_message VARCHAR(512) NOT NULL DEFAULT '',
  result_json VARCHAR(512) NOT NULL DEFAULT '{}',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(task_id, account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_task_items_task ON task_items(task_id, id);

CREATE TABLE IF NOT EXISTS chat_friends (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  friend_uid VARCHAR(512) NOT NULL DEFAULT '',
  username VARCHAR(512) NOT NULL DEFAULT '',
  nickname VARCHAR(512) NOT NULL DEFAULT '',
  avatar_url VARCHAR(512) NOT NULL DEFAULT '',
  relation VARCHAR(512) NOT NULL DEFAULT 'stranger' CHECK(relation IN ('friend','follower','following','mutual','stranger','blocked')),
  tags VARCHAR(512) NOT NULL DEFAULT '',
  unread_count INT NOT NULL DEFAULT 0,
  is_pinned INT NOT NULL DEFAULT 0 CHECK(is_pinned IN (0,1)),
  is_new INT NOT NULL DEFAULT 0 CHECK(is_new IN (0,1)),
  last_message VARCHAR(512) NOT NULL DEFAULT '',
  last_direction VARCHAR(512) NOT NULL DEFAULT '' CHECK(last_direction IN ('','in','out')),
  last_message_at TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(account_id, friend_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  friend_id INT NOT NULL REFERENCES chat_friends(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK(direction IN ('in','out')),
  msg_type VARCHAR(512) NOT NULL DEFAULT 'text' CHECK(msg_type IN ('text','image','video','system')),
  content VARCHAR(512) NOT NULL DEFAULT '',
  status VARCHAR(512) NOT NULL DEFAULT 'sent' CHECK(status IN ('pending','sent','failed','read')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_connections (
  account_id INT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  status VARCHAR(512) NOT NULL DEFAULT 'offline' CHECK(status IN ('offline','connecting','online','error')),
  auto_translate INT NOT NULL DEFAULT 0 CHECK(auto_translate IN (0,1)),
  sync_messages INT NOT NULL DEFAULT 1 CHECK(sync_messages IN (0,1)),
  connected_at TEXT,
  last_error VARCHAR(512) NOT NULL DEFAULT '',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_chat_friends_account ON chat_friends(account_id, is_pinned DESC, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_friend ON chat_messages(friend_id, id);

CREATE INDEX IF NOT EXISTS idx_chat_connections_status ON chat_connections(status);

CREATE TABLE IF NOT EXISTS uid_targets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL REFERENCES `groups`(id) ON DELETE CASCADE,
  `uid` VARCHAR(191) NOT NULL,
  username VARCHAR(512) NOT NULL DEFAULT '',
  status VARCHAR(512) NOT NULL DEFAULT 'unused' CHECK(status IN ('unused','used','failed')),
  used_by_account_id INT REFERENCES accounts(id) ON DELETE SET NULL,
  used_task_id INT REFERENCES tasks(id) ON DELETE SET NULL,
  used_at TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_id, uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_uid_targets_group ON uid_targets(group_id, status, id);

CREATE TABLE IF NOT EXISTS agents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(191) NOT NULL UNIQUE,
  description VARCHAR(512) NOT NULL DEFAULT '',
  avatar VARCHAR(512) NOT NULL DEFAULT '',
  enabled INT NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  model_type VARCHAR(512) NOT NULL DEFAULT 'builtin' CHECK(model_type IN ('builtin','custom')),
  model_id VARCHAR(512) NOT NULL DEFAULT 'builtin',
  api_base VARCHAR(512) NOT NULL DEFAULT '',
  api_key VARCHAR(512) NOT NULL DEFAULT '',
  temperature REAL NOT NULL DEFAULT 0.7,
  reply_tone VARCHAR(512) NOT NULL DEFAULT 'friendly',
  reply_language VARCHAR(512) NOT NULL DEFAULT 'zh',
  role_info VARCHAR(512) NOT NULL DEFAULT '',
  mission VARCHAR(512) NOT NULL DEFAULT '',
  rules VARCHAR(512) NOT NULL DEFAULT '',
  openings_json VARCHAR(512) NOT NULL DEFAULT '[]',
  success_terminate_json VARCHAR(512) NOT NULL DEFAULT '{}',
  fail_terminate_json VARCHAR(512) NOT NULL DEFAULT '{}',
  poll_json VARCHAR(512) NOT NULL DEFAULT '{}',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_agents_enabled ON agents(enabled, id);

CREATE TABLE IF NOT EXISTS account_sessions (
  account_id INT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  cookie_encrypted VARCHAR(512) NOT NULL DEFAULT '',
  storage_encrypted VARCHAR(512) NOT NULL DEFAULT '',
  fingerprint VARCHAR(512) NOT NULL DEFAULT '',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS account_monitor_config (
  id INT PRIMARY KEY CHECK(id=1),
  enabled INT NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  interval_minutes INT NOT NULL DEFAULT 60 CHECK(interval_minutes BETWEEN 5 AND 1440),
  sync_profile INT NOT NULL DEFAULT 1 CHECK(sync_profile IN (0,1)),
  sync_videos INT NOT NULL DEFAULT 0 CHECK(sync_videos IN (0,1)),
  account_ids_json VARCHAR(512) NOT NULL DEFAULT '[]',
  last_run_at TEXT,
  last_result_json VARCHAR(512) NOT NULL DEFAULT '{}',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO account_monitor_config(id,enabled,interval_minutes) VALUES (1,0,60);

CREATE TABLE IF NOT EXISTS local_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(191) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(512) NOT NULL DEFAULT 'admin' CHECK(role IN ('admin','operator','viewer')),
  role_id INT,
  nickname VARCHAR(512) NOT NULL DEFAULT '',
  enabled INT NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_sessions (
  `token_hash` VARCHAR(191) PRIMARY KEY,
  user_id INT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id, expires_at);

CREATE TABLE IF NOT EXISTS navigation_menus (
  id INT AUTO_INCREMENT PRIMARY KEY,
  parent_id INT REFERENCES navigation_menus(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  icon VARCHAR(512) NOT NULL DEFAULT '',
  path VARCHAR(512) NOT NULL DEFAULT '',
  `view` VARCHAR(512) NOT NULL DEFAULT '',
  subview VARCHAR(512) NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  visible INT NOT NULL DEFAULT 1 CHECK(visible IN (0,1)),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_navigation_menus_parent ON navigation_menus(parent_id, sort_order);

-- RBAC（权限 / 角色 / 后台用户 / 审计日志）统一在 schema 建表，不放在路由里
CREATE TABLE IF NOT EXISTS admin_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  module TEXT NOT NULL,
  `code` VARCHAR(191) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(191) NOT NULL UNIQUE,
  description VARCHAR(512) NOT NULL DEFAULT '',
  permissions VARCHAR(512) NOT NULL DEFAULT '[]',
  status INT NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(191) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nickname VARCHAR(512) NOT NULL DEFAULT '',
  role_id INT NOT NULL DEFAULT 1,
  status INT NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL DEFAULT 0,
  module VARCHAR(512) NOT NULL DEFAULT 'system',
  action TEXT NOT NULL,
  ip VARCHAR(512) NOT NULL DEFAULT '',
  user_agent VARCHAR(512) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(191) NOT NULL UNIQUE,
  color VARCHAR(512) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 智能体预置模板（业务数据，不放在 JS 常量）
CREATE TABLE IF NOT EXISTS agent_templates (
  `key` VARCHAR(191) PRIMARY KEY,
  name TEXT NOT NULL,
  description VARCHAR(512) NOT NULL DEFAULT '',
  payload_json VARCHAR(512) NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 视图 → 权限码映射（前端/菜单裁剪共用）
CREATE TABLE IF NOT EXISTS view_permissions (
  `view` VARCHAR(191) PRIMARY KEY,
  codes_json VARCHAR(512) NOT NULL DEFAULT '[]',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 通用字典（状态、协议、筛选等）
CREATE TABLE IF NOT EXISTS app_dicts (
  `domain` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  meta_json VARCHAR(512) NOT NULL DEFAULT '{}',
  PRIMARY KEY(domain, code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS client_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  version VARCHAR(64) NOT NULL,
  title VARCHAR(191) NOT NULL DEFAULT '',
  channel VARCHAR(32) NOT NULL DEFAULT 'stable',
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  description TEXT NULL,
  file_path VARCHAR(512) NOT NULL DEFAULT '',
  file_name VARCHAR(255) NOT NULL DEFAULT '',
  file_size BIGINT NOT NULL DEFAULT 0,
  sha256 VARCHAR(64) NOT NULL DEFAULT '',
  download_count INT NOT NULL DEFAULT 0,
  is_latest TINYINT NOT NULL DEFAULT 0,
  owner_id INT NULL,
  published_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_client_version (version, channel),
  INDEX idx_client_ver_status (status, is_latest)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
