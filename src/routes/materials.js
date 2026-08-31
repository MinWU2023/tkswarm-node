const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const multer = require('multer');
const { z } = require('zod');
const { db } = require('../db');
const { ok, fail } = require('../http');
const router = express.Router();
const uploadDir = path.resolve(__dirname, '../../data/materials');
fs.mkdirSync(uploadDir, { recursive: true });
try { db.exec('ALTER TABLE materials ADD COLUMN sha256 TEXT NOT NULL DEFAULT \'\''); } catch {}
const upload = multer({ storage: multer.diskStorage({ destination: uploadDir, filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2,10)}${path.extname(file.originalname).toLowerCase()}`) }), limits: { fileSize: 500 * 1024 * 1024 } });
const materialSchema = z.object({
  sha256: z.string().regex(/^[a-f0-9]{64}$/).default(''),
  name: z.string().trim().min(1).max(150),
  filePath: z.string().trim().max(1000).default(''),
  fileName: z.string().trim().max(255).default(''),
  mimeType: z.string().trim().max(100).default(''),
  sizeBytes: z.coerce.number().int().min(0).max(5_000_000_000).default(0),
  description: z.string().max(2000).default(''),
  tags: z.string().max(500).default(''),
  status: z.enum(['ready','disabled','missing']).default('ready'),
});
function decodeName(value) {
  const text = String(value || '');
  if (!/[ÃÂæåçéèêëïðñòóôõöøùúûü]/.test(text)) return text;
  try {
    const decoded = Buffer.from(text, 'latin1').toString('utf8');
    return decoded.includes('�') ? text : decoded;
  } catch { return text; }
}
function repairNames() {
  const rows = db.prepare('SELECT id,name,file_name FROM materials').all();
  const update = db.prepare('UPDATE materials SET name=?,file_name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?');
  db.transaction(() => rows.forEach(row => { const name=decodeName(row.name), fileName=decodeName(row.file_name); if(name!==row.name||fileName!==row.file_name) update.run(name,fileName,row.id); }))();
}
repairNames();
function map(row) { const { file_path, ...safe } = row; return { ...safe, name: decodeName(row.name), file_name: decodeName(row.file_name), sizeBytes: row.size_bytes }; }
function sha256(filePath) { return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex'); }
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM materials ORDER BY id DESC').all().map(map);
  return ok(res, rows);
});
router.post('/', upload.single('file'), (req, res) => {
  const body = { ...req.body };
  if (req.file) {
    if (!req.file.mimetype.startsWith('video/')) { fs.unlink(req.file.path, () => {}); return fail(res, '只能上传视频文件', 415); }
    const originalName = decodeName(req.file.originalname);
    body.name = String(body.name || path.parse(originalName).name).trim();
    body.filePath = req.file.path;
    body.fileName = originalName;
    body.mimeType = req.file.mimetype;
    body.sizeBytes = req.file.size;
    body.status = 'ready';
    body.sha256 = sha256(req.file.path);
  }
  const b = materialSchema.parse(body);
  try {
    if (b.sha256) { const duplicate=db.prepare('SELECT id,name FROM materials WHERE sha256=?').get(b.sha256); if (duplicate) { if (req.file) fs.unlink(req.file.path, () => {}); return fail(res, `素材与“${duplicate.name}”内容重复`, 409); } }
    const r = db.prepare(`INSERT INTO materials(name,file_path,file_name,mime_type,size_bytes,description,tags,status,sha256) VALUES (@name,@filePath,@fileName,@mimeType,@sizeBytes,@description,@tags,@status,@sha256)`).run(b);
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
router.get('/:id/stream', (req, res) => { const row=db.prepare('SELECT file_path,mime_type,file_name FROM materials WHERE id=?').get(req.params.id); if(!row||!row.file_path||!fs.existsSync(row.file_path)) return res.status(404).send('素材文件不存在'); const stat=fs.statSync(row.file_path), range=req.headers.range; res.setHeader('Content-Type',row.mime_type||'video/mp4'); res.setHeader('Accept-Ranges','bytes'); res.setHeader('Content-Disposition','inline'); if(!range){res.setHeader('Content-Length',stat.size);return fs.createReadStream(row.file_path).pipe(res);} const match=range.match(/bytes=(\d*)-(\d*)/); if(!match)return res.status(416).end(); const start=Number(match[1]||0),end=Math.min(Number(match[2]||stat.size-1),stat.size-1); if(start>end)return res.status(416).end(); res.status(206).set({ 'Content-Range':`bytes ${start}-${end}/${stat.size}`,'Content-Length':end-start+1 }); return fs.createReadStream(row.file_path,{start,end}).pipe(res); });
router.delete('/:id', (req, res) => {
  const r = db.prepare('DELETE FROM materials WHERE id=?').run(req.params.id);
  if (!r.changes) return fail(res, '素材不存在', 404);
  return ok(res, null, '素材已删除');
});
module.exports = router;
