/**
 * 手机验证（短信 / 手机号验证码）人工协助门禁
 * ---------------------------------------------------------------------------
 * 背景：TikTok 在发布、私信等流程里会弹「手机号验证」弹框。
 * 自动化如果继续点，会出现两种坏结果：
 *   1) 弹框被点掉，任务继续跑，验证其实没做；
 *   2) 点了「用手机号验证」后，第二步弹框直接空白（iframe 还没加载就被操作）。
 *
 * 本模块做法：
 *   1) 每个浏览器连接装一个轻量轮询，专门识别「手机验证」弹框；
 *   2) 一旦识别到，把该连接标记为暂停，所有自动化动作（click / fill / press /
 *      goto / selectOption …）立刻抛 PHONE_VERIFY_WAIT，页面不再被自动化动一下，
 *      交给人在浏览器窗口里手动完成；
 *   3) 弹框消失（人处理完）后自动解除暂停，下一次任务重试就能继续；
 *   4) 旋转图片验证码（canvas）逻辑完全不受影响：识别到手机验证时只是不去调用它。
 */
const { publish: liveLog } = require('../live-log');

/** 会改变页面状态的动作方法：暂停期间一律拒绝 */
const ACTION_METHODS = new Set([
  'click', 'dblclick', 'tap', 'fill', 'type', 'press', 'pressSequentially',
  'check', 'uncheck', 'selectOption', 'hover', 'setInputFiles', 'dragAndDrop',
  'dispatchEvent', 'focus', 'selectText', 'setChecked',
  'goto', 'reload', 'goBack', 'goForward',
]);

/** 全局强特征：只在整页文本里匹配这些，避免「设置页有验证码字样」这类误判 */
const STRONG_PATTERNS = [
  /verify your phone/i,
  /phone (number )?verification/i,
  /verify (by|with) (phone|sms|text)/i,
  /手机(号)?验证/,
  /验证手机/,
];

/** 弱特征：只在弹框内部匹配 */
const DIALOG_PATTERNS = [
  /verification code/i,
  /enter the (6|six)[- ]?digit/i,
  /we (sent|will send) (you )?(a )?(code|text|sms)/i,
  /sms code/i,
  /text message/i,
  /短信验证码/,
  /输入验证码/,
  /验证码已发送/,
];

/** 手机验证弹框的 DOM 特征 */
const PHONE_SELECTORS = [
  'input[type="tel"]',
  '[data-e2e*="verify-phone"]',
  '[data-e2e*="phone-verify"]',
  '[data-e2e*="verify_phone"]',
  '[data-e2e*="phone-verification"]',
  '[class*="phone-verify"]',
  '[class*="verify-phone"]',
  '[class*="PhoneVerify"]',
  '[id*="phone-verify"]',
];

/**
 * 识别当前页面是否有手机验证弹框。
 * @returns {Promise<{present: boolean, reason: string}>}
 */
async function detectPhoneVerify(page) {
  if (!page || page.isClosed?.()) return { present: false, reason: '' };
  try {
    return await page.evaluate(({ selectors, strongSrc, dialogSrc }) => {
      const visible = (el) => {
        if (!el) return false;
        try {
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) return false;
          const st = window.getComputedStyle(el);
          return st.visibility !== 'hidden' && st.display !== 'none' && Number(st.opacity || 1) > 0.01;
        } catch { return false; }
      };
      const strong = strongSrc.map((s) => new RegExp(s, 'i'));
      const weak = dialogSrc.map((s) => new RegExp(s, 'i'));

      // 1) 手机号输入框 / 专用容器
      for (const s of selectors) {
        const el = document.querySelector(s);
        if (el && visible(el)) return { present: true, reason: `手机验证元素 ${s}` };
      }

      // 2) 弹框内文本
      const dialogs = Array.from(document.querySelectorAll(
        '[role="dialog"], .TUXModal, [class*="Modal" i], [class*="modal" i], [class*="Popup" i]'
      )).filter(visible);
      for (const d of dialogs) {
        const txt = String(d.innerText || '');
        if (!txt) continue;
        for (const p of [...strong, ...weak]) {
          if (p.test(txt)) {
            const hit = txt.match(p);
            return { present: true, reason: `弹框提示：${String(hit && hit[0] || '').slice(0, 40)}` };
          }
        }
      }

      // 3) 整页文本只认强特征
      const body = String(document.body && document.body.innerText || '').slice(0, 6000);
      for (const p of strong) {
        if (p.test(body)) {
          const hit = body.match(p);
          return { present: true, reason: `页面提示：${String(hit && hit[0] || '').slice(0, 40)}` };
        }
      }
      return { present: false, reason: '' };
    }, {
      selectors: PHONE_SELECTORS,
      strongSrc: STRONG_PATTERNS.map((p) => p.source),
      dialogSrc: DIALOG_PATTERNS.map((p) => p.source),
    });
  } catch {
    return { present: false, reason: '' };
  }
}

/** 暂停时抛出的错误：带上人机验证标记，任务会被挂起并通知右上角 */
function phoneVerifyWaitError(reason, accountId = 0) {
  const err = new Error(
    `账号 #${accountId}：检测到手机验证，已暂停自动化操作（${reason || '手机验证弹框'}）。`
    + '请在浏览器窗口里手动完成验证，然后点右上角通知里的「已完成验证，恢复」'
  );
  err.code = 'PHONE_VERIFY_WAIT';
  err.status = 'security_paused';
  err.manualRequired = true;
  err.waiting = true;
  err.humanVerify = true;
  err.phoneVerify = true;
  return err;
}

function makeAssert(state, accountId) {
  return function assertNoPhoneVerify() {
    if (!state.paused) return;
    throw phoneVerifyWaitError(state.reason, accountId);
  };
}

/**
 * 用 Proxy 包一层 Locator：链式调用（first()/nth()/filter()）返回的仍是 Locator，
 * 继续包；动作方法在暂停时直接抛错；只读方法（count/innerText/isVisible…）照常可用。
 */
function guardLocator(locator, state, accountId, depth = 0) {
  if (!locator || typeof locator !== 'object' || depth > 4) return locator;
  return new Proxy(locator, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);
      if (typeof value !== 'function') return value;
      const name = String(prop);
      return function (...args) {
        if (ACTION_METHODS.has(name)) makeAssert(state, accountId)();
        const out = value.apply(target, args);
        if (out && typeof out === 'object' && typeof out.click === 'function' && typeof out.count === 'function') {
          return guardLocator(out, state, accountId, depth + 1);
        }
        return out;
      };
    },
  });
}

/**
 * 给页面装上动作门禁：page 上的动作方法和 locator 动作方法在暂停期间一律抛错。
 * 只包动作类方法，evaluate / screenshot / waitForTimeout / url 等只读能力保持原样，
 * 所以验证码检测、截图、日志都不受影响。
 */
function wrapPageActions(page, state, accountId) {
  if (!page || page.__hvGateWrapped) return;
  page.__hvGateWrapped = true;

  for (const name of ACTION_METHODS) {
    const orig = page[name];
    if (typeof orig !== 'function') continue;
    page[name] = function (...args) {
      makeAssert(state, accountId)();
      return orig.apply(page, args);
    };
  }

  for (const name of ['locator', 'frameLocator', 'getByRole', 'getByText', 'getByLabel', 'getByPlaceholder', 'getByTestId', 'getByTitle', 'getByAltText']) {
    const orig = page[name];
    if (typeof orig !== 'function') continue;
    page[name] = function (...args) {
      // 只创建 Locator 不动页面，允许（检测、读取都依赖它）；动作在 Locator 代理里拦
      return guardLocator(orig.apply(page, args), state, accountId);
    };
  }
}

/**
 * 页面内兜底拦截：暂停期间屏蔽「非真人」的事件。
 * 有些流程用 page.evaluate 直接 el.click()，那绕过了上面的动作代理；
 * 这类事件 isTrusted=false，而人在窗口里的真实点击 isTrusted=true，
 * 所以只拦 isTrusted=false 的事件——既不挡人工操作，又能挡住自动化残留点击。
 */
async function applyPageBlocker(page, paused) {
  if (!page || page.isClosed?.()) return;
  try {
    await page.evaluate((on) => {
      if (!window.__hvBlockInstalled) {
        window.__hvPaused = false;
        const stop = (e) => {
          if (window.__hvPaused && !e.isTrusted) {
            e.stopPropagation();
            e.preventDefault();
          }
        };
        ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'keydown', 'keyup', 'input', 'change', 'submit']
          .forEach((t) => document.addEventListener(t, stop, true));
        window.__hvBlockInstalled = true;
      }
      window.__hvPaused = Boolean(on);
    }, paused);
  } catch { /* 页面跳转中忽略 */ }
}

/**
 * 给一个浏览器连接装手机验证门禁（幂等）。
 * @param {object} connection connectAccount 返回的连接
 * @param {{accountId?:number, taskType?:string}} ctx
 */
function installPhoneVerifyGate(connection, ctx = {}) {
  if (!connection || !connection.page) return null;
  if (connection.__hvGate) return connection.__hvGate;

  const accountId = Number(ctx.accountId || connection?.account?.id || 0);
  const state = {
    paused: false,
    reason: '',
    since: 0,
    checks: 0,
    timer: null,
    accountId,
    assert: null,
  };
  state.assert = makeAssert(state, accountId);
  connection.__hvGate = state;

  try {
    wrapPageActions(connection.page, state, accountId);
  } catch (e) {
    liveLog(`账号 #${accountId}：手机验证门禁安装失败（不影响任务）：${e.message || e}`, 'warn', { accountId });
  }

  const stop = () => {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
  };

  const tick = async () => {
    const page = connection.page;
    if (!page || page.isClosed?.()) {
      stop();
      return;
    }
    const hit = await detectPhoneVerify(page);
    state.checks += 1;
    if (hit.present) {
      if (!state.paused) {
        state.paused = true;
        state.reason = hit.reason;
        state.since = Date.now();
        liveLog(
          `账号 #${accountId}：检测到手机验证弹框（${hit.reason}），已暂停本账号的自动化操作，`
          + '请在浏览器窗口里手动完成验证，完成后点右上角通知「已完成验证，恢复」',
          'warn',
          { accountId }
        );
      }
      // 暂停期间每轮都重新压一次（页面跳转会丢掉 window 上的标记）
      await applyPageBlocker(page, true);
    } else if (state.paused) {
      state.paused = false;
      state.reason = '';
      state.since = 0;
      await applyPageBlocker(page, false);
      liveLog(`账号 #${accountId}：手机验证弹框已消失，恢复自动化操作`, 'info', { accountId });
    }
  };

  state.timer = setInterval(() => { tick().catch(() => {}); }, 1200);
  if (state.timer && typeof state.timer.unref === 'function') state.timer.unref();
  connection.__hvGateStop = stop;
  return state;
}

/** 主动检查一次并抛错（供关键步骤前调用） */
async function assertNoPhoneVerify(page, accountId = 0) {
  const gate = page && page.__hvGate;
  if (gate && gate.paused) throw phoneVerifyWaitError(gate.reason, accountId);
  const hit = await detectPhoneVerify(page);
  if (hit.present) {
    if (gate) {
      gate.paused = true;
      gate.reason = hit.reason;
      gate.since = Date.now();
    }
    throw phoneVerifyWaitError(hit.reason, accountId);
  }
}

/** 卸载门禁（关闭连接时调用） */
function uninstallPhoneVerifyGate(connection) {
  if (!connection) return;
  try { connection.__hvGateStop?.(); } catch { /* ignore */ }
  connection.__hvGate = null;
}

module.exports = {
  detectPhoneVerify,
  installPhoneVerifyGate,
  uninstallPhoneVerifyGate,
  assertNoPhoneVerify,
  phoneVerifyWaitError,
  applyPageBlocker,
  ACTION_METHODS,
  PHONE_SELECTORS,
};
