/**
 * 客户委托任务：从 API CDN/GitHub 流下载视频+封面到本机目录。
 */
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const phpApi = require('./php-api');

function sanitizeFileName(name) {
  const raw = String(name || 'video.mp4').trim() || 'video.mp4';
  const cleaned = raw.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/^\.+/, '');
  return cleaned || 'video.mp4';
}

function coverNameFromVideo(videoName, preferred) {
  if (preferred) return sanitizeFileName(preferred);
  const base = String(videoName || 'video').replace(/\.[^.]+$/, '');
  return sanitizeFileName(`${base}-cover.jpg`);
}

/**
 * @param {number|string} taskId
 * @param {{ downloadDir: string, saveDirSetting?: boolean }} options
 */
async function downloadCustomerTaskVideo(taskId, options = {}) {
  const id = Number(taskId);
  if (!Number.isInteger(id) || id < 1) {
    throw new Error('无效任务 ID');
  }
  const downloadDir = path.resolve(String(options.downloadDir || '').trim());
  if (!downloadDir || downloadDir === path.parse(downloadDir).root) {
    throw new Error('请填写有效的本地下载目录（绝对路径）');
  }

  const meta = await phpApi.get(`/node/tasks/${id}/cdn-meta`);
  const fileName = sanitizeFileName(meta?.fileName || `task-${id}.mp4`);
  const coverFileName = coverNameFromVideo(fileName, meta?.coverFileName || '');
  await fsp.mkdir(downloadDir, { recursive: true });
  const destFile = path.join(downloadDir, fileName);
  const destCover = path.join(downloadDir, coverFileName);

  let skipped = false;
  if (fs.existsSync(destFile) && fs.statSync(destFile).isFile() && fs.statSync(destFile).size > 0) {
    skipped = true;
  } else {
    await phpApi.download(`/node/tasks/${id}/cdn-stream`, destFile, {
      timeoutMs: 15 * 60 * 1000,
      totalBytes: Number(meta?.sizeBytes || 0) || 0,
    });
    if (!fs.existsSync(destFile) || fs.statSync(destFile).size < 1) {
      throw new Error('下载后视频文件为空或不存在');
    }
  }

  let localCoverPath = '';
  let coverSkipped = false;
  const hasCoverRemote = !!(meta?.coverRemoteUrl || meta?.coverCdnUrl || meta?.coverGithubAssetUrl || meta?.hasPhpCoverFile);
  if (hasCoverRemote) {
    if (fs.existsSync(destCover) && fs.statSync(destCover).isFile() && fs.statSync(destCover).size > 0) {
      coverSkipped = true;
      localCoverPath = destCover;
    } else {
      try {
        await phpApi.download(`/node/tasks/${id}/cdn-stream?asset=cover`, destCover, {
          timeoutMs: 5 * 60 * 1000,
        });
        if (fs.existsSync(destCover) && fs.statSync(destCover).size > 0) {
          localCoverPath = destCover;
        }
      } catch (e) {
        // 封面失败不阻断视频；上层仍可发布
        localCoverPath = '';
      }
    }
  }

  const marked = await phpApi.post(`/node/tasks/${id}/mark-video-downloaded`, {
    localVideoPath: destFile,
    localCoverPath,
    skipped,
    coverSkipped,
  });

  if (options.saveDirSetting !== false) {
    try {
      await phpApi.put('/settings', { video_download_dir: downloadDir });
    } catch {
      try {
        await phpApi.post('/settings', { video_download_dir: downloadDir });
      } catch { /* ignore */ }
    }
  }

  return {
    taskId: id,
    materialId: Number(meta?.materialId || marked?.materialId || 0) || 0,
    fileName,
    coverFileName: localCoverPath ? coverFileName : '',
    localVideoPath: destFile,
    localCoverPath,
    downloadDir,
    skipped,
    coverSkipped,
    videoPulled: true,
  };
}

module.exports = { downloadCustomerTaskVideo, sanitizeFileName };
