/**
 * 本机视频上传到启用中的 GitHub Release CDN。
 * 线下素材文件只在 Node 本机，不能交给远程 PHP 读盘。
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const phpApi = require('./php-api');

function safeAssetBase(name) {
  const base = path.basename(String(name || 'video'), path.extname(String(name || '')));
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^[-._]+|[-._]+$/g, '');
  return cleaned || 'video';
}

/** 与 PHP date('Ymd') 对齐：按东八区日历日生成 tag */
function ymdChina() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // en-CA → YYYY-MM-DD
  return fmt.format(new Date()).replace(/-/g, '');
}

function formatGithubError(json, status) {
  const msg = String(json?.message || `HTTP ${status || '?'}`);
  const errors = Array.isArray(json?.errors) ? json.errors : [];
  if (!errors.length) return msg;
  const details = errors.map((e) => {
    if (!e || typeof e !== 'object') return String(e);
    if (e.message) return String(e.message);
    const parts = [e.resource, e.field, e.code].filter(Boolean).map(String);
    return parts.join('.') || JSON.stringify(e);
  }).filter(Boolean);
  const joined = details.join('；');
  // 常见场景给可操作提示
  const lower = `${msg} ${joined}`.toLowerCase();
  if (lower.includes('repository is empty') || lower.includes('git repository is empty')) {
    return 'GitHub 仓库是空的（尚无提交）。请先在该仓库创建 README 或推送任意一次提交后再上传';
  }
  if (lower.includes('already_exists') && lower.includes('tag_name')) {
    return 'Release 标签已存在，正在重试获取…';
  }
  if (lower.includes('already_exists') && (lower.includes('name') || lower.includes('releaseasset'))) {
    return '同名资源已存在，将换名重试';
  }
  return `${msg}（${joined}）`;
}

function buildCdnUrl(config, tag, assetName, githubAssetUrl) {
  const owner = String(config.owner || '');
  const repo = String(config.repo || '');
  let tpl = String(config.urlTemplate || config.url_template || '').trim();
  if (!tpl) {
    tpl = 'https://github.com/{owner}/{repo}/releases/download/{tag}/{name}';
  }
  let url = tpl
    .replaceAll('{owner}', owner)
    .replaceAll('{repo}', repo)
    .replaceAll('{tag}', tag)
    .replaceAll('{name}', assetName);
  const prefix = String(config.cdnPrefix || config.cdn_prefix || '').trim().replace(/\/+$/, '');
  if (prefix) {
    if (prefix.includes('{url}')) return prefix.replaceAll('{url}', url);
    return `${prefix}/${url.replace(/^\//, '')}`;
  }
  return url || githubAssetUrl;
}

async function githubJson(method, url, token, { headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'TkSwarm-GithubCDN-Node',
      'X-GitHub-Api-Version': '2022-11-28',
      ...headers,
    },
    body,
    duplex: body && typeof body === 'object' && typeof body.pipe === 'function' ? 'half' : undefined,
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text.slice(0, 200) || `HTTP ${res.status}` };
  }
  if (!res.ok && !json.id) {
    const err = new Error(`GitHub API：${formatGithubError(json, res.status)}`);
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json;
}

function isEmptyRepoError(err) {
  const text = `${err?.message || ''} ${JSON.stringify(err?.payload || {})}`.toLowerCase();
  return text.includes('repository is empty') || text.includes('git repository is empty');
}

function isAlreadyExists(err, field) {
  const errors = err?.payload?.errors;
  if (!Array.isArray(errors)) {
    const t = String(err?.message || '').toLowerCase();
    return t.includes('already_exists') && (!field || t.includes(String(field).toLowerCase()));
  }
  return errors.some((e) => {
    if (String(e?.code || '') !== 'already_exists') return false;
    if (!field) return true;
    return String(e?.field || '') === field;
  });
}

/** 空仓库无法建 Release：写入 README 做首次提交 */
async function bootstrapEmptyRepo(owner, repo, token) {
  const contentUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/README.md`;
  const body = Buffer.from(
    `# ${repo}\n\nTkSwarm video CDN storage. Auto-initialized.\n`,
    'utf8'
  ).toString('base64');
  try {
    await githubJson('PUT', contentUrl, token, {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'chore: init repo for TkSwarm CDN releases',
        content: body,
      }),
    });
  } catch (e) {
    // 已有 README 等冲突时忽略，交给后续 ensureRelease
    if (Number(e.status) === 422 && isAlreadyExists(e)) return;
    throw e;
  }
}

async function getReleaseByTag(owner, repo, token, tag) {
  const getUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/tags/${encodeURIComponent(tag)}`;
  try {
    const existing = await githubJson('GET', getUrl, token);
    if (existing?.id) return existing;
  } catch (e) {
    if (Number(e.status) !== 404) throw e;
  }
  return null;
}

async function ensureRelease(owner, repo, token, tag) {
  const existing = await getReleaseByTag(owner, repo, token, tag);
  if (existing) return existing;

  const createUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases`;
  const payload = {
    tag_name: tag,
    name: tag,
    body: `TkSwarm video CDN release ${tag}`,
    draft: false,
    prerelease: false,
  };

  const tryCreate = async () => githubJson('POST', createUrl, token, {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let created;
  try {
    created = await tryCreate();
  } catch (e) {
    if (isAlreadyExists(e, 'tag_name')) {
      const again = await getReleaseByTag(owner, repo, token, tag);
      if (again) return again;
    }
    if (isEmptyRepoError(e)) {
      await bootstrapEmptyRepo(owner, repo, token);
      // 等 GitHub 索引提交
      await new Promise((r) => setTimeout(r, 1200));
      created = await tryCreate();
    } else {
      throw e;
    }
  }

  if (created?.id) return created;
  const again = await getReleaseByTag(owner, repo, token, tag);
  if (again?.id) return again;
  throw new Error(String(created?.message || '创建 Release 失败'));
}

async function uploadAsset(owner, repo, token, releaseId, assetName, filePath) {
  const uploadUrl = `https://uploads.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/${releaseId}/assets?name=${encodeURIComponent(assetName)}`;
  const size = fs.statSync(filePath).size;
  if (size <= 0) {
    throw Object.assign(new Error('视频文件大小为 0，无法上传'), { status: 422 });
  }
  const stream = fs.createReadStream(filePath);
  try {
    return await githubJson('POST', uploadUrl, token, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(size),
      },
      body: stream,
    });
  } finally {
    stream.destroy();
  }
}

/**
 * @param {string} localPath
 * @param {{ preferredName?: string, materialId?: number, config?: object }} [opts]
 */
async function uploadLocalFile(localPath, opts = {}) {
  const abs = path.resolve(String(localPath || ''));
  if (!abs || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    throw Object.assign(new Error('本地视频文件不存在，无法上传 GitHub'), { status: 422 });
  }
  const config = opts.config || (await phpApi.get('/node/github-cdn/enabled'));
  if (!config) {
    throw Object.assign(new Error('未配置启用的 GitHub CDN，请先在「GitHub CDN」中启用一套配置'), { status: 422 });
  }
  const token = String(config.token || '').trim();
  const owner = String(config.owner || '').trim();
  const repo = String(config.repo || '').trim();
  if (!token) throw Object.assign(new Error('GitHub 配置缺少有效 Token'), { status: 422 });
  if (!owner || !repo) throw Object.assign(new Error('GitHub 配置缺少 owner/repo'), { status: 422 });

  const preferred = String(opts.preferredName || path.basename(abs));
  let ext = path.extname(preferred).replace(/^\./, '').toLowerCase();
  if (!ext) ext = path.extname(abs).replace(/^\./, '').toLowerCase() || 'mp4';
  const materialId = Number(opts.materialId || 0);

  let tagPrefix = String(config.tagPrefix || config.tag_prefix || 'videos').trim() || 'videos';
  tagPrefix = tagPrefix.replace(/[^a-zA-Z0-9._-]+/g, '-') || 'videos';
  const tag = `${tagPrefix}-${ymdChina()}`;

  const release = await ensureRelease(owner, repo, token, tag);
  const releaseId = Number(release.id || 0);
  if (!releaseId) throw new Error('无法创建或获取 GitHub Release');

  let assetName = `${materialId > 0 ? `m${materialId}-` : ''}${safeAssetBase(preferred)}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
  let asset;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      asset = await uploadAsset(owner, repo, token, releaseId, assetName, abs);
      break;
    } catch (e) {
      if (isAlreadyExists(e) && attempt < 2) {
        assetName = `${materialId > 0 ? `m${materialId}-` : ''}${safeAssetBase(preferred)}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
        continue;
      }
      throw e;
    }
  }
  if (!asset?.id) {
    throw new Error(String(asset?.message || '上传 Release Asset 失败'));
  }

  let githubAssetUrl = `https://github.com/${owner}/${repo}/releases/download/${tag}/${assetName}`;
  if (asset.browser_download_url) githubAssetUrl = String(asset.browser_download_url);
  const cdnUrl = buildCdnUrl(config, tag, assetName, githubAssetUrl) || githubAssetUrl;

  return {
    configId: Number(config.id || config.configId || 0),
    tag,
    assetName,
    githubAssetUrl,
    cdnUrl,
  };
}

module.exports = {
  uploadLocalFile,
  buildCdnUrl,
  formatGithubError,
};
