"""Build, verify and package Qf-PV show V1 for a clean GitHub upload."""
from pathlib import Path
import argparse, hashlib, json, subprocess, sys, zipfile
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--output',type=Path,default=ROOT/'dist')
args=parser.parse_args()
subprocess.run([sys.executable,'-X','utf8',str(ROOT/'build.py')],cwd=ROOT,check=True)
subprocess.run(['node',str(ROOT/'tools/test.cjs')],cwd=ROOT,check=True)
checks=json.loads((ROOT/'tests/verification.json').read_text(encoding='utf8'))
assert checks['total']==96 and checks['author']=='QFziyu'
args.output.mkdir(parents=True,exist_ok=True)
exclude_names={'release-manifest.json','verification.json','test-PNG-sequence.zip','parity-before.png','parity-after.png','.DS_Store','Thumbs.db'}
exclude_dirs={'.git','node_modules','__pycache__','dist','.codex','.agents'}
files=[]
for p in sorted(ROOT.rglob('*')):
    rel=p.relative_to(ROOT)
    if not p.is_file() or any(x in exclude_dirs for x in rel.parts) or p.name in exclude_names or p.name.endswith('-result.json') or p.suffix in {'.pyc','.log','.tmp'}:
        continue
    files.append(p)
manifest={'application':'Qf-PV show V1','author':'QFziyu','checks':checks,'files':{p.relative_to(ROOT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in files}}
archive=args.output/'Qf-PV-show-V1-GitHub.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as out:
    for p in files:out.write(p,'Qf-PV-show-V1/'+p.relative_to(ROOT).as_posix())
    out.writestr('Qf-PV-show-V1/release-manifest.json',json.dumps(manifest,ensure_ascii=False,indent=2))
with zipfile.ZipFile(archive) as out:
    assert out.testzip() is None,'ZIP integrity error'
    for rel,expected in manifest['files'].items():assert hashlib.sha256(out.read('Qf-PV-show-V1/'+rel)).hexdigest()==expected,rel
    for item in ['index.html','README.md','README-SOURCES.md','.gitignore','.github/workflows/check.yml','src/ui.js','assets/qf-mark.svg','licenses/JIZURA-LICENSE']:
        assert 'Qf-PV-show-V1/'+item in out.namelist(),item
checksum=hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix('.zip.sha256').write_text(checksum+'  '+archive.name+'\n',encoding='utf8')
print(json.dumps({'archive':str(archive.resolve()),'files':len(files)+1,'bytes':archive.stat().st_size,'checks':checks['total'],'sha256':checksum},ensure_ascii=False))
