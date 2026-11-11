/**
 * 指纹自检脚本
 * ---------------------------------------------------------------------------
 * 用法：在浏览器里打开 TikTok（或任意 https 页面），打开 DevTools Console，
 *      粘贴本文件全部内容回车，会打印一份可对比的指纹快照。
 *
 * 建议在两个环境各跑一次并对比：
 *   A. 自研浏览器（应看到修补后的值）
 *   B. 官方 Chrome 同版本（作为基准真值）
 *
 * 重点看输出里标了 [!] 的项：这些是「与官方 Chrome 基准不一致」的地方，
 * 也是 TikTok 注册判定高风险最可能的依据。
 */
(() => {
  const out = [];
  const push = (k, v, bad) => out.push({ k, v, bad: !!bad });

  // ---- UA / Client Hints ----
  push('userAgent', navigator.userAgent,
    /Electron|Headless|Chrome\/\d+\.0\.0\.0/i.test(navigator.userAgent) || !/Chrome\//.test(navigator.userAgent));
  push('appVersion', navigator.appVersion, false);
  push('platform', navigator.platform, !/Win32|MacIntel|Linux x86_64/.test(navigator.platform));

  const uad = navigator.userAgentData;
  if (!uad) {
    push('userAgentData', 'MISSING', true);
  } else {
    push('uaData.brands', JSON.stringify(uad.brands), false);
    push('uaData.platform', uad.platform, false);
    push('uaData.mobile', String(uad.mobile), false);
    if (uad.getHighEntropyValues) {
      uad.getHighEntropyValues(['platformVersion', 'architecture', 'bitness', 'model', 'uaFullVersion', 'fullVersionList'])
        .then((h) => {
          push('uaData.hev.platformVersion', h.platformVersion, !h.platformVersion);
          push('uaData.hev.architecture', h.architecture, !h.architecture);
          push('uaData.hev.bitness', h.bitness, !h.bitness);
          push('uaData.hev.uaFullVersion', h.uaFullVersion, !h.uaFullVersion);
          print();
        })
        .catch(() => { push('uaData.hev', 'FAILED', true); print(); });
    }
  }

  // ---- 自动化痕迹 ----
  push('navigator.webdriver', String(navigator.webdriver), navigator.webdriver === true);

  // ---- plugins / mimeTypes ----
  push('plugins.length', String(navigator.plugins.length), navigator.plugins.length === 0);
  push('plugins.names', [...navigator.plugins].map((p) => p.name).join(' | '), navigator.plugins.length === 0);
  push('mimeTypes.length', String(navigator.mimeTypes.length), navigator.mimeTypes.length === 0);

  // ---- window.chrome ----
  push('window.chrome', typeof window.chrome, typeof window.chrome !== 'object');
  push('chrome.runtime', typeof window.chrome?.runtime, typeof window.chrome?.runtime !== 'object');
  push('chrome.loadTimes', typeof window.chrome?.loadTimes, typeof window.chrome?.loadTimes !== 'function');
  push('chrome.csi', typeof window.chrome?.csi, typeof window.chrome?.csi !== 'function');
  push('chrome.app', typeof window.chrome?.app, typeof window.chrome?.app !== 'object');

  // ---- WebGL ----
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) {
      push('WebGL', 'UNAVAILABLE', true);
    } else {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
      const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      push('webgl.vendor', String(vendor), /SwiftShader|Software/i.test(String(vendor)));
      push('webgl.renderer', String(renderer), /SwiftShader|Software|llvmpipe/i.test(String(renderer)));
      push('webgl.hasDebugInfo', String(!!dbg), false);
    }
  } catch (e) {
    push('WebGL', 'ERROR ' + e.message, true);
  }

  // ---- 时区 / 语言 ----
  push('Intl.timeZone', Intl.DateTimeFormat().resolvedOptions().timeZone, false);
  push('Date.getTimezoneOffset', String(new Date().getTimezoneOffset()), false);
  push('navigator.language', navigator.language, false);
  push('navigator.languages', JSON.stringify(navigator.languages), false);
  push('Intl.locale', Intl.DateTimeFormat().resolvedOptions().locale, false);

  // ---- 硬件 ----
  push('hardwareConcurrency', String(navigator.hardwareConcurrency), !navigator.hardwareConcurrency || navigator.hardwareConcurrency < 2);
  push('deviceMemory', String(navigator.deviceMemory), !navigator.deviceMemory);

  // ---- 屏幕 ----
  push('screen', `${screen.width}x${screen.height} dpr=${devicePixelRatio}`, false);
  push('innerSize', `${innerWidth}x${innerHeight}`, false);
  push('colorDepth', String(screen.colorDepth), false);

  // ---- 字体探测（常见检测方式） ----
  try {
    const probe = (family) => {
      const span = document.createElement('span');
      span.style.cssText = `position:absolute;left:-9999px;font-size:72px;font-family:monospace,${family}`;
      span.textContent = 'mmmmmmmmmmlli';
      document.body.appendChild(span);
      const w = span.offsetWidth;
      span.style.fontFamily = 'monospace';
      const base = span.offsetWidth;
      span.remove();
      return w !== base;
    };
    const hits = ['Arial', 'Times New Roman', 'Consolas', 'Microsoft YaHei', 'SimSun', 'Segoe UI', 'Tahoma']
      .filter(probe);
    push('fonts.detected', hits.join(', ') || '(none)', hits.length < 3);
    push('document.fonts.check(Arial)', String(document.fonts.check('12px Arial')), false);
  } catch (e) {
    push('fonts', 'ERROR ' + e.message, true);
  }

  // ---- Canvas 指纹 ----
  try {
    const cv = document.createElement('canvas');
    cv.width = 220; cv.height = 60;
    const ctx = cv.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(100, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('TkSwarm fingerprint', 2, 15);
    const data = cv.toDataURL();
    let h = 0;
    for (let i = 0; i < data.length; i += 1) h = (h * 31 + data.charCodeAt(i)) % 2147483647;
    push('canvas.hash', String(h), false);
  } catch (e) {
    push('canvas', 'ERROR ' + e.message, true);
  }

  // ---- 权限 ----
  push('Notification.permission', String(window.Notification?.permission), false);

  function print() {
    const bad = out.filter((o) => o.bad);
    console.group('%c指纹自检报告', 'color:#0a0;font-weight:bold');
    console.table(out.map((o) => ({ 项目: o.k, 值: String(o.v).slice(0, 100), 可疑: o.bad ? '⚠' : '' })));
    if (bad.length) {
      console.group(`%c⚠ ${bad.length} 项与官方 Chrome 不一致`, 'color:#d00;font-weight:bold');
      bad.forEach((o) => console.log(`[!] ${o.k} = ${o.v}`));
      console.groupEnd();
    } else {
      console.log('%c✓ 未发现明显异常项', 'color:#0a0');
    }
    console.groupEnd();
    return { all: out, suspicious: bad };
  }

  return print();
})();
