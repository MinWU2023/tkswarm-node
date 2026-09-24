function splitDashed(line) {
  return String(line).split('----').map(part => part.trim());
}

function parseCookieUsername(cookie) {
  const match = String(cookie || '').match(/(?:^|;\s*)(?:sessionid|uid_tt|sid_tt)=([^;]+)/i);
  if (!match) return '';
  try {
    const decoded = decodeURIComponent(match[1]);
    const user = decoded.match(/[a-zA-Z0-9._]{3,64}/);
    return user ? user[0] : `ck_${Date.now().toString(36)}`;
  } catch {
    return `ck_${Date.now().toString(36)}`;
  }
}

function parseJsonLine(line) {
  const data = JSON.parse(line);
  const username = data.username || data.user || data.account || data.uniqueId || data.handle || '';
  const password = data.password || data.pwd || '';
  const totp = (data.totp || data.totpSecret || data['2fa'] || data.twofa || '').toString().replace(/\s+/g, '').toUpperCase();
  const cookie = data.cookie || data.cookies || data.ck || '';
  if (!username && !cookie) throw new Error('JSON 缺少 username/cookie');
  return {
    username: username || parseCookieUsername(cookie) || `json_${Date.now().toString(36)}`,
    password,
    totpSecret: totp,
    cookie: typeof cookie === 'string' ? cookie : JSON.stringify(cookie),
    country: data.country || data.region || '',
    nickname: data.nickname || data.nickName || data.displayName || '',
  };
}

function parseLine(line, format = 'auto') {
  const text = String(line || '').trim();
  if (!text || text.startsWith('#')) return null;
  if (format === 'json' || (format === 'auto' && text.startsWith('{'))) return parseJsonLine(text);

  const parts = splitDashed(text);
  const resolved = format === 'auto'
    ? (parts.length >= 3 && /^[A-Z2-7]+=*$/i.test(parts[2].replace(/\s+/g, '')) ? 'user_pass_2fa'
      : parts.length >= 3 && /sessionid|sid_tt|tt_chain/i.test(parts[2]) ? 'user_pass_ck'
      : parts.length === 2 && /sessionid|sid_tt|tt_chain/i.test(parts[1]) ? 'user_ck'
      : parts.length === 1 && /sessionid|sid_tt/i.test(parts[0]) ? 'ck_only'
      : parts.length >= 2 ? 'user_pass' : 'user_pass')
    : format;

  if (resolved === 'ck_only') {
    const cookie = parts[0];
    if (!/sessionid|sid_tt/i.test(cookie)) throw new Error('CK 中未找到 sessionid');
    return { username: parseCookieUsername(cookie), password: '', totpSecret: '', cookie, country: '', nickname: '' };
  }
  if (resolved === 'user_ck') {
    if (parts.length < 2) throw new Error('格式应为 账号----CK');
    return { username: parts[0], password: '', totpSecret: '', cookie: parts.slice(1).join('----'), country: '', nickname: '' };
  }
  if (resolved === 'user_pass_ck') {
    if (parts.length < 3) throw new Error('格式应为 账号----密码----CK');
    return { username: parts[0], password: parts[1], totpSecret: '', cookie: parts.slice(2).join('----'), country: '', nickname: '' };
  }
  if (resolved === 'user_pass') {
    if (parts.length < 2) throw new Error('格式应为 账号----密码');
    return { username: parts[0], password: parts[1], totpSecret: '', cookie: '', country: '', nickname: '' };
  }
  if (resolved === 'user_pass_2fa') {
    if (parts.length < 3) throw new Error('格式应为 账号----密码----2FA');
    const totpSecret = parts[2].replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z2-7]+=*$/.test(totpSecret) || totpSecret.length < 16) throw new Error('2FA 密钥不是有效的 Base32');
    return { username: parts[0], password: parts[1], totpSecret, cookie: parts.slice(3).join('----') || '', country: '', nickname: '' };
  }
  if (resolved === 'email_pass_user') {
    if (parts.length < 3) throw new Error('格式应为 邮箱----密码----用户名----国家----...');
    return { username: parts[2] || parts[0], password: parts[1], totpSecret: '', cookie: '', country: parts[3] || '', nickname: '', email: parts[0] };
  }
  throw new Error(`不支持的导入格式：${resolved}`);
}

const FORMAT_OPTIONS = [
  { id: 'auto', label: '自动识别' },
  { id: 'user_pass', label: '账号----密码' },
  { id: 'user_pass_2fa', label: '账号----密码----2FA' },
  { id: 'user_pass_ck', label: '账号----密码----CK' },
  { id: 'user_ck', label: '账号----CK' },
  { id: 'ck_only', label: '仅 CK' },
  { id: 'email_pass_user', label: '邮箱----密码----用户名----国家' },
  { id: 'json', label: 'JSON 全参（每行）' },
];

module.exports = { parseLine, FORMAT_OPTIONS };
