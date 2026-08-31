const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');
const { z } = require('zod');
const { db } = require('../db');
const { ok, fail } = require('../http');
const router = express.Router();
const uploadDir = path.resolve(__dirname, '../../data/materials');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ storage: multer.diskStorage({ destination: uploadDir, filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2,10)}${path.extname(file.originalname).toLowerCase()}`) }), limits: { fileSize: 500 * 1024 * 1024 } });
const materialSchema = z.object({
  name: z.string().trim().min(1).max(150),
  filePath: z.string().trim().max(1000).default(''),
  fileName: z.string().trim().max(255).default(''),
  mimeType: z.string().trim().max(100).default(''),
  sizeBytes: z.coerce.number().int().min(0).max(5_000_000_000).default(0),
  description: z.string().max(2000).default(''),
  tags: z.string().max(500).default(''),
  status: z.enum(['ready','disabled','missing']).default('ready'),
});
function map(row) { return { ...row, filePath: undefined, sizeBytes: row.size_bytes }; }
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM materials ORDER BY id DESC').all().map(map);
  return ok(res, rows);
});
router.post('/', upload.single('file'), (req, res) => {
  const body = { ...req.body };
  if (req.file) {
    if (!req.file.mimetype.startsWith('video/')) { fs.unlink(req.file.path, () => {}); return fail(res, '只能上传视频文件', 415); }
    body.name = String(body.name || path.parse(req.file.originalname).name).trim();
    body.filePath = req.file.path;
    body.fileName = req.file.originalname;
    body.mimeType = req.file.mimetype;
    body.sizeBytes = req.file.size;
    body.status = 'ready';
  }
  const b = materialSchema.parse(body);
  try {
    const r = db.prepare(`INSERT INTO materials(name,file_path,file_name,mime_type,size_bytes,description,tags,status) VALUES (@name,@filePath,@fileName,@mimeType,@sizeBytes,@description,@tags,@status)`).run(b);
    return ok(res, { id: r.lastInsertRowid, ...b, filePath: undefined }, '素材已上传', 201);
  } catch (error) {
    if (req.file) fs.unlink(req.file.path, () => {});
    throw error;
  }
});
router.put('/:id', (req, res) => {
  const old = db.prepare('SELECT id FROM materials WHERE id=?').get(req.params.id);
  if (!old) return fail(res, '素材不存在', 404);
  const b = materialSchema.parse(req.body);
  db.prepare(`UPDATE materials SET name=@name,file_path=@filePath,file_name=@fileName,mime_type=@mimeType,size_bytes=@sizeBytes,description=@description,tags=@tags,status=@status,updated_at=CURRENT_TIMESTAMP WHERE id=@id`).run({ ...b, id: old.id });
  return ok(res, { id: old.id, ...b }, '素材已更新');
});
router.post('/:id/check', (req, res) => { const row=db.prepare('SELECT id,file_path FROM materials WHERE id=?').get(req.params.id); if(!row)return fail(res,'素材不存在',404); const exists=Boolean(row.file_path&&fs.existsSync(row.file_path)); db.prepare('UPDATE materials SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(exists?'ready':'missing',row.id); return ok(res,{id:row.id,exists,status:exists?'ready':'missing'},exists?'素材文件存在':'未找到素材文件'); });
router.delete('/:id', (req, res) => {
  const r = db.prepare('DELETE FROM materials WHERE id=?').run(req.params.id);
  if (!r.changes) return fail(res, '素材不存在', 404);
  return ok(res, null, '素材已删除');
});
module.exports = router;
