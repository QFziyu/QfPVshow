"""Build an offline single HTML from modular source. Python + Node, no npm dependencies.
Run: python build.py. The release index.html is ready to open without rebuilding.
"""
from pathlib import Path
import json
import subprocess
import os
os.environ["PYTHONUTF8"]="1"

ROOT = Path(__file__).resolve().parent
JIZURA = ROOT / 'vendor/jizura'
subprocess.run(['node', str(JIZURA / 'tools/export_ae_data.js')], check=True)
data = json.loads((JIZURA / 'ae/data.json').read_text(encoding='utf-8'))
parts = ['00_core', '05_reg', '10_helpers', '15_plan', '16_omakase', '20_motion', '30_layouts', '40_decor', '45_core']
parts += sorted(p.stem for p in (JIZURA / 'ae').glob('p_*.jsx'))
parts += ['50_build', '55_diag']
ae = '(function(){\nvar JZ_DATA=' + json.dumps(data, ensure_ascii=True) + ';\n'
ae += '\n'.join((JIZURA / 'ae' / (p + '.jsx')).read_text(encoding='utf-8') for p in parts)
ae += '\n$.global.JZ_CORE={build:jzBuild,parse:jzParseJSON};\n})();'
ae = ae.replace('@VERSION@', (JIZURA / 'VERSION').read_text(encoding='utf-8').strip())
# ExtendScript source must survive Windows installations with different encodings.
ae = ''.join(c if ord(c) < 128 else c.encode('unicode_escape').decode('ascii')
             if ord(c) <= 0xffff else ''.join('\\u%04x' % int.from_bytes(b, 'big')
             for b in [c.encode('utf-16-be')[:2], c.encode('utf-16-be')[2:]]) for c in ae)
(ROOT / 'vendor/jizura/ae-core.jsx').write_text(ae,encoding='utf-8')
engine = '\n'.join(p.read_text(encoding='utf-8') for p in sorted((JIZURA / 'src').glob('*.js')))
replacements = {'CSS': (ROOT/'src/style.css').read_text(encoding='utf-8'),
                'MUX': (ROOT/'vendor/mp4-muxer.min.js').read_text(encoding='utf-8'), 'ENGINE':engine,
                'AE_CORE':json.dumps(ae, ensure_ascii=True)}
for name in ['CURVES','CORE','SCENE','SPACE','TEMPLATES','PRESETS','LYRICS','CAPTIONS','ZIP','RENDERER','EXPORTS','UI','APP']:
    replacements[name] = (ROOT/'src'/ (name.lower()+'.js')).read_text(encoding='utf-8')
html=(ROOT/'src/studio.html').read_text(encoding='utf-8')
for name,value in replacements.items():
    # Embedded JavaScript cannot contain an HTML closing-script token.
    if name!='CSS':value=value.replace('</script','<\\/script')
    html=html.replace('__'+name+'__',value)
(ROOT/'index.html').write_text(html,encoding='utf-8')
print('Built index.html:', len(html.encode()), 'bytes')
