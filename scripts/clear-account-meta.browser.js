/**
 * 浏览器控制台脚本：清空所有账号的关联用户、关联企业、关联行业（随 owner/company 清空），
 * 并删除全部账号分组。
 *
 * 使用方式：
 * 1. 用超级管理员账号登录 TkSwarm 后台（若正在切换身份，请先切回超管本人）
 * 2. 打开开发者工具 Console，粘贴本文件全部内容并回车
 *
 * 依赖：已部署 POST /api/accounts/maintenance/clear-all-meta
 */
(async function clearAccountMeta() {
  const app = window.app;
  if (!app || typeof app.api !== 'function') {
    alert('未找到 app.api，请先在 TkSwarm 后台页面登录后再执行');
    return;
  }

  const loginUser = app.authLoginUser || app.authUser;
  const isSuper = !!(loginUser?.isSuper || app.authIsSuper);
  if (!isSuper) {
    alert('仅超级管理员（登录账号）可执行此操作');
    return;
  }
  if (app.authActingAs) {
    const ok = confirm('当前处于身份切换中，建议先切回超管本人再执行。\n仍要继续吗？');
    if (!ok) return;
  }

  const summary = [
    '将执行以下不可恢复操作：',
    '· 清空所有账号的关联用户（owner_id）',
    '· 清空所有账号的关联企业（company_id）',
    '· 清空所有账号的关联行业（由企业/用户推导，随上两项清空）',
    '· 清空所有账号的分组归属（group_id）',
    '· 删除全部账号分组数据',
    '',
    '确定继续？',
  ].join('\n');
  if (!confirm(summary)) {
    console.log('[clear-account-meta] 已取消');
    return;
  }

  const typed = prompt('请输入 CLEAR_ALL 确认执行');
  if (typed !== 'CLEAR_ALL') {
    alert('确认文字不匹配，已取消');
    return;
  }

  console.log('[clear-account-meta] 开始清空…');
  try {
    const result = await app.api('/accounts/maintenance/clear-all-meta', {
      method: 'POST',
      body: JSON.stringify({ confirm: 'CLEAR_ALL' }),
    });
    console.log('[clear-account-meta] 完成', result);
    if (typeof app.toast === 'function') {
      app.toast(`已清空：${result.accountsUpdated ?? 0} 个账号，删除 ${result.groupsDeleted ?? 0} 个分组`);
    } else {
      alert(`完成：${result.accountsUpdated ?? 0} 个账号已清空关联，${result.groupsDeleted ?? 0} 个分组已删除`);
    }
    if (typeof app.refresh === 'function') app.refresh();
  } catch (e) {
    console.error('[clear-account-meta] 失败', e);
    alert('执行失败: ' + (e?.message || e));
  }
})();
