const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');
const { ok, fail } = require('../http');

const router = express.Router();
const uploadDir = path.resolve(__dirname, '../../data/uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const imageExts = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const videoExts = new Set(['.mp4']);
const allowed = new Set([...imageExts, ...videoExts]);
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${path.extname(file.originalname).toLowerCase()}`),
  }),
  // 短视频头像略放大；客户端仍会先校验 ≤6 秒
  limits: { fileSize: 20 * 1024 * 1024, files: 35 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = String(file.mimetype || '').toLowerCase();
    const isImage = mime.startsWith('image/') && imageExts.has(ext);
    const isVideo = (mime === 'video/mp4' || mime === 'application/mp4' || mime === 'video/quicktime') && videoExts.has(ext);
    if (!isImage && !isVideo) return cb(new Error('仅支持 JPG/PNG/WEBP/GIF 图片，或 MP4 视频'));
    cb(null, true);
  },
});

router.post('/images', (req, res, next) => {
  upload.array('files', 35)(req, res, (error) => {
    if (error) return fail(res, error.message || '上传失败', 422);
    const files = req.files || [];
    if (!files.length) return fail(res, '请选择文件', 400);
    return ok(res, {
      items: files.map(file => {
        const ext = path.extname(file.filename).toLowerCase();
        return {
          url: `/uploads/${file.filename}`,
          name: file.originalname,
          size: file.size,
          type: videoExts.has(ext) ? 'video' : 'image',
        };
      }),
    }, '文件已上传', 201);
  });
});

module.exports = { router, uploadDir };
