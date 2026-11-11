/**
 * 浏览器指纹加固（注册/登录风控对抗）
 * ---------------------------------------------------------------------------
 * 背景：自研 Chromium 环境在 TikTok 注册时会被判为高风险，最后一步要求
 * 「Continue on the TikTok app」扫码；同一 IP 下官方 Chrome 却可以直接注册。
 * 说明被识别的是**浏览器环境本身**，不是 IP / 邮箱。
 *
 * 本模块补齐自研内核相对官方 Chrome 的缺失项，全部通过 addInitScript 在页面
 * 最早阶段注入，且必须与 CDP 层的 UA / Client Hints 覆盖保持一致：
 *   1) navigator.webdriver 痕迹清理（getter 覆盖而非 delete）
 *   2) navigator.plugins / mimeTypes 补齐（自研内核常为空数组）
 *   3) window.chrome 完整对象（runtime / loadTimes / csi / app）
 *   4) WebGL vendor / renderer 伪装（虚拟显示下会退化成 SwiftShader）
 *   5) 字体枚举补齐（西文 + 中文常见字体）
 *   6) 时区 / 语言一致性（避免 Intl 时区与 IP 地区矛盾）
 *   7) 权限查询与 Notification 的最小一致性
 *   8) 少量 Canvas / AudioContext 噪声（每环境独立种子，避免集群特征）
 *
 * 设计原则：
 *   - 全程 try/catch，任何一项失败都不影响页面正常功能；
 *   - 只做「让自研内核看起来像官方 Chrome」，不改动业务需要的 API；
 *   - 幂等，同一页面重复注入无副作用。
 */

/** 官方 Chrome 桌面版常见的 plugins 列表（顺序也影响指纹） */
const PLUGINS = [
  { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
  { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
  { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
  { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
  { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
];

/** Windows / macOS 上 Chrome 通常能枚举到的字体（子集，够覆盖常见检测） */
const FONTS = [
  'Arial', 'Arial Black', 'Arial Narrow', 'Calibri', 'Cambria', 'Cambria Math',
  'Comic Sans MS', 'Consolas', 'Courier New', 'Georgia', 'Impact', 'Lucida Console',
  'Lucida Sans Unicode', 'MS Gothic', 'MS PGothic', 'MS Sans Serif', 'MS Serif',
  'Microsoft Sans Serif', 'Microsoft YaHei', 'MingLiU', 'PMingLiU', 'Palatino Linotype',
  'Segoe Print', 'Segoe Script', 'Segoe UI', 'SimSun', 'Sylfaen', 'Symbol',
  'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Wingdings',
  'SimHei', 'KaiTi', 'FangSong', 'NSimSun',
];

/** 常见的权限状态，避免 permissions.query 对已支持项抛错 */
const PERMISSION_DEFAULTS = {
  geolocation: 'prompt',
  notifications: 'default',
  'persistent-storage': 'granted',
  push: 'denied',
  midi: 'prompt',
  camera: 'prompt',
  microphone: 'prompt',
  'background-sync': 'granted',
  accelerometer: 'granted',
  gyroscope: 'granted',
  magnetometer: 'granted',
  'clipboard-read': 'prompt',
  'clipboard-write': 'granted',
  'payment-handler': 'prompt',
};

/**
 * 生成注入脚本。
 * @param {object} opts
 * @param {string} opts.userAgent  当前页面 UA（与 CDP 覆盖保持一致）
 * @param {string} opts.platform   navigator.platform 期望值
 * @param {string} opts.timezone   IANA 时区，如 America/New_York
 * @param {string} opts.locale     主语言，如 en-US
 * @param {string} opts.webglVendor   WebGL UNMASKED_VENDOR_WEBGL
 * @param {string} opts.webglRenderer WebGL UNMASKED_RENDERER_WEBGL
 * @param {number} opts.seed       指纹噪声种子（每环境固定，保证同环境稳定）
 * @returns {string}
 */
function buildFingerprintScript(opts = {}) {
  const payload = {
    userAgent: String(opts.userAgent || ''),
    platform: String(opts.platform || 'Win32'),
    timezone: String(opts.timezone || ''),
    locale: String(opts.locale || 'en-US'),
    webglVendor: String(opts.webglVendor || 'Google Inc. (Intel)'),
    webglRenderer: String(opts.webglRenderer || 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)'),
    seed: Number.isFinite(Number(opts.seed)) ? Math.abs(Math.trunc(Number(opts.seed))) : 1,
    plugins: PLUGINS,
    fonts: FONTS,
    permissionDefaults: PERMISSION_DEFAULTS,
  };

  return `(() => {
    if (window.__tkFpHardened) return;
    window.__tkFpHardened = true;
    const P = ${JSON.stringify(payload)};
    const def = (obj, key, desc) => {
      try { Object.defineProperty(obj, key, Object.assign({ configurable: true }, desc)); } catch (e) {}
    };
    const seed = P.seed || 1;
    // 环境内稳定的伪随机（保证同一环境每次结果一致，不引入随机抖动）
    const stable = (i) => {
      const x = Math.sin(seed * 9973 + i * 7919) * 10000;
      return x - Math.floor(x);
    };

    // 1) webdriver 痕迹 + platform 一致性
    try {
      def(Navigator.prototype, 'webdriver', { get: () => false });
      if (navigator.webdriver !== false) def(navigator, 'webdriver', { get: () => false });
    } catch (e) {}
    try {
      // 自研内核若跑在 Linux 容器，platform 会是 Linux x86_64，与 UA 声称的 Windows 矛盾
      if (P.platform && navigator.platform !== P.platform) {
        def(Navigator.prototype, 'platform', { get: () => P.platform });
      }
    } catch (e) {}

    // 2) plugins / mimeTypes
    try {
      const makePlugin = (meta, i) => {
        const plugin = Object.create(Plugin.prototype);
        def(plugin, 'name', { get: () => meta.name });
        def(plugin, 'filename', { get: () => meta.filename });
        def(plugin, 'description', { get: () => meta.description });
        def(plugin, 'length', { get: () => 1 });
        def(plugin, 0, { get: () => ({ type: 'application/pdf', suffixes: 'pdf', description: meta.description, enabledPlugin: plugin }) });
        return plugin;
      };
      const pluginArray = Object.create(PluginArray.prototype);
      P.plugins.forEach((meta, i) => {
        const plugin = makePlugin(meta, i);
        def(pluginArray, i, { get: () => plugin });
        def(pluginArray, meta.name, { get: () => plugin });
      });
      def(pluginArray, 'length', { get: () => P.plugins.length });
      def(pluginArray, 'item', { value: function (i) { return this[i] || null; } });
      def(pluginArray, 'namedItem', { value: function (n) { return this[n] || null; } });
      pluginArray[Symbol.iterator] = function* () {
        for (let i = 0; i < P.plugins.length; i += 1) yield pluginArray[i];
      };
      def(Navigator.prototype, 'plugins', { get: () => pluginArray });

      const mimeArray = Object.create(MimeTypeArray.prototype);
      def(mimeArray, 0, { get: () => ({ type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: pluginArray[0] }) });
      def(mimeArray, 'application/pdf', { get: () => mimeArray[0] });
      def(mimeArray, 'length', { get: () => 1 });
      def(mimeArray, 'item', { value: function () { return mimeArray[0]; } });
      def(mimeArray, 'namedItem', { value: function () { return mimeArray[0]; } });
      def(Navigator.prototype, 'mimeTypes', { get: () => mimeArray });
    } catch (e) {}

    // 3) window.chrome：自研内核常常为空对象或缺失子项，真 Chrome 有这几个
    try {
      if (!window.chrome || typeof window.chrome !== 'object') window.chrome = {};
      const c = window.chrome;
      if (!c.runtime) {
        c.runtime = {
          id: undefined,
          connect: function () { throw new Error('Could not establish connection. Receiving end does not exist.'); },
          sendMessage: function () { throw new Error('Could not establish connection. Receiving end does not exist.'); },
          onMessage: { addListener: function () {}, removeListener: function () {}, hasListener: function () { return false; } },
        };
      }
      if (!c.loadTimes) {
        c.loadTimes = function () {
          const t = performance.timing || {};
          const s = (t.navigationStart || Date.now()) / 1000;
          return {
            requestTime: s, startLoadTime: s, commitLoadTime: s + 0.05,
            finishDocumentLoadTime: s + 0.2, finishLoadTime: s + 0.3,
            firstPaintTime: s + 0.15, firstPaintAfterLoadTime: 0,
            navigationType: 'Other', wasFetchedViaSpdy: true, wasNpnNegotiated: true,
            npnNegotiatedProtocol: 'h2', wasAlternateProtocolAvailable: false,
            connectionInfo: 'h2',
          };
        };
      }
      if (!c.csi) {
        c.csi = function () { return { onloadT: Date.now(), pageT: 1000 + Math.floor(stable(1) * 500), startE: 1, tran: 15 }; };
      }
      if (!c.app) {
        c.app = {
          isInstalled: false,
          InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
          RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
          getDetails: function () { return null; },
          getIsInstalled: function () { return false; },
          installState: function () { return 'not_installed'; },
          runningState: function () { return 'cannot_run'; },
        };
      }
    } catch (e) {}

    // 4) WebGL 厂商 / 渲染器（虚拟显示下会变成 SwiftShader，是强信号）
    try {
      const patchGL = (proto) => {
        if (!proto) return;
        const origGetParameter = proto.getParameter;
        if (typeof origGetParameter !== 'function' || proto.__tkGLPatched) return;
        proto.__tkGLPatched = true;
        proto.getParameter = function (p) {
          try {
            // 37445 UNMASKED_VENDOR_WEBGL / 37446 UNMASKED_RENDERER_WEBGL
            if (p === 37445) return P.webglVendor;
            if (p === 37446) return P.webglRenderer;
            // 7936 VENDOR / 7937 RENDERER（非 unmasked，官方 Chrome 也是这两个字符串）
            if (p === 7936) return 'WebKit';
            if (p === 7937) return 'WebKit WebGL';
          } catch (e) {}
          return origGetParameter.apply(this, arguments);
        };
      };
      if (window.WebGLRenderingContext) patchGL(WebGLRenderingContext.prototype);
      if (window.WebGL2RenderingContext) patchGL(WebGL2RenderingContext.prototype);
      // 部分检测走 getExtension 判断是否有 WEBGL_debug_renderer_info
      const patchGetExtension = (proto) => {
        if (!proto || proto.__tkGLExtPatched) return;
        const orig = proto.getExtension;
        if (typeof orig !== 'function') return;
        proto.__tkGLExtPatched = true;
        proto.getExtension = function (name) {
          const r = orig.apply(this, arguments);
          if (r && String(name) === 'WEBGL_debug_renderer_info' && !r.__tkStubbed) {
            try {
              def(r, 'UNMASKED_VENDOR_WEBGL', { get: () => 37445 });
              def(r, 'UNMASKED_RENDERER_WEBGL', { get: () => 37446 });
              r.__tkStubbed = true;
            } catch (e) {}
          }
          return r;
        };
      };
      if (window.WebGLRenderingContext) patchGetExtension(WebGLRenderingContext.prototype);
      if (window.WebGL2RenderingContext) patchGetExtension(WebGL2RenderingContext.prototype);
    } catch (e) {}

    // 5) 字体枚举：容器/自研环境常缺少系统字体
    //    只补 document.fonts.check 的判定，不改 measureText（改宽度会破坏真实排版）
    try {
      if (document.fonts && typeof document.fonts.check === 'function' && !document.fonts.__tkFontSetPatched) {
        document.fonts.__tkFontSetPatched = true;
        const origCheck = document.fonts.check.bind(document.fonts);
        document.fonts.check = function (font, text) {
          try {
            const m = String(font || '').match(/\\d+(?:\\.\\d+)?px\\s+(.+)$/);
            const family = m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
            if (family && P.fonts.indexOf(family) >= 0) return true;
          } catch (e) {}
          return origCheck(font, text);
        };
      }
    } catch (e) {}

    // 6) 时区 / 语言一致性
    try {
      if (P.timezone && window.Intl && Intl.DateTimeFormat) {
        const origDTF = Intl.DateTimeFormat;

        // 包一层构造器，记录调用方是否显式给了 timeZone：
        // 显式给了就必须尊重（否则会改坏真实的跨时区格式化逻辑）
        const PatchedDTF = function (locales, options) {
          const hasExplicitTz = !!(options && typeof options === 'object' && options.timeZone);
          const inst = new origDTF(locales, options);
          try { Object.defineProperty(inst, '__tkHasExplicitTz', { value: hasExplicitTz, configurable: true }); } catch (e) {}
          return inst;
        };
        PatchedDTF.prototype = origDTF.prototype;
        PatchedDTF.supportedLocalesOf = function () { return origDTF.supportedLocalesOf.apply(origDTF, arguments); };
        try { Object.setPrototypeOf(PatchedDTF, origDTF); } catch (e) {}
        try { Intl.DateTimeFormat = PatchedDTF; } catch (e) {}

        const origResolved = origDTF.prototype.resolvedOptions;
        origDTF.prototype.resolvedOptions = function () {
          const opts = origResolved.call(this);
          try {
            if (!this.__tkHasExplicitTz) opts.timeZone = P.timezone;
            if (P.locale) opts.locale = P.locale;
          } catch (e) {}
          return opts;
        };
        // Date#getTimezoneOffset 也要跟着时区走，否则两者矛盾
        const tzOffsetFor = (tz) => {
          try {
            const dtf = new origDTF('en-US', {
              timeZone: tz, hour12: false,
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit',
            });
            const parts = dtf.formatToParts(new Date()).reduce((a, p) => { a[p.type] = p.value; return a; }, {});
            const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
            return Math.round((asUTC - Date.now()) / 60000);
          } catch (e) { return null; }
        };
        const offset = tzOffsetFor(P.timezone);
        if (offset !== null) {
          Date.prototype.getTimezoneOffset = function () { return -offset; };
        }
      }
      def(Navigator.prototype, 'language', { get: () => P.locale });
      def(Navigator.prototype, 'languages', { get: () => Object.freeze([P.locale, P.locale.split('-')[0]]) });
    } catch (e) {}

    // 7) permissions.query 最小一致性
    try {
      if (navigator.permissions && typeof navigator.permissions.query === 'function') {
        const origQuery = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = function (desc) {
          try {
            const name = String(desc && desc.name || '');
            if (name in P.permissionDefaults) {
              return Promise.resolve(Object.assign(Object.create(PermissionStatus.prototype), {
                state: P.permissionDefaults[name],
                name,
                onchange: null,
              }));
            }
          } catch (e) {}
          return origQuery(desc);
        };
      }
      // 桌面 Chrome 一定有 Notification；只在原本就是 denied 时兜底成 default，
      // 避免把用户真实授权的通知能力改坏
      if (typeof window.Notification === 'function') {
        try {
          if (window.Notification.permission === 'denied') {
            def(Notification, 'permission', { get: () => 'default' });
          }
        } catch (e) {}
      }
    } catch (e) {}

    // 8) Canvas 微小噪声（每环境种子固定，跨会话稳定，避免被识别为「每次不同的伪装」）
    try {
      const ctxProto = CanvasRenderingContext2D.prototype;
      const origGetImageData = ctxProto.getImageData;
      if (typeof origGetImageData === 'function' && !ctxProto.__tkCanvasPatched) {
        ctxProto.__tkCanvasPatched = true;
        ctxProto.getImageData = function (x, y, w, h) {
          const data = origGetImageData.apply(this, arguments);
          try {
            if (data && data.data && data.data.length >= 4) {
              // 只改前若干像素的 R 通道最低位：肉眼不可见，但能区分不同环境
              const n = Math.min(8, Math.floor(data.data.length / 4));
              for (let i = 0; i < n; i += 1) {
                const idx = i * 4;
                if (idx + 3 < data.data.length) {
                  data.data[idx] = (data.data[idx] & 0xFE) | (stable(i) > 0.5 ? 1 : 0);
                }
              }
            }
          } catch (e) {}
          return data;
        };
      }
      const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      if (typeof origToDataURL === 'function' && !HTMLCanvasElement.prototype.__tkToDataURLPatched) {
        HTMLCanvasElement.prototype.__tkToDataURLPatched = true;
        HTMLCanvasElement.prototype.toDataURL = function () {
          try {
            const ctx = this.getContext('2d');
            // 只扰动一次，且只在画布尺寸像「指纹探针」时动手；
            // 反复扰动会让同一画布每次结果都变，反而是异常特征。
            if (ctx && !this.__tkNoised && this.width >= 40 && this.height >= 20 && this.width <= 400 && this.height <= 200) {
              this.__tkNoised = true;
              const px = ctx.getImageData(0, 0, 1, 1);
              if (px && px.data) {
                const d = px.data;
                d[0] = (d[0] & 0xFE) | (stable(99) > 0.5 ? 1 : 0);
                ctx.putImageData(px, 0, 0);
              }
            }
          } catch (e) {}
          return origToDataURL.apply(this, arguments);
        };
      }
    } catch (e) {}

    // 9) AudioContext 指纹微扰
    try {
      if (window.AnalyserNode && AnalyserNode.prototype && !AnalyserNode.prototype.__tkAudioPatched) {
        AnalyserNode.prototype.__tkAudioPatched = true;
        const orig = AnalyserNode.prototype.getFloatFrequencyData;
        if (typeof orig === 'function') {
          AnalyserNode.prototype.getFloatFrequencyData = function (array) {
            orig.apply(this, arguments);
            try {
              if (array && array.length) {
                for (let i = 0; i < Math.min(8, array.length); i += 1) {
                  array[i] = array[i] + (stable(i + 200) - 0.5) * 1e-6;
                }
              }
            } catch (e) {}
            return array;
          };
        }
      }
    } catch (e) {}

    // 10) 硬件并发 / 内存：只在缺失或异常低时兜底（容器里常是 1 核，这是明显特征）
    try {
      const cores = navigator.hardwareConcurrency;
      if (!cores || cores < 2) def(Navigator.prototype, 'hardwareConcurrency', { get: () => 8 });
      const mem = navigator.deviceMemory;
      if (!mem) def(Navigator.prototype, 'deviceMemory', { get: () => 8 });
    } catch (e) {}
  })();`;
}

/**
 * 给页面注入指纹加固脚本（幂等）。
 * @param {object} page Playwright Page
 * @param {object} opts 见 buildFingerprintScript
 */
async function hardenFingerprint(page, opts = {}) {
  if (!page || page.isClosed?.()) return { ok: false, reason: 'page closed' };
  if (page.__tkFpHardenedDone) return { ok: true, reason: 'already' };
  page.__tkFpHardenedDone = true;
  const script = buildFingerprintScript(opts);
  await page.addInitScript(script).catch(() => {});
  await page.evaluate(script).catch(() => {});
  return { ok: true, injected: true };
}

module.exports = {
  buildFingerprintScript,
  hardenFingerprint,
  PLUGINS,
  FONTS,
};
