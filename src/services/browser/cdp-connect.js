const { chromium } = require('playwright-core');

function wsToHttpBase(ws) {
  return String(ws || '').trim().replace(/^ws:/i, 'http:').replace(/\/devtools\/.*$/i, '');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableCdpError(err) {
  const msg = String(err?.message || err || '');
  return /timeout|Timeout|ECONNREFUSED|ECONNRESET|closed|Target closed|WebSocket|CDP|browser has been closed/i.test(msg);
}

function isCreateTargetUnsupported(err) {
  const msg = String(err?.message || err || '');
  return /Not supported|createTarget|Target\.createTarget/i.test(msg);
}

/**
 * 为 Page 挂载旋转图片验证码自动监听与导航后自动过码钩子。
 * - 监听网络响应（captcha/verify/secsdk/whirl 等）自动触发 NoCaptchaAI；
 * - 拦截 page.goto / page.reload：导航完成后若页面出现旋转验证（或等 1.2s 渲染出旋转验证）立即过码；
 * - 幂等、静默容错，绝不向原任务抛异常或破坏原有返回值。
 */
async function ensureConsistentUaAndClientHints(page, openedMeta = null) {
  if (!page || page.isClosed?.()) return;
  if (page.__tkUaConsistentPromise) {
    await page.__tkUaConsistentPromise.catch(() => {});
    return;
  }
  const meta = openedMeta || page.__tkOpenedMeta || page.context?.()?.__tkOpenedMeta || null;
  page.__tkUaConsistentPromise = (async () => {
    try {
      let ua = String(meta?.userAgent || '').trim();
      let lang = String(meta?.locale || meta?.fp?.languages || '').trim();
      if (!ua || !lang) {
        const probed = await page.evaluate(() => ({
          ua: navigator.userAgent || '',
          lang: navigator.language || 'en-US',
        })).catch(() => ({ ua: '', lang: 'en-US' }));
        if (!ua) ua = String(probed.ua || '').trim();
        if (!lang) lang = String(probed.lang || 'en-US').trim();
      }
      const ver = String(
        meta?.coreVersion
        || meta?.fp?.coreVersion
        || (ua.match(/Chrome\/(\d{2,3})/i) || [])[1]
        || '131'
      ).trim();
      const fullVer = `${ver}.0.0.0`;
      const isMac = meta?.os === 'MacIntel' || meta?.fp?.os === 'MacIntel' || /Macintosh|Mac OS X/i.test(ua);
      if (!ua || /Linux|Electron/i.test(ua)) {
        ua = isMac
          ? `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ver}.0.0.0 Safari/537.36`
          : `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ver}.0.0.0 Safari/537.36`;
      }
      const navPlatform = isMac ? 'MacIntel' : 'Win32';
      const uaPlatform = isMac ? 'macOS' : 'Windows';
      const uaPlatformVersion = isMac ? '14.5.0' : '10.0.0';
      const primaryLang = String(lang || 'en-US').split(',')[0].trim() || 'en-US';
      const baseLang = primaryLang.split('-')[0] || 'en';
      // CDP 的 acceptLanguage 不带权重，Chromium 自行追加 ;q=0.9（否则变成 ;q=0.9;q=0.9）
      const acceptLanguage = primaryLang.includes('-') && baseLang.toLowerCase() !== primaryLang.toLowerCase()
        ? `${primaryLang},${baseLang}`
        : primaryLang;
      const userAgentMetadata = {
        brands: [
          { brand: 'Not-A.Brand', version: '99' },
          { brand: 'Google Chrome', version: String(ver) },
          { brand: 'Chromium', version: String(ver) },
        ],
        fullVersionList: [
          { brand: 'Not-A.Brand', version: '99.0.0.0' },
          { brand: 'Google Chrome', version: fullVer },
          { brand: 'Chromium', version: fullVer },
        ],
        fullVersion: fullVer,
        platform: uaPlatform,
        platformVersion: uaPlatformVersion,
        architecture: 'x86',
        model: '',
        mobile: false,
        bitness: '64',
        wow64: false,
      };
      const uaPatchScript = `(() => {
        try {
          const def = (obj, key, val) => {
            try { Object.defineProperty(obj, key, { get: () => val, configurable: true }); } catch (e) {}
          };
          const ua = ${JSON.stringify(ua)};
          const appVer = ua.replace(/^Mozilla\\//i, '');
          const navPlat = ${JSON.stringify(navPlatform)};
          const uaPlat = ${JSON.stringify(uaPlatform)};
          const uaPlatVer = ${JSON.stringify(uaPlatformVersion)};
          const ver = ${JSON.stringify(ver)};
          const fullVer = ${JSON.stringify(fullVer)};
          def(Navigator.prototype, 'webdriver', false);
          def(Navigator.prototype, 'userAgent', ua);
          def(Navigator.prototype, 'appVersion', appVer);
          def(Navigator.prototype, 'vendor', 'Google Inc.');
          def(Navigator.prototype, 'platform', navPlat);
          try { delete navigator.webdriver; } catch (e) {}
          try { delete navigator.userAgent; } catch (e) {}
          try { delete navigator.platform; } catch (e) {}
          const brands = Object.freeze([
            Object.freeze({ brand: 'Not-A.Brand', version: '99' }),
            Object.freeze({ brand: 'Google Chrome', version: ver }),
            Object.freeze({ brand: 'Chromium', version: ver }),
          ]);
          const fullVersionList = Object.freeze([
            Object.freeze({ brand: 'Not-A.Brand', version: '99.0.0.0' }),
            Object.freeze({ brand: 'Google Chrome', version: fullVer }),
            Object.freeze({ brand: 'Chromium', version: fullVer }),
          ]);
          const highEntropyMap = {
            architecture: 'x86',
            bitness: '64',
            brands,
            formFactors: ['Desktop'],
            fullVersionList,
            mobile: false,
            model: '',
            platform: uaPlat,
            platformVersion: uaPlatVer,
            uaFullVersion: fullVer,
            wow64: false,
          };
          const uaDataObj = {
            get brands() { return brands; },
            get mobile() { return false; },
            get platform() { return uaPlat; },
            toJSON() { return { brands, mobile: false, platform: uaPlat }; },
            getHighEntropyValues(hints) {
              const out = { brands, mobile: false, platform: uaPlat };
              if (Array.isArray(hints)) {
                for (const h of hints) {
                  if (h in highEntropyMap) out[h] = highEntropyMap[h];
                }
              }
              return Promise.resolve(out);
            },
          };
          if (typeof NavigatorUAData === 'function' && NavigatorUAData.prototype) {
            try { Object.setPrototypeOf(uaDataObj, NavigatorUAData.prototype); } catch (e) {}
          }
          def(Navigator.prototype, 'userAgentData', uaDataObj);
          try { delete navigator.userAgentData; } catch (e) {}
          if (navigator.userAgentData !== uaDataObj) def(navigator, 'userAgentData', uaDataObj);
          if (!window.chrome) window.chrome = {};
          if (!window.chrome.runtime) window.chrome.runtime = {};
        } catch (e) {}
      })();`;

      const ctx = page.context?.();
      if (ctx) {
        const cdp = await ctx.newCDPSession(page).catch(() => null);
        if (cdp) {
          page.__tkUaCdpSession = cdp;
          const uaParams = {
            userAgent: ua,
            acceptLanguage,
            platform: navPlatform,
            userAgentMetadata,
          };
          await cdp.send('Emulation.setUserAgentOverride', uaParams).catch(() => {});
          await cdp.send('Network.setUserAgentOverride', uaParams).catch(() => {});
          await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: uaPatchScript }).catch(() => {});
        }
      }
      await page.addInitScript(uaPatchScript).catch(() => {});
      await page.evaluate(uaPatchScript).catch(() => {});
    } catch { /* ignore */ }
  })();
  await page.__tkUaConsistentPromise.catch(() => {});
}

function installPageCaptchaHooks(page) {
  if (!page || page.isClosed?.()) return page;
  try {
    const { attachAutoRotateCaptchaWatcher } = require('./nocaptchaai');
    attachAutoRotateCaptchaWatcher(page);
  } catch { /* ignore */ }
  ensureConsistentUaAndClientHints(page).catch(() => {});
  if (page.__tkCaptchaNavHookInstalled) return page;
  page.__tkCaptchaNavHookInstalled = true;

  const checkAfterNav = async () => {
    if (!page || page.isClosed?.()) return;
    try {
      const { solveRotateCaptchaIfPresent } = require('./nocaptchaai');
      const r1 = await solveRotateCaptchaIfPresent(page);
      if (r1?.detected) return;
      // TikTok 旋转验证常在 domcontentloaded 后 800~1500ms 才异步挂出弹窗，做一次非阻塞延迟复检
      const t = setTimeout(() => {
        if (!page || page.isClosed?.() || page.__tkNoCaptchaSolving) return;
        solveRotateCaptchaIfPresent(page).catch(() => {});
      }, 1200);
      t.unref?.();
    } catch { /* ignore */ }
  };

  for (const method of ['goto', 'reload']) {
    const orig = typeof page[method] === 'function' ? page[method].bind(page) : null;
    if (!orig) continue;
    page[method] = async (...args) => {
      await ensureConsistentUaAndClientHints(page).catch(() => {});
      const result = await orig(...args);
      await checkAfterNav().catch(() => {});
      return result;
    };
  }
  return page;
}

function installBrowserCaptchaHooks(browser, opened = null) {
  if (!browser) return browser;
  try {
    if (opened) browser.__tkOpenedMeta = opened;
    for (const ctx of browser.contexts()) {
      if (opened) ctx.__tkOpenedMeta = opened;
      ctx.pages().forEach((p) => {
        if (opened) p.__tkOpenedMeta = opened;
        installPageCaptchaHooks(p);
      });
      if (!ctx.__tkCaptchaCtxInstalled) {
        ctx.__tkCaptchaCtxInstalled = true;
        ctx.on('page', (p) => {
          if (opened) p.__tkOpenedMeta = opened;
          installPageCaptchaHooks(p);
        });
      }
    }
  } catch { /* ignore */ }
  return browser;
}

/**
 * 连接本地浏览器 CDP（比特 / 自研 Electron）。
 * - 优先 http://host:port（Playwright 官方推荐），失败再回退 ws
 * - 自研同进程环境窗使用 session partition，必须连 page ws（inProcess）
 * - 刚 open 后常出现「ws connected 但协议握手超时」，故短等 + 重试
 */
async function connectPlaywrightOverCDP(opened, {
  timeoutMs = 60000,
  retries = 3,
  settleMs = 600,
} = {}) {
  const http = String(opened?.http || opened?.httpUrl || '').trim().replace(/\/+$/, '');
  const ws = String(opened?.ws || '').trim();
  const inProcess = Boolean(opened?.inProcess);
  // 浏览器在本机（127.0.0.1 / localhost）时必须 isLocal: true，Playwright 才会直接传本地文件路径；
  // 否则按「远程浏览器」处理，setFiles / setInputFiles 超过 50MB 会报 Cannot transfer files larger than 50Mb
  const cdpHost = (() => {
    try { return new URL(http || ws).hostname.replace(/^\[|\]$/g, ''); } catch { return ''; }
  })();
  const isLocalBrowser = /^(127\.\d+\.\d+\.\d+|localhost|::1|0\.0\.0\.0)$/i.test(cdpHost);
  const opts = { timeout: Math.max(15000, Number(timeoutMs) || 60000), ...(isLocalBrowser ? { isLocal: true } : {}) };
  const maxAttempts = Math.max(1, Number(retries) || 1);

  if (inProcess) {
    if (!ws) throw new Error('同进程环境窗未返回 page CDP WebSocket 地址');
  } else {
    const endpoint = http || wsToHttpBase(ws);
    if (!endpoint && !ws) throw new Error('本地浏览器未返回 CDP 地址');
  }

  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt === 1 && settleMs > 0) {
      await sleep(settleMs);
    } else if (attempt > 1) {
      await sleep(700 * attempt);
    }
    try {
      if (inProcess) {
        const b = await chromium.connectOverCDP(ws, opts);
        return installBrowserCaptchaHooks(b, opened);
      }
      const endpoint = http || wsToHttpBase(ws);
      try {
        const b = await chromium.connectOverCDP(endpoint, opts);
        return installBrowserCaptchaHooks(b, opened);
      } catch (first) {
        if (!ws || ws === endpoint) throw first;
        const b = await chromium.connectOverCDP(ws, opts);
        return installBrowserCaptchaHooks(b, opened);
      }
    } catch (err) {
      lastErr = err;
      if (!isRetryableCdpError(err) || attempt >= maxAttempts) {
        const tip = '（可检查：自研浏览器是否卡住/弹窗未关、代理是否可用；稍后重试或强制重开环境）';
        const msg = String(err?.message || err || 'CDP 连接失败');
        const wrapped = new Error(
          attempt > 1
            ? `连接浏览器 CDP 失败（第 ${attempt} 次）：${msg} ${tip}`
            : `${msg} ${tip}`
        );
        wrapped.cause = err;
        throw wrapped;
      }
    }
  }
  throw lastErr || new Error('连接浏览器 CDP 失败');
}

function listOpenPages(browser) {
  try {
    return browser.contexts().flatMap((ctx) => ctx.pages()).filter((p) => !p.isClosed?.());
  } catch {
    return [];
  }
}

/** 等待 CDP 上的可见 page（自研 Electron attach 可能晚于 browser 连接） */
async function waitForPlaywrightPage(browser, { timeoutMs = 30000, preferUrl = /tiktok\.com/i } = {}) {
  const deadline = Date.now() + Math.max(3000, Number(timeoutMs) || 30000);
  while (Date.now() < deadline) {
    const pages = listOpenPages(browser);
    const preferred = pages.find((p) => preferUrl.test(String(p.url() || '')));
    const visible = pages.find((p) => {
      const url = String(p.url() || '');
      return url && !/^about:/i.test(url);
    });
    if (preferred || visible || pages[0]) return preferred || visible || pages[0];
    await sleep(250);
  }
  return null;
}

/**
 * 取得可用 Page。Electron CDP 不支持 Target.createTarget，禁止依赖 newPage()。
 * 比特等 Chromium 在无页时可回退 newPage。
 */
async function ensurePlaywrightPage(browser, {
  timeoutMs = 45000,
  preferUrl = /tiktok\.com/i,
  allowNewPage = true,
} = {}) {
  installBrowserCaptchaHooks(browser);
  let page = await waitForPlaywrightPage(browser, { timeoutMs, preferUrl });
  if (page && !page.isClosed?.()) return installPageCaptchaHooks(page);

  page = listOpenPages(browser)[0] || null;
  if (page && !page.isClosed?.()) return installPageCaptchaHooks(page);

  if (!allowNewPage) {
    throw Object.assign(
      new Error('Electron 环境未出现可用页面（不支持 CDP 新建页）。请确认有头窗口已启动且未立刻退出'),
      { code: 'NO_PAGE_ELECTRON' }
    );
  }

  const context = browser.contexts()[0] || null;
  if (!context) {
    try {
      const ctx = await browser.newContext();
      if (!ctx.__tkCaptchaCtxInstalled) {
        ctx.__tkCaptchaCtxInstalled = true;
        ctx.on('page', installPageCaptchaHooks);
      }
      return installPageCaptchaHooks(await ctx.newPage());
    } catch (e) {
      if (isCreateTargetUnsupported(e)) {
        throw Object.assign(
          new Error(`Electron 不支持新建上下文/页面：${e.message || e}`),
          { code: 'CREATE_TARGET_UNSUPPORTED' }
        );
      }
      throw e;
    }
  }
  try {
    return installPageCaptchaHooks(await context.newPage());
  } catch (e) {
    if (isCreateTargetUnsupported(e)) {
      // 再等一轮已有页（窗口可能刚挂上）
      page = await waitForPlaywrightPage(browser, { timeoutMs: 15000, preferUrl });
      if (page) return installPageCaptchaHooks(page);
      throw Object.assign(
        new Error(`Electron 不支持 CDP newPage（Target.createTarget Not supported），且未找到已有页面`),
        { code: 'CREATE_TARGET_UNSUPPORTED' }
      );
    }
    throw e;
  }
}

module.exports = {
  connectPlaywrightOverCDP,
  waitForPlaywrightPage,
  ensurePlaywrightPage,
  installPageCaptchaHooks,
  installBrowserCaptchaHooks,
  listOpenPages,
  wsToHttpBase,
  isCreateTargetUnsupported,
};
