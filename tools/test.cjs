/* Run model, renderer, UI-handler and integration checks; never starts a browser. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
for(const file of ['core','ui-simulation','engine','space']){
  const result=spawnSync(process.execPath,['--expose-gc',path.join(root,'tests',file+'.test.js')],{cwd:root,stdio:'inherit',env:process.env});
  if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);
}
const results=Object.fromEntries(['core','ui-simulation','engine','space'].map(k=>[k,JSON.parse(fs.readFileSync(path.join(root,'tests',k+'-result.json'),'utf8')).passed]));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
for(const [i,script]of scripts.entries())new vm.Script(script[1],{filename:'built-script-'+i});
if(/__(CSS|ENGINE|UI|APP|SPACE|TEMPLATES|CORE)__/.test(html))throw new Error('Unfilled build placeholder');
if(!html.includes('Created by QFziyu')||!html.includes('<title>Qf-PV show V1'))throw new Error('Build does not contain the new identity');
const report={application:'Qf-PV show V1',author:'QFziyu',tests:results,total:Object.values(results).reduce((n,v)=>n+v,0),builtScripts:scripts.length,categoryPlans:240,
  canvas:'Actual Canvas pixels and PNG export',ui:'DOM fixture tests; real browser layout not verified',mp4:'Mock codec; hardware encoder not verified',afterEffects:'Script syntax, package and host API simulation; real AE not verified'};
fs.writeFileSync(path.join(root,'tests/verification.json'),JSON.stringify(report,null,2));
console.log('\n'+report.total+' checks passed; '+scripts.length+' built scripts parsed.');
