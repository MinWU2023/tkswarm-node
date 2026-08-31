const { ZodError } = require('zod');
const { fail } = require('../http');

function notFound(req, res) {
  return fail(res, `接口不存在：${req.method} ${req.originalUrl}`, 404);
}

function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  req.log?.error({ err: error }, 'request failed');

  if (error instanceof ZodError) {
    return fail(res, '请求参数不正确', 422, error.issues);
  }
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return fail(res, '记录已存在，请检查唯一字段', 409);
  }
  if (error.code?.startsWith('SQLITE_CONSTRAINT')) {
    return fail(res, '数据约束校验失败', 409);
  }
  return fail(res, process.env.NODE_ENV === 'production' ? '服务器内部错误' : error.message, 500);
}

module.exports = { notFound, errorHandler };
