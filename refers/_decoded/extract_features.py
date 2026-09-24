# -*- coding: utf-8 -*-
import re
import os

base = r'd:\WorkSpace\Projects\TkSwarm-Rebuild\refers\_decoded'

for fn in sorted(os.listdir(base)):
    if not fn.endswith('.html'):
        continue
    path = os.path.join(base, fn)
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()

    zh = sorted(set(re.findall(
        r'[\u4e00-\u9fff][\u4e00-\u9fff0-9A-Za-z_\-\s/（）()：:，,、·.#]{1,50}', c)))

    apis = re.findall(r'''['"`]/api/[a-zA-Z0-9_/\-${}.]+''', c)
    apis = sorted(set(a[1:] if a[0] in "'\"`" else a for a in apis))

    # buttons / menu items from el-button / el-menu-item text
    buttons = re.findall(
        r'<(?:el-button|el-menu-item|el-tab-pane|el-dropdown-item|button)[^>]*>\s*([^<]{1,40})\s*<',
        c)
    buttons += re.findall(r'slot="title">\s*([^<]{1,40})\s*<', c)
    buttons += re.findall(r'<span[^>]*>\s*([\u4e00-\u9fff][^<]{0,40})\s*</span>', c)
    buttons = sorted(set(b.strip() for b in buttons if b.strip()))

    # dialog titles
    dialogs = re.findall(r':title="([^"]+)"', c)
    dialogs += re.findall(r'title="([^"]+)"', c)
    dialogs = sorted(set(dialogs))

    # websocket / message types
    ws_types = sorted(set(re.findall(
        r'''(?:type|msgType|messageType|event)\s*[:=]\s*['"]([a-zA-Z0-9_]+)['"]''', c)))

    # status maps in JS comments or objects
    status_blocks = re.findall(
        r'(?:statusMap|statusText|statusLabel|taskStatus|loginStatus|friendStatus)[\s\S]{0,400}',
        c)

    # form / settings keys
    form_keys = sorted(set(re.findall(
        r'''(?:this\.)?([a-zA-Z][a-zA-Z0-9]*(?:Form|Settings|Config|Dialog|Visible|List|Map|Options))\b''',
        c)))

    # el-option labels
    options = re.findall(
        r'''<(?:el-option|el-radio|el-checkbox)[^>]*(?:label|title)=["']([^"']+)["']''', c)
    options += re.findall(
        r'''<(?:el-option|el-radio)[^>]*>\s*([^<]{1,40})\s*<''', c)
    options = sorted(set(o.strip() for o in options if o.strip()))

    # case 'xxx' in switch for WS
    cases = sorted(set(re.findall(r'''case\s+['"]([a-zA-Z0-9_\-]+)['"]''', c)))

    out_path = os.path.join(base, fn.replace('.html', '_extract.txt'))
    with open(out_path, 'w', encoding='utf-8') as o:
        o.write('=== TITLE ===\n')
        m = re.search(r'<title>([^<]+)</title>', c)
        o.write((m.group(1) if m else '?') + '\n\n')

        o.write('=== APIS (%d) ===\n' % len(apis))
        for a in apis:
            o.write(a + '\n')

        o.write('\n=== DIALOG TITLES ===\n')
        for d in dialogs:
            o.write(d + '\n')

        o.write('\n=== BUTTONS/MENUS ===\n')
        for b in buttons:
            o.write(b + '\n')

        o.write('\n=== OPTIONS/RADIOS ===\n')
        for opt in options:
            o.write(opt + '\n')

        o.write('\n=== FORM/STATE KEYS ===\n')
        for k in form_keys:
            o.write(k + '\n')

        o.write('\n=== SWITCH CASES / WS TYPES ===\n')
        for x in sorted(set(ws_types + cases)):
            o.write(x + '\n')

        o.write('\n=== STATUS BLOCKS ===\n')
        for s in status_blocks[:20]:
            o.write(s[:300].replace('\n', ' ') + '\n---\n')

        o.write('\n=== ZH STRINGS (%d) ===\n' % len(zh))
        for z in zh:
            o.write(z.strip() + '\n')

    print('Wrote', out_path, 'zh=', len(zh), 'apis=', len(apis), 'btns=', len(buttons))
