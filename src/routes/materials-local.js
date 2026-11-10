/**
 * 线下素材：视频不上传 PHP，只把本机绝对路径写入库。
 * 预览 / 检查 / 发布均由本机 Node 读盘。
 */
const express = require('express');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const multer = require('multer');
const phpApi = require('../services/php-api');
const githubCdn = require('../services/github-cdn');
const { ok, fail } = require('../http');

const router = express.Router();

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.flv']);
const localRoot = path.resolve(__dirname, '../../data/local-materials');
fs.mkdirSync(localRoot, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, localRoot),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.mp4';
      cb(null, `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = String(file.mimetype || '').toLowerCase();
    if (VIDEO_EXTS.has(ext) || mime.startsWith('video/')) return cb(null, true);
    cb(new Error('仅支持视频文件'));
  },
});

function absPath(p) {
  return path.resolve(String(p || '').trim());
}

function isVideoFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return VIDEO_EXTS.has(ext) && fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function mimeOf(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.m4v': 'video/x-m4v',
    '.flv': 'video/x-flv',
  };
  return map[ext] || 'video/mp4';
}

async function extractCoverBase64(videoPath) {
  if (!videoPath || !fs.existsSync(videoPath)) return '';
  const out = path.join(os.tmpdir(), `tk-mat-cover-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.jpg`);
  await new Promise((resolve) => {
    const args = ['-y', '-ss', '0.8', '-i', videoPath, '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '4', out];
    const child = spawn('ffmpeg', args, { windowsHide: true, stdio: 'ignore' });
    const t = setTimeout(() => {
      try { child.kill(); } catch { /* ignore */ }
      resolve();
    }, 20000);
    child.on('close', () => {
      clearTimeout(t);
      resolve();
    });
    child.on('error', () => {
      clearTimeout(t);
      resolve();
    });
  });
  try {
    const st = await fsp.stat(out).catch(() => null);
    if (!st || st.size < 64) {
      await fsp.unlink(out).catch(() => {});
      return '';
    }
    const bin = await fsp.readFile(out);
    await fsp.unlink(out).catch(() => {});
    return `data:image/jpeg;base64,${bin.toString('base64')}`;
  } catch {
    await fsp.unlink(out).catch(() => {});
    return '';
  }
}

async function createMaterialOnPhp(meta) {
  return phpApi.post('/materials', {
    name: meta.name,
    filePath: meta.filePath,
    file_path: meta.filePath,
    fileName: meta.fileName,
    mimeType: meta.mimeType,
    sizeBytes: meta.sizeBytes,
    tags: meta.tags || 'local',
    description: meta.description || '',
    shareTitle: meta.shareTitle || '',
    shareCaption: meta.shareCaption || '',
    coverBase64: meta.coverBase64 || '',
    status: 'ready',
  });
}

/** 本机路径缓存：video 的 Range 请求很频繁，避免每次都打远程 PHP */
const pathCache = new Map(); // id -> { filePath, mime, expires, mat }

function rememberPath(id, filePath, mat) {
  const mid = Number(id);
  if (!mid || !filePath) return;
  pathCache.set(mid, {
    filePath,
    mime: mat?.mime_type || mat?.mimeType || mimeOf(filePath),
    mat: mat || null,
    expires: Date.now() + 10 * 60 * 1000,
  });
}

function forgetPath(id) {
  pathCache.delete(Number(id));
}

async function resolveLocalFilePath(materialId, { bypassCache = false } = {}) {
  const mid = Number(materialId);
  if (!bypassCache) {
    const hit = pathCache.get(mid);
    if (hit && hit.expires > Date.now() && hit.filePath) {
      // 文件被挪走时让缓存失效
      if (fs.existsSync(hit.filePath)) {
        return { mat: hit.mat || { mime_type: hit.mime, mimeType: hit.mime }, filePath: hit.filePath };
      }
      forgetPath(mid);
    }
  }
  const mat = await phpApi.get(`/node/materials/${mid}`).catch(() => null);
  if (!mat) throw Object.assign(new Error('素材不存在'), { status: 404 });
  const filePath = String(mat.file_path || mat.filePath || '').trim();
  if (filePath) rememberPath(mid, filePath, mat);
  return { mat, filePath };
}

function sendFileRange(req, res, filePath, mime) {
  const stat = fs.statSync(filePath);
  const size = stat.size;
  const range = String(req.headers.range || '');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', mime || 'video/mp4');
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
  if (range && /^bytes=/i.test(range)) {
    const m = range.match(/bytes=(\d*)-(\d*)/);
    let start = m?.[1] ? Number(m[1]) : 0;
    let end = m?.[2] ? Number(m[2]) : size - 1;
    if (Number.isNaN(start)) start = 0;
    if (Number.isNaN(end) || end >= size) end = size - 1;
    if (start > end || start >= size) {
      res.status(416).setHeader('Content-Range', `bytes */${size}`).end();
      return;
    }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    res.setHeader('Content-Length', String(end - start + 1));
    fs.createReadStream(filePath, { start, end }).pipe(res);
    return;
  }
  res.setHeader('Content-Length', String(size));
  fs.createReadStream(filePath).pipe(res);
}

/** 登记单个本机路径（不拷贝） */
router.post('/register', async (req, res) => {
  try {
    const filePath = absPath(req.body?.filePath || req.body?.file_path || req.body?.path || '');
    if (!filePath) return fail(res, '请提供本机视频路径 filePath', 422);
    if (!isVideoFile(filePath)) return fail(res, `本机找不到视频文件：${filePath}`, 404);
    const st = fs.statSync(filePath);
    const coverIn = String(req.body?.coverBase64 || req.body?.cover_base64 || '').trim();
    const coverBase64 = coverIn || (await extractCoverBase64(filePath));
    const mat = await createMaterialOnPhp({
      name: String(req.body?.name || path.basename(filePath, path.extname(filePath))),
      filePath,
      fileName: path.basename(filePath),
      mimeType: mimeOf(filePath),
      sizeBytes: st.size,
      tags: String(req.body?.tags || 'local'),
      description: String(req.body?.description || `线下素材 ${filePath}`),
      shareTitle: String(req.body?.shareTitle || req.body?.share_title || ''),
      shareCaption: String(req.body?.shareCaption || req.body?.share_caption || ''),
      coverBase64,
    });
    if (mat?.id) rememberPath(mat.id, filePath, mat);
    return ok(res, mat, '已登记本机素材');
  } catch (e) {
    return fail(res, e.message || '登记失败', e.status || 500);
  }
});

/** 批量登记路径 / 扫描文件夹 */
router.post('/import-folder', async (req, res) => {
  try {
    const folder = absPath(req.body?.folderPath || req.body?.folder_path || '');
    const paths = Array.isArray(req.body?.paths) ? req.body.paths.map((p) => absPath(p)).filter(Boolean) : [];
    let files = [];
    if (folder) {
      if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
        return fail(res, `文件夹不存在：${folder}`, 404);
      }
      for (const name of fs.readdirSync(folder)) {
        const full = path.join(folder, name);
        if (isVideoFile(full)) files.push(full);
      }
      files.sort();
    } else if (paths.length) {
      files = paths.filter((p) => isVideoFile(p));
    } else {
      return fail(res, '请提供 folderPath 或 paths', 422);
    }
    if (!files.length) return fail(res, '未找到可导入的视频文件', 422);

    let imported = 0;
    let skipped = 0;
    const items = [];
    for (const filePath of files) {
      try {
        const st = fs.statSync(filePath);
        const coverBase64 = await extractCoverBase64(filePath);
        const mat = await createMaterialOnPhp({
          name: path.basename(filePath, path.extname(filePath)),
          filePath,
          fileName: path.basename(filePath),
          mimeType: mimeOf(filePath),
          sizeBytes: st.size,
          tags: String(req.body?.tags || 'local-folder'),
          description: folder ? `来自本机文件夹 ${folder}` : '线下素材',
          coverBase64,
        });
        imported += 1;
        if (mat?.id) rememberPath(mat.id, filePath, mat);
        items.push(mat);
      } catch (e) {
        skipped += 1;
        items.push({ error: e.message || '失败', filePath });
      }
    }
    return ok(res, {
      imported,
      skipped,
      total: files.length,
      folderPath: folder || '',
      items,
      message: `本机导入完成：新增 ${imported}，跳过/失败 ${skipped}`,
    }, `本机导入完成：新增 ${imported}，跳过/失败 ${skipped}`);
  } catch (e) {
    return fail(res, e.message || '导入失败', e.status || 500);
  }
});

/**
 * 浏览器选文件：只落到本机 Node 目录，不上传 PHP。
 * 然后把本机绝对路径写入 materials.file_path。
 */
router.post('/ingest', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return fail(res, err.message || '接收文件失败', 422);
    try {
      const file = req.file;
      if (!file?.path) return fail(res, '未检测到视频文件', 400);
      const filePath = absPath(file.path);
      const coverIn = String(req.body?.coverBase64 || req.body?.cover_base64 || '').trim();
      const coverBase64 = coverIn || (await extractCoverBase64(filePath));
      const mat = await createMaterialOnPhp({
        name: String(req.body?.name || path.basename(file.originalname || filePath, path.extname(filePath))),
        filePath,
        fileName: file.originalname || path.basename(filePath),
        mimeType: file.mimetype || mimeOf(filePath),
        sizeBytes: file.size || (fs.statSync(filePath).size),
        tags: String(req.body?.tags || 'local'),
        description: String(req.body?.description || '本机线下素材'),
        shareTitle: String(req.body?.shareTitle || req.body?.share_title || ''),
        shareCaption: String(req.body?.shareCaption || req.body?.share_caption || ''),
        coverBase64,
      });
      if (mat?.id) rememberPath(mat.id, filePath, mat);
      return ok(res, mat, '已添加本机素材');
    } catch (e) {
      return fail(res, e.message || '入库失败', e.status || 500);
    }
  });
});

/** 本机存在性检查（发布/预览前）；预览勿 sync，避免等远程 PHP */
router.post('/:id/check', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const sync = String(req.body?.sync || req.query?.sync || '') === '1';
    const { mat, filePath } = await resolveLocalFilePath(id, { bypassCache: true });
    const exists = !!(filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile());
    const sizeBytes = exists ? fs.statSync(filePath).size : 0;
    if (exists) rememberPath(id, filePath, mat);
    else forgetPath(id);
    // 仅显式 sync=1 时回写 PHP（发布前等）；预览默认跳过
    if (sync && mat?.id) {
      phpApi.put(`/materials/${id}`, {
        name: mat.name || path.basename(filePath || String(id)),
        status: exists ? 'ready' : 'missing',
        filePath: filePath || mat.file_path || mat.filePath || '',
        fileName: mat.file_name || mat.fileName || '',
        mimeType: mat.mime_type || mat.mimeType || 'video/mp4',
        sizeBytes: sizeBytes || mat.size_bytes || mat.sizeBytes || 0,
      }).catch(() => {});
    }
    return ok(res, {
      id,
      exists,
      status: exists ? 'ready' : 'missing',
      sizeBytes,
      filePath: exists ? filePath : (filePath || ''),
      message: exists ? '本机素材文件存在' : (filePath ? `本机找不到文件：${filePath}` : '素材未绑定本机路径'),
    }, exists ? '本机素材文件存在' : '未找到本机素材文件');
  } catch (e) {
    return fail(res, e.message || '检查失败', e.status || 500);
  }
});

/** 本机流式预览 */
router.get('/:id/stream', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { mat, filePath } = await resolveLocalFilePath(id);
    if (!filePath) return fail(res, '素材未绑定本机路径', 404);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return fail(res, `本机找不到素材文件：${filePath}`, 404);
    }
    const mime = mat.mime_type || mat.mimeType || mimeOf(filePath);
    sendFileRange(req, res, filePath, mime);
  } catch (e) {
    if (!res.headersSent) fail(res, e.message || '预览失败', e.status || 500);
  }
});

/**
 * 本机读盘 → 直传 GitHub → 回写 PHP 链接。
 * 前端仍调 /api/materials/:id/github-upload，由 server.js 转到此处。
 */
router.post('/:id/github-upload', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return fail(res, '素材 ID 无效', 422);
    const { mat, filePath } = await resolveLocalFilePath(id, { bypassCache: true });
    const cdnUrl = String(mat?.cdn_url || mat?.cdnUrl || '').trim();
    const githubAssetUrl = String(mat?.github_asset_url || mat?.githubAssetUrl || '').trim();
    if (cdnUrl || githubAssetUrl) {
      const bound = await phpApi.get(`/node/materials/${id}`).catch(() => mat);
      return ok(res, bound || mat, '已有 GitHub/CDN 链接，无需重复上传');
    }
    if (!filePath) return fail(res, '素材未绑定本机路径，无法上传 GitHub', 422);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return fail(res, `本机找不到视频文件：${filePath}`, 404);
    }
    rememberPath(id, filePath, mat);
    const preferred = String(mat?.file_name || mat?.fileName || path.basename(filePath));
    const up = await githubCdn.uploadLocalFile(filePath, {
      preferredName: preferred,
      materialId: id,
    });
    const saved = await phpApi.post(`/materials/${id}/github-bind`, {
      cdnUrl: up.cdnUrl,
      githubAssetUrl: up.githubAssetUrl,
      githubConfigId: up.configId,
      cdn_url: up.cdnUrl,
      github_asset_url: up.githubAssetUrl,
      github_config_id: up.configId,
    });
    return ok(res, saved || {
      ...mat,
      id,
      cdnUrl: up.cdnUrl,
      githubAssetUrl: up.githubAssetUrl,
      githubConfigId: up.configId,
    }, '已上传到 GitHub');
  } catch (e) {
    return fail(res, e.message || 'GitHub 上传失败', e.status || 500);
  }
});

module.exports = { router, localRoot };
