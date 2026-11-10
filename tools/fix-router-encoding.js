const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../public/js/router.js');
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

function u(s) {
  return s.replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

const fixes = {
  // line content matchers -> replacement line (full line)
};

for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];
  const n = i + 1;

  if (line.includes('\uFFFD') || /未加\?|该菜\?|登录\?|失败\?/.test(line) || /Error\('[^']*\?\)/.test(line) || /toast\('[^']*\?/.test(line)) {
    console.log('broken', n, JSON.stringify(line));
  }

  if (/app\.toast\(/.test(line) && /无权|该菜/.test(line)) {
    lines[i] = u("      app.toast('\\u5f53\\u524d\\u89d2\\u8272\\u65e0\\u6743\\u8bbf\\u95ee\\u8be5\\u83dc\\u5355', true);");
  } else if (/this\.toast\(/.test(line) && /页面模块|未加/.test(line)) {
    lines[i] = u("        this.toast('\\u9875\\u9762\\u6a21\\u5757\\u672a\\u52a0\\u8f7d: ' + this.view, true);");
  } else if (/throw new Error\(/.test(line) && /app-core|未加/.test(line)) {
    lines[i] = u("    if (!app) throw new Error('app-core \\u672a\\u52a0\\u8f7d');");
  } else if (/showLoginGate\(/.test(line) && /请先|登录/.test(line) && line.includes('\uFFFD')) {
    lines[i] = line.replace(/showLoginGate\([^)]*\)/, u("showLoginGate('\\u8bf7\\u5148\\u767b\\u5f55')"));
  }
}

fs.writeFileSync(file, lines.join('\n'), { encoding: 'utf8' });

const { execFileSync } = require('child_process');
try {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  console.log('OK syntax');
} catch (e) {
  const err = String(e.stderr || e.stdout || e.message);
  console.error(err);
  // print nearby lines for remaining errors
  const m = err.match(/:(\d+)\r?\n/);
  if (m) {
    const n = Number(m[1]);
    for (let i = Math.max(0, n - 3); i < Math.min(lines.length, n + 2); i += 1) {
      console.error((i + 1) + ':' + JSON.stringify(lines[i]));
    }
  }
  process.exit(1);
}
