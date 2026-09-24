const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');
const { ok, fail } = require('../http');

const router = express.Router();
const uploadDir = path.resolve(__dirname, '../../data/uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 9 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!file.mimetype.startsWith('image/') || !allowed.has(ext)) return cb(new Error('只能上传 png/jpg/webp/gif 图片'));
    cb(null, true);
  },
});

router.post('/images', (req, res, next) => {
  upload.array('files', 9)(req, res, (error) => {
    if (error) return fail(res, error.message || '上传失败', 422);
    const files = req.files || [];
    if (!files.length) return fail(res, '请选择图片', 400);
    return ok(res, {
      items: files.map(file => ({
        url: `/uploads/${file.filename}`,
        name: file.originalname,
        size: file.size,
      })),
    }, '图片已上传', 201);
  });
});

module.exports = { router, uploadDir };
