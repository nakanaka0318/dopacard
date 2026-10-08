#!/usr/bin/env python3
"""index.html + css + js を1つのHTMLにまとめる。
dist/dopa-burst.html : そのままブラウザで開ける単体ファイル
dist/artifact.html   : Artifact 公開用（doctype/html/head/body タグなし）
"""
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(ROOT, 'index.html'), encoding='utf8').read()

def read(rel):
    return open(os.path.join(ROOT, rel), encoding='utf8').read()

def inline(html):
    html = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">', lambda m: '<style>\n' + read(m.group(1)) + '\n</style>', html)
    def js(m):
        code = read(m.group(1))
        assert '</script' not in code, m.group(1)
        return '<script>\n' + code + '\n</script>'
    html = re.sub(r'<script src="(js/[^"]+)"></script>', js, html)
    return html

os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
full = inline(src)
full = re.sub(r'\n?<!--/?BUILD:\w+-->', '', full)
open(os.path.join(ROOT, 'dist', 'dopa-burst.html'), 'w', encoding='utf8').write(full)

head = re.search(r'<!--BUILD:HEAD-->(.*?)<!--/BUILD:HEAD-->', src, re.S).group(1)
body = re.search(r'<!--BUILD:BODY-->(.*?)<!--/BUILD:BODY-->', src, re.S).group(1)
art = inline(head.strip() + '\n' + body.strip()) + '\n'
open(os.path.join(ROOT, 'dist', 'artifact.html'), 'w', encoding='utf8').write(art)
for f in ('dopa-burst.html', 'artifact.html'):
    print(f, os.path.getsize(os.path.join(ROOT, 'dist', f)), 'bytes')
