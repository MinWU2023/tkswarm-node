const fs = require('fs');
const path = require('path');
const base = __dirname;

for (const fn of fs.readdirSync(base).filter(f => f.endsWith('.html') && f.startsWith('page_'))) {
  const c = fs.readFileSync(path.join(base, fn), 'utf8');
  const zh = [...new Set(c.match(/[\u4e00-\u9fff][\u4e00-\u9fff0-9A-Za-z_\-\s/（）()：:，,、·.#]{1,50}/g) || [])].sort();
  const apis = [...new Set((c.match(/['"`]\/api\/[a-zA-Z0-9_/\-${}.]+/g) || []).map(a => a.slice(1)))].sort();
  const dialogs = [...new Set([
    ...(c.match(/title="[^"]+"/g) || []).map(t => t.slice(7, -1)),
    ...(c.match(/:title="[^"]+"/g) || []).map(t => t.slice(8, -1)),
  ])].sort();
  const cases = [...new Set((c.match(/case\s+['"]([a-zA-Z0-9_\-]+)['"]/g) || []).map(x => x.replace(/case\s+['"]|['"]/g, '')))].sort();
  const forms = [...new Set(c.match(/\b[a-zA-Z][a-zA-Z0-9]*(?:Form|Settings|Config|Dialog|Visible|Options|Map|List)\b/g) || [])].sort();
  const elDialogs = [...new Set((c.match(/<el-dialog[^>]*title="([^"]+)"/g) || []).map(m => (m.match(/title="([^"]+)"/) || [])[1]).filter(Boolean))];
  const tabs = [...new Set((c.match(/<el-tab-pane[^>]*label="([^"]+)"/g) || []).map(m => (m.match(/label="([^"]+)"/) || [])[1]).filter(Boolean))];
  const dropdowns = [...new Set((c.match(/<el-dropdown-item[^>]*>[\s\S]*?<\/el-dropdown-item>/g) || [])
    .map(m => m.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean))];
  const buttons = [...new Set((c.match(/<el-button[^>]*>[\s\S]*?<\/el-button>/g) || [])
    .map(m => m.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).filter(x => x.length > 0 && x.length < 40))];

  const out = [
    '=== TITLE ===',
    (c.match(/<title>([^<]+)<\/title>/) || [, '?'])[1],
    '',
    `=== APIS (${apis.length}) ===`,
    ...apis,
    '',
    '=== EL-DIALOGS ===',
    ...elDialogs,
    '',
    '=== TABS ===',
    ...tabs,
    '',
    '=== DIALOG/TITLE ATTRS ===',
    ...dialogs.slice(0, 80),
    '',
    '=== DROPDOWN ITEMS ===',
    ...dropdowns.slice(0, 80),
    '',
    '=== BUTTON TEXTS (sample) ===',
    ...buttons.slice(0, 120),
    '',
    '=== FORM/STATE KEYS ===',
    ...forms,
    '',
    '=== SWITCH CASES ===',
    ...cases,
    '',
    `=== ZH (${zh.length}) ===`,
    ...zh,
  ].join('\n');

  fs.writeFileSync(path.join(base, fn.replace('.html', '_extract.txt')), out, 'utf8');
  console.log('Wrote', fn, 'zh=', zh.length, 'apis=', apis.length);
}
