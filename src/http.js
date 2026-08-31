function ok(res, data = null, message = 'ok', status = 200) {
  return res.status(status).json({ success: true, message, data });
}

function fail(res, message, status = 400, details) {
  return res.status(status).json({ success: false, message, ...(details ? { details } : {}) });
}

function pagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize, 10) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function listResult(rows, total, page, pageSize) {
  return { items: rows, total, page, pageSize, pages: Math.ceil(total / pageSize) };
}

module.exports = { ok, fail, pagination, listResult };
