/* Real Canvas rendering in Node plus an encoder mock. This is not a browser or AE test. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const runtime=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||path.resolve(__dirname,'../node_modules');

const C=require(path.join(runtime,'@napi-rs/canvas'));
const root=path.resolve(__dirname,'..'),noop=()=>{};
function mk(w=1,h=1){const c=C.createCanvas(w,h);c.style={};c.addEventListener=noop;c.toBlob=cb=>cb(new Blob([c.toBuffer('image/png')],{type:'image/png'}));return c;}
global.window=global;global.Path2D=C.Path2D;global.DOMMatrix=C.DOMMatrix;global.Image=C.Image;
global.document={createElement:n=>n==='canvas'?mk():{style:{},appendChild:noop,addEventListener:noop},getElementById:()=>null,
  querySelectorAll:()=>[],head:{appendChild:noop},fonts:{load:async()=>[],ready:Promise.resolve()},addEventListener:noop,hidden:false};
global.requestAnimationFrame=noop;global.localStorage={getItem:()=>null,setItem:noop};
for(const f of fs.readdirSync(root+'/vendor/jizura/src').filter(f=>f.endsWith('.js')).sort())vm.runInThisContext(fs.readFileSync(root+'/vendor/jizura/src/'+f,'utf8'),{filename:f});
for(const f of ['curves','core','scene','space','templates','presets','lyrics','captions','zip','renderer','exports'])vm.runInThisContext(fs.readFileSync(root+'/src/'+f+'.js','utf8'),{filename:f+'.js'});
global.PVF_AE_CORE=fs.readFileSync(root+'/vendor/jizura/ae-core.jsx','utf8');
let pass=0;const check=(n,f)=>{f();pass++;console.log('PASS',n);};
function project(){const j=J.defaultProject();j.lang='zh-Hans';j.res=720;j.fps=30;j.lyrics='[00:00.00][end:4]为你的故事 / 留出一片空间';J.applySongProfile(j,'pop');j.extra=true;j.fx.texture=0;j.fx.chroma=0;j.fx.flash=false;const p=PVF.initial(j);p.templateBackground=false;p.background='#132333';p.jizura.centerFree=true;PVFSpace.ensure(p);return p;}
function compile(p){const plan=J.plan(p.jizura,null);plan.fusion=p;PVFCaptions.sync(p,plan);return plan;}
const cv=mk(640,360),R=new J.Renderer();
const pixel=(x,y)=>Array.from(cv.getContext('2d').getImageData(Math.round(x*640),Math.round(y*360),1,1).data);
check('27 palettes and all 860 source parts are available with six original song categories',()=>{
  assert.equal(J.STYLE_ORDER.length,27);assert.equal(J.GROUP_KEYS.reduce((n,g)=>n+J.order(g).length,0),860);assert.equal(Object.keys(J.SONG_PROFILES).length,6);
  for(const [g,options]of Object.entries(PVFTemplates.groups)){assert.ok(PVFTemplates.options(g).length>20);}
  assert.equal(J.LAYOUTS.pendulum.name,'钟摆');assert.equal(J.STYLES.ocean.name,'深海');
});
check('240 seeded category plans respect automatic layout, enter, exit and cut-density pools',()=>{
  for(const key of Object.keys(J.SONG_PROFILES))for(let seed=0;seed<20;seed++)for(const unify of [false,true]){
    const p=project(),j=p.jizura;J.applySongProfile(j,key);j.seed=seed;j.unify=unify;j.centerFree=false;
    const plan=compile(p),s=J.SONG_PROFILES[key],cuts=plan.cuts.filter(c=>c.line===0&&c.layout!=='interlude');
    assert.ok(cuts.length<=s.maxCuts);for(const c of cuts)for(const g of ['layout','enter','exit'])assert.ok(s.pools[g].includes(c[g])||(c[g]==='cut'&&(g==='enter'?(c.trans||c.morph):plan.cuts.some(n=>Math.abs(n.start-c.end)<.06&&(n.trans||n.morph)))),key+' '+g+' '+c[g]);
  }
});
check('Size, position, rotation and hold keys interpolate and survive speed processing and project reload',()=>{
  const p=project(),l=PVFSpace.layer(p);PVF.insert(l,{frame:0,position:{x:.3,y:.4},width:.2,height:.5,rotation:0});PVF.insert(l,{frame:60,position:{x:.7,y:.6},width:.4,height:.8,rotation:30});
  const q=PVF.at(l,30);assert.ok(Math.abs(q.width-.3)<1e-9);assert.ok(Math.abs(q.height-.65)<1e-9);assert.equal(q.rotation,15);
  l.processedSamples=PVF.retime(l);assert.ok(Math.abs(PVF.at(l,30).width-.3)<1e-9);assert.deepEqual(PVF.validate(p,J.defaultProject()).layers.find(a=>a.type==='space').processedSamples,l.processedSamples);
  l.processedSamples=[];l.rawSamples[0].interpolation='hold';assert.equal(PVF.at(l,59).width,.2);assert.equal(PVF.at(l,60).width,.4);
});
check('First late space key anchors the original region at the start instead of changing earlier frames',()=>{const p=project(),l=PVFSpace.layer(p),before=PVF.at(l,0);PVF.insert(l,{frame:60,position:{x:.7,y:.3},width:.5,height:.6});assert.equal(l.rawSamples[0].frame,0);assert.deepEqual(PVF.at(l,0),before);assert.equal(PVF.at(l,60).width,.5);});
check('Independent width animation is not erased by position-key simplification',()=>{
  const p=project(),l=PVFSpace.layer(p);for(const [frame,width]of [[0,.2],[15,.7],[30,.2]])PVF.insert(l,{frame,position:{x:.5,y:.5},width,height:.5});
  assert.equal(PVF.simplify(l,2,1920,1080).length,3);
});
check('Opaque and alpha rendering leave the animated area empty without painting a cover',()=>{
  const p=project(),l=PVFSpace.layer(p);l.width=.2;l.height=.5;p.layers.push(PVF.layer('shape','Full graphic',{width:1,height:1,color:'#ff0000'}));
  PVF.insert(l,{frame:0,position:{x:.3,y:.5},width:.2,height:.5});PVF.insert(l,{frame:60,position:{x:.7,y:.5},width:.3,height:.8});
  const pl=compile(p);R.frame(cv.getContext('2d'),pl,0,{scale:640/pl.W,noPost:true});assert.deepEqual(pixel(.3,.5),[19,35,51,255]);assert.deepEqual(pixel(.7,.5),[255,0,0,255]);
  R.frame(cv.getContext('2d'),pl,2,{scale:640/pl.W,noPost:true,transparent:true});assert.equal(pixel(.7,.5)[3],0);assert.equal(pixel(.3,.5)[3],255);
});
check('Rotated reserve excludes graphics while background and foreground media remain visible',()=>{
  const p=project(),l=PVFSpace.layer(p);l.width=.35;l.height=.5;l.base.rotation=30;p.layers.push(PVF.layer('shape','White graphic',{width:1,height:1,color:'#ffffff'}));
  const img=mk(20,20);img.getContext('2d').fillStyle='#20a080';img.getContext('2d').fillRect(0,0,20,20);img.naturalWidth=20;img.naturalHeight=20;
  PVFAssets.set('test-image',{kind:'image',element:img});p.assets.push({id:'test-image',width:20,height:20});p.layers.push(PVF.layer('image','Character',{assetId:'test-image',width:.1}));
  const pl=compile(p);R.frame(cv.getContext('2d'),pl,1,{scale:640/pl.W,noPost:true});assert.deepEqual(pixel(.5,.5),[32,160,128,255]);assert.deepEqual(pixel(.6,.5),[19,35,51,255]);assert.deepEqual(pixel(.1,.1),[255,255,255,255]);
});
check('Post effects cannot refill the protected pixels',()=>{
  const p=project(),l=PVFSpace.layer(p);l.width=.4;l.height=.7;p.layers.push(PVF.layer('shape','Full graphic',{width:1,height:1,color:'#ffffff'}));const pl=compile(p);
  const renderer=new J.Renderer();renderer.post.post=ctx=>{ctx.fillStyle='#ff00ff';ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);};
  renderer.frame(cv.getContext('2d'),pl,1,{scale:640/pl.W});assert.deepEqual(pixel(.5,.5),[19,35,51,255]);assert.deepEqual(pixel(.1,.1),[255,0,255,255]);
});
check('Side-band mapping responds to movement, top/bottom mode and collapse at the edge',()=>{
  const p=project(),l=PVFSpace.layer(p);l.width=.2;l.height=.4;l.base.x=.4;const pl=compile(p),original=PVF.clone(pl.cuts);
  const left=J.fusionZone(pl,{side:'left'},0),right=J.fusionZone(pl,{side:'right'},0);assert.ok(Math.abs(left.w-.3*pl.W)<1e-8);assert.ok(Math.abs(right.x-.5*pl.W)<1e-8);
  l.spaceDirection='tb';assert.ok(Math.abs(J.fusionZone(pl,{side:'right'},0).y-.7*pl.H)<1e-8);l.base.y=1;assert.ok(J.fusionZone(pl,{side:'right'},0).h>0);assert.deepEqual(PVF.clone(pl.cuts),original);
});
check('Turning off the region restores the unmasked scene and old projects need no space layer',()=>{
  const p=project();p.layers.push(PVF.layer('shape','Full graphic',{width:1,height:1,color:'#ffffff'}));p.jizura.centerFree=false;const pl=compile(p);R.frame(cv.getContext('2d'),pl,0,{scale:640/pl.W,noPost:true});assert.deepEqual(pixel(.5,.5),[255,255,255,255]);
  p.layers=p.layers.filter(l=>l.type!=='space');assert.equal(PVF.validate(p,J.defaultProject()).layers.length,p.layers.length);
});
check('AE subtraction masks invert the graphic world transform and animate their paths',()=>{
  const p=project();p.layers=p.layers.filter(l=>l.type==='space');const graphic=PVF.layer('shape','Test shape',{width:.7,height:.6,base:{x:.65,y:.6,scale:120,rotation:25,opacity:100}});p.layers.push(graphic);const pl=compile(p);
  class Props{constructor(){this.p={};this.keys=[];this.numKeys=0;this.value=[0,0];}property(k){return this.p[k]??=new Props();}addProperty(k){return this.property(k);}setValue(v){this.value=v;}setValueAtTime(t,v){this.keys.push([t,v]);this.numKeys++;}setInterpolationTypeAtKey(){}}
  class Comp{constructor(){this.entries=[];this.layers={addShape:()=>{const l=new Props();this.entries.push(l);return l;},addSolid:()=>new Props()};}openInViewer(){}get numLayers(){return 0;}}
  const main=new Comp(),alerts=[],l={...graphic,baked:PVFExports.bake(graphic,pl)};
  const spaceTrack=[{t:0,points:[[.3,.2],[.5,.2],[.5,.8],[.3,.8]]},{t:1,points:[[.4,.2],[.6,.2],[.6,.8],[.4,.8]]}];
  const sandbox={payload:{project:p,plan:J.planForAE(pl,p.jizura),layers:[l],spaceTrack},app:{beginUndoGroup:noop,endUndoGroup:noop,project:{items:{addFolder:()=>({}),addComp:()=>main}}},$:{global:{JZ_CORE:{build:()=>new Comp()}}},Shape:class{},MaskMode:{SUBTRACT:2},KeyframeInterpolationType:{LINEAR:1},alert:s=>alerts.push(s)};
  const fn=fs.readFileSync(root+'/src/exports.js','utf8').match(/function buildAE\(d\)\{[\s\S]*?\n  }\n/)[0];vm.runInNewContext('('+fn+')(payload)',sandbox);assert.ok(alerts[0].includes('AEP'),alerts[0]);
  const mask=main.entries[0].property('ADBE Mask Parade').property('ADBE Mask Atom');assert.equal(mask.maskMode,2);const keys=mask.property('ADBE Mask Shape').keys;assert.equal(keys.length,2);
  const v=keys[0][1].vertices[0],a=25*Math.PI/180,W=sandbox.payload.plan.width,H=sandbox.payload.plan.height;
  assert.ok(Math.abs(.65*W+1.2*(v[0]*Math.cos(a)-v[1]*Math.sin(a))-.3*W)<1e-6);assert.ok(Math.abs(.6*H+1.2*(v[0]*Math.sin(a)+v[1]*Math.cos(a))-.2*H)<1e-6);
});
(async()=>{
  const p=project();p.title='动态留白示例';p.captionMode='lines';p.jizura.songProfile='pop';p.jizura.style='paper';p.jizura.colors={enabled:false};p.jizura.lyrics='[00:00.00][end:4]留出空间 / 让画面呼吸\n[00:04.00][end:8]移动边界 / 跟随你的节奏';p.jizura.timing.tail=0;
  const l=PVFSpace.layer(p);for(const [frame,x,y,width,height,rotation]of [[0,.5,.5,.28,.8,0],[60,.68,.48,.32,.64,0],[120,.38,.55,.24,.7,-12],[180,.5,.5,.38,.5,8],[240,.5,.5,.28,.8,0]])PVF.insert(l,{frame,position:{x,y},width,height,rotation});
  const recipe=PVFPresets.catalog.find(r=>r.id==='collage');PVFPresets.look(p,recipe,9876);Object.assign(p.jizura.fx,{motion:.2,decor:0,texture:0,glitch:0,chroma:0,flash:false});p.jizura.overrides={0:{layout:'center',enter:'blur',exit:'blur',hold:'still',decor:[],bg:'none',treat:'none',cam:'push'},1:{layout:'center',enter:'blur',exit:'blur',hold:'still',decor:[],bg:'none',treat:'none',cam:'push'}};PVFPresets.replaceBackground(p,recipe,9876,8,108);const pl=compile(p);
  const pvf=await PVFExports.projectPackage(p,pl),map=PVFZip.unpack(await pvf.arrayBuffer()),restored=PVF.validate(JSON.parse(new TextDecoder().decode(map.get('project.json'))),J.defaultProject());assert.deepEqual(PVFSpace.layer(restored).rawSamples,l.rawSamples);
  fs.writeFileSync(root+'/examples/Dynamic-space.pvf',Buffer.from(await pvf.arrayBuffer()));pass++;console.log('PASS Portable project roundtrip preserves animated negative space');
  const ae=await PVFExports.aePackage(p,pl),files=PVFZip.unpack(await ae.arrayBuffer()),script=new TextDecoder().decode(files.get('build.jsx'));new vm.Script(script.replace(/^#target.*\n/,''));assert.ok(script.includes('spaceTrack'));assert.equal(JSON.parse(new TextDecoder().decode(files.get('compatibility.json'))).animatedNegativeSpace,true);fs.writeFileSync(root+'/examples/Dynamic-space-AE.zip',Buffer.from(await ae.arrayBuffer()));pass++;console.log('PASS AE package contains animated masks and compatibility declaration');
  const tiny={...pl,duration:.1},png=await J.exportPNGZip({plan:tiny,project:{...p.jizura,res:180},transparent:true});assert.ok(png.size>500);pass++;console.log('PASS Actual transparent PNG export with active animated reserve');
  const gallery=mk(1280,800),g=gallery.getContext('2d');g.fillStyle='#0e141c';g.fillRect(0,0,1280,800);
  for(const [i,t]of [1,2,4.8,6].entries()){R.frame(cv.getContext('2d'),pl,t,{scale:640/pl.W,noPost:true});g.drawImage(cv,(i%2)*640,Math.floor(i/2)*400+30);g.fillStyle='#b6c5d5';g.font='16px sans-serif';g.fillText(t.toFixed(1)+' s · animated space',(i%2)*640+16,Math.floor(i/2)*400+22);}
  fs.writeFileSync(root+'/examples/dynamic-space-preview.png',gallery.toBuffer('image/png'));
  fs.writeFileSync(root+'/tests/space-result.json',JSON.stringify({passed:pass,categoryPlans:240,canvas:'real @napi-rs/canvas',ae:'host API mock and package syntax, not real After Effects'},null,2));console.log(pass+' integration checks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
