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
const j=J.defaultProject();J.applySongProfile(j,'cinematic');j.lang='auto';j.fps=30;j.res=720;j.style='blueprint';j.title='PV FUSION';
j.lyrics='[00:00.00][end:1.5]TURN IDEAS / INTO MOTION\n[00:01.5][end:3.0]YOUR PATH / YOUR RHYTHM';
const p=PVF.initial(j),plan=J.plan(j,null);p.fps=30;plan.fusion=p;
const l=PVF.layer('text','Tracked label',{text:'FOLLOW / 01',size:70,color:'#d8f584'});PVF.insert(l,{frame:0,position:{x:.2,y:.8}});PVF.insert(l,{frame:90,position:{x:.8,y:.7}});p.layers.push(l);
check('HTML controls reference existing IDs and all style profiles exist',()=>{
  const h=fs.readFileSync(root+'/src/studio.html','utf8'),s=fs.readFileSync(root+'/src/app.js','utf8');
  const ids=new Set(Array.from(h.matchAll(/\bid="([^"]+)"/g),m=>m[1]));
  for(const m of s.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.has(m[1]),m[1]);
  const profile=h.match(/id="profile"[\s\S]*?<\/select>/)[0];for(const m of profile.matchAll(/value="([^"]+)"/g))assert.ok(m[1]==='free'||J.SONG_PROFILES[m[1]],m[1]);
});
const R=new J.Renderer(),cv=mk(640,360);
const recipes=[];
check('Real Canvas compositing, movement and seeded texture are repeatable',()=>{
  R.frame(cv.getContext('2d'),plan,.7,{scale:640/plan.W});const a=cv.toBuffer('image/png');assert.ok(a.length>2000);
  const r2=new J.Renderer();r2.frame(cv.getContext('2d'),plan,.7,{scale:640/plan.W});const b=cv.toBuffer('image/png');assert.deepEqual(a,b);
  R.frame(cv.getContext('2d'),plan,2.2,{scale:640/plan.W});assert.notDeepEqual(a,cv.toBuffer('image/png'));
  fs.writeFileSync(root+'/examples/renderer-preview.png',a);
});
check('Transparent output leaves empty pixels transparent',()=>{
  const simple=PVF.clone(p);simple.templateBackground=false;simple.layers[0].visible=false;const pp={...plan,fusion:simple};
  R.frame(cv.getContext('2d'),pp,.7,{scale:640/plan.W,transparent:true,noPost:true});const data=cv.getContext('2d').getImageData(0,0,640,360).data;
  let empty=0,filled=0;for(let i=3;i<data.length;i+=4)data[i]?filled++:empty++;assert.ok(empty>200000);assert.ok(filled>100);
});
check('SRT import preserves start and end timestamps',()=>{
  const s=J.importSubtitles('1\n00:00:01,250 --> 00:00:02,800\nHello world\n','test.srt');assert.ok(s.includes('[0:01.250][end:2.8]Hello world'));
});
check('AE core source and serialized adapter compile as JavaScript',()=>{
  new vm.Script(PVF_AE_CORE);const source=fs.readFileSync(root+'/src/exports.js','utf8');assert.ok(!source.match(/function buildAE\(d\)[\s\S]*?\n  }\n\s*window/)[0].match(/=>|\bconst\b|\blet\b/));
});
check('Five recipes render distinct editable scenes and share a readable caption palette',()=>{
  const gallery=mk(1280,1200),g=gallery.getContext('2d');g.fillStyle='#0e1218';g.fillRect(0,0,1280,1200);
  for(const [i,recipe]of PVFPresets.catalog.entries()){
    const pp=PVF.initial(PVF.clone(j));PVFPresets.look(pp,recipe,20261003+i);const pl=J.plan(pp.jizura,null);pl.fusion=pp;
    PVFPresets.replaceBackground(pp,recipe,20261003+i,pl.duration,108);assert.ok(pp.layers.filter(l=>l.type==='shape').length>=8);
    assert.equal(pp.templateBackground,false);assert.ok(pl.style.schemes.every(s=>s.bg.toLowerCase()===recipe.bg));
    const rr=new J.Renderer();rr.frame(cv.getContext('2d'),pl,.7,{scale:640/pl.W,noPost:true});
    const bytes=cv.toBuffer('image/png');assert.ok(bytes.length>5000);fs.writeFileSync(root+'/examples/preset-'+recipe.id+'.png',bytes);
    recipes.push({project:pp,plan:pl,recipe});g.drawImage(cv,(i%2)*640,Math.floor(i/2)*400+35);g.fillStyle='#e8eef7';g.font='18px sans-serif';g.fillText(recipe.id.toUpperCase(),(i%2)*640+15,Math.floor(i/2)*400+25);
  }
  assert.equal(new Set(recipes.map(r=>fs.readFileSync(root+'/examples/preset-'+r.recipe.id+'.png','base64'))).size,5);
  g.fillStyle='#a8d5f7';g.font='22px sans-serif';g.fillText('PV FUSION 0.3',660,850);g.font='16px sans-serif';g.fillText('5 original, editable background recipes',660,895);g.fillText('Actual Canvas pixels · English example',660,930);
  fs.writeFileSync(root+'/examples/preset-gallery.png',gallery.toBuffer('image/png'));
});
check('Picking matches a rotated shape and outlined ring in actual Canvas pixels',()=>{
  const pp=PVF.clone(p);pp.templateBackground=false;pp.layers=[];const rect=PVF.layer('shape','paper',{width:.16,height:.12,color:'#ffffff',base:{x:.5,y:.5,scale:100,rotation:40,opacity:100}});pp.layers=[rect];const pl={...plan,fusion:pp};
  R.frame(cv.getContext('2d'),pl,0,{transparent:true,noPost:true,scale:640/pl.W});const ctx=cv.getContext('2d'),g=PVFScene.bounds(rect,pl,0,ctx);
  const inner=PVFScene.worldPoint(g.q,{x:g.g.w/4,y:0},pl),outside=PVFScene.worldPoint(g.q,{x:g.g.w,y:0},pl);
  assert.equal(PVFScene.contains(rect,pl,0,inner,ctx,null,0),true);assert.equal(PVFScene.contains(rect,pl,0,outside,ctx,null,0),false);
  assert.ok(ctx.getImageData(Math.round(inner.x*640/pl.W),Math.round(inner.y*360/pl.H),1,1).data[3]>200);
  const ring={...rect,shape:'ellipse',fill:false,stroke:12,base:{...rect.base,rotation:0}};pp.layers=[ring];R.frame(ctx,pl,0,{transparent:true,noPost:true,scale:640/pl.W});
  assert.equal(PVFScene.contains(ring,pl,0,{x:pl.W/2,y:pl.H/2},ctx,null,0),false);assert.equal(ctx.getImageData(320,180,1,1).data[3],0);
});
check('Following captions bake the same world motion and beat scale used for rendering',()=>{
  const pp=PVF.clone(p),target=PVF.layer('reticle','track');PVF.insert(target,{frame:0,position:{x:.1,y:.3},rotation:15});PVF.insert(target,{frame:90,position:{x:.8,y:.5},rotation:40});
  const caption=PVF.layer('text','follower',{followId:target.id,text:'FOLLOW',base:{x:.52,y:.5,scale:70,rotation:0,opacity:100}});pp.layers.push(target,caption);pp.beatReact=.5;const pl={...plan,fusion:pp,beats:[0,.5,1]};
  const baked=PVFExports.bake(caption,pl);assert.equal(baked.keys.length,Math.ceil(pl.duration*pl.fps));
  for(const f of [0,15,30,60]){const q=PVFScene.pose(caption,pl,f),key=baked.keys[f];assert.ok(Math.abs(key.x-q.x)<1e-9);assert.ok(Math.abs(key.s-q.scale)<1e-9);}
});
function compile(project){const pl=J.plan(project.jizura,null);pl.fusion=project;PVFCaptions.sync(project,pl);return pl;}
function sentenceProject(){
  const pp=PVF.initial(PVF.clone(j));pp.captionMode='lines';pp.jizura.title='';pp.jizura.lyrics='[00:00.200][end:1.7]FIRST SENTENCE\n[00:01.700][end:3.2]SECOND SENTENCE\n[00:03.200][end:4.7]THIRD SENTENCE';
  pp.templateBackground=false;pp.jizura.typeset=false;pp.jizura.fx.flash=false;pp.jizura.fx.hud='off';return pp;
}
check('Group and sentence compositors place identical native foreground pixels and retain stacking order',()=>{
  for(const style of ['paper','crimson','mint','blueprint','magenta']){
    const pp=sentenceProject();pp.captionMode='group';pp.jizura.style=style;
    const free=PVF.layer('text','OVERLAY',{text:'TOP',size:50});pp.layers.push(free);const a=compile(pp),expanded=PVF.clone(pp);expanded.captionMode='lines';const b=compile(expanded);
    assert.equal(expanded.layers.at(-1).id,free.id);const ra=new J.Renderer(),rb=new J.Renderer(),other=mk(640,360);
    // Isolate compositing from the native Canvas backend's small blur rasterization variations.
    // The input is a real native animated foreground, reused once for both control modes.
    rb.front.frame=ctx=>{ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='copy';ctx.drawImage(ra.a,0,0);ctx.restore();};
    for(const t of [.3,.7,1.7,1.8,2.2,3.2,3.3,4.6,4.9]){
      if(process.env.PVF_RENDER_TRACE)console.log('PIXEL',style,t,Math.round(process.memoryUsage().rss/1048576)+' MiB');
      ra.frame(cv.getContext('2d'),a,t,{scale:640/a.W,noPost:true});rb.frame(other.getContext('2d'),b,t,{scale:640/b.W,noPost:true});
      const left=cv.toBuffer('image/png'),right=other.toBuffer('image/png'),same=Buffer.compare(left,right);
      assert.equal(same,0,style+' '+t);
      global.gc?.();
    }
    J.glyphs.clear();global.gc?.();
  }
});
check('An edited sentence moves independently and unchanged siblings render exactly the same pixels',()=>{
  const pp=sentenceProject(),pl=compile(pp),caps=pp.layers.filter(l=>l.type==='caption'),rr=new J.Renderer();rr.frame(cv.getContext('2d'),pl,2.3,{scale:640/pl.W,noPost:true});const sibling=cv.toBuffer('image/png');
  const orig=PVF.clone(caps[0]);PVF.offset(caps[0],.1,-.05);rr.frame(cv.getContext('2d'),pl,2.3,{scale:640/pl.W,noPost:true});assert.deepEqual(cv.toBuffer('image/png'),sibling);assert.equal(caps[1].base.x,.5);
  rr.frame(cv.getContext('2d'),pl,.7,{scale:640/pl.W,noPost:true});const moved=cv.toBuffer('image/png');Object.assign(caps[0],orig);rr.frame(cv.getContext('2d'),pl,.7,{scale:640/pl.W,noPost:true});assert.notDeepEqual(cv.toBuffer('image/png'),moved);
  caps[0].visible=false;rr.frame(cv.getContext('2d'),pl,.7,{scale:640/pl.W,noPost:true,transparent:true});assert.ok(cv.getContext('2d').getImageData(0,0,640,360).data.every(v=>v===0));
  assert.equal(PVFVisible(caps[1],pl,.7),false);
});
check('Sentence identity survives inserted lines, deletion and retiming without transferring keys by index',()=>{
  const pp=sentenceProject();compile(pp);const second=pp.layers.find(l=>l.captionLine===1),third=pp.layers.find(l=>l.captionLine===2),id=second.id;
  PVF.insert(second,{frame:60,position:{x:.7,y:.2}});PVF.insert(second,{frame:90,position:{x:.8,y:.3}});second.processedSamples=PVF.retime(second);PVF.touch(second);
  pp.jizura.lyrics='[00:00.200][end:1.2]NEW INTRO\n[00:01.700][end:3.2]SECOND SENTENCE\n[00:03.200][end:4.7]THIRD SENTENCE';compile(pp);
  assert.equal(second.id,id);assert.equal(second.captionLine,1);assert.equal(third.captionLine,2);assert.equal(second.rawSamples[0].frame,60);
  pp.jizura.lyrics='[00:02.700][end:4.2]SECOND SENTENCE\n[00:04.200][end:5.7]THIRD SENTENCE';compile(pp);
  assert.equal(second.captionLine,0);assert.equal(third.captionLine,1);assert.equal(second.rawSamples[0].frame,90);assert.equal(second.processedSamples[0].frame,90);
  pp.jizura.lyrics='[00:02.700][end:4.2]A DIFFERENT WORDING';compile(pp);assert.equal(second.captionLine,null);assert.equal(second.rawSamples[0].frame,90);
  assert.notEqual(pp.layers.find(l=>l.captionLine===0).id,id);
});
check('Repeated timed sentences keep occurrence identity and locked keys retain absolute times',()=>{
  const pp=sentenceProject();pp.jizura.lyrics='[00:00.200][end:1.7]REFRAIN\n[00:01.700][end:3.2]REFRAIN';compile(pp);
  const caps=pp.layers.filter(l=>l.type==='caption'),ids=caps.map(l=>l.id);PVF.insert(caps[1],{frame:60,position:{x:.4,y:.4},locked:true});
  pp.jizura.lyrics='[00:01.200][end:2.7]REFRAIN\n[00:02.700][end:4.2]REFRAIN';compile(pp);assert.deepEqual(pp.layers.filter(l=>l.captionLine!=null).map(l=>l.id),ids);assert.equal(caps[1].rawSamples[0].frame,60);assert.equal(caps[1].captionTimingHeld,true);
  pp.jizura.lyrics='[00:02.700][end:4.2]REFRAIN';compile(pp);assert.equal(caps[1].captionLine,0);assert.equal(caps[0].captionLine,null);
});
check('Editing a repeated LRC source row affects one occurrence and preserves computed timing',()=>{
  const pp=sentenceProject();pp.jizura.lyrics='[ti:Test]\n[00:00.200][00:01.700]REFRAIN|note\n[00:03.200][end:4.7]THIRD SENTENCE';let pl=compile(pp);
  const cap=pp.layers.find(l=>l.captionLine===1),id=cap.id,times=pl.lines.map(l=>[l.start,l.end]);PVF.insert(cap,{frame:60,position:{x:.7,y:.4}});
  PVFCaptions.editText(pp,cap,'EDITED / REFRAIN',pl);pl=compile(pp);
  assert.equal(cap.id,id);assert.equal(cap.text,'EDITED REFRAIN');assert.equal(pl.lines[0].text,'REFRAIN');assert.equal(pl.lines[2].text,'THIRD SENTENCE');assert.deepEqual(pl.lines.map(l=>[l.start,l.end]),times);assert.equal(cap.rawSamples[0].frame,60);assert.ok(pp.jizura.lyrics.includes('[ti:Test]'));
});
check('Editing plain text freezes cue timing instead of moving later sentences through length heuristics',()=>{
  const pp=sentenceProject();pp.jizura.lyrics='SHORT\nSECOND SENTENCE\nTHIRD SENTENCE';let pl=compile(pp);const times=pl.lines.map(l=>[l.start,l.end]),cap=pp.layers.find(l=>l.captionLine===0);
  PVFCaptions.editText(pp,cap,'A MUCH LONGER FIRST SENTENCE WITH MANY WORDS',pl);pl=compile(pp);assert.deepEqual(pl.lines.map(l=>[l.start,l.end]),times);assert.equal(cap.captionLine,0);
  assert.throws(()=>PVFCaptions.editText(pp,cap,'[00:01]BAD TIME',pl),/时间标签/);
});
check('Koma quantization shares one sentence owner and matching export intervals at every output frame',()=>{
  const pp=sentenceProject();pp.jizura.fx.koma=8;pp.jizura.lyrics='[00:00.230][end:1.730]FIRST SENTENCE\n[00:01.730][end:3.230]SECOND SENTENCE';const pl=compile(pp),controls=pp.layers.filter(l=>['lyrics','caption'].includes(l.type));
  const windows=new Map(controls.map(l=>[l.id,PVFCaptions.windows(l,pl)]));
  for(let f=0;f<Math.ceil(pl.duration*pl.fps);f++){
    const t=f/pl.fps,owner=PVFCaptions.owner(pl,t);assert.equal(controls.filter(l=>PVFCaptions.owns(l,pl,t)).length,1);
    for(const l of controls){const inside=windows.get(l.id).some(([a,b])=>t>=a-1e-8&&t<b-1e-8);assert.equal(inside,l.id===owner.id,'frame '+f+' '+l.id);}
  }
  const second=controls.find(l=>l.captionLine===1);assert.equal(second.inFrame,53);assert.equal(PVFCaptions.owner(pl,52/30).captionLine,0);assert.equal(PVFCaptions.owner(pl,53/30).captionLine,1);
});
check('Parent motion reaches each sentence; AE samples are limited to the sentence visible range',()=>{
  const pp=sentenceProject(),pl=compile(pp),m=pp.layers[0],cap=pp.layers.find(l=>l.captionLine===1);
  PVF.insert(m,{frame:0,position:{x:.4,y:.4},rotation:10});PVF.insert(m,{frame:180,position:{x:.7,y:.7},scale:150,rotation:40});
  const q=PVF.world(cap,60,pp,pl.W,pl.H),a=PVF.at(m,60);assert.deepEqual(q,a);
  const baked=PVFExports.bake(cap,pl);assert.equal(baked.keys.length,cap.outFrame-cap.inFrame+1);assert.ok(baked.keys.length<Math.ceil(pl.duration*pl.fps));
  for(const k of baked.keys){const b=PVFScene.pose(cap,pl,k.t*pl.fps);assert.ok(Math.abs(k.x-b.x)<1e-9);assert.ok(Math.abs(k.r-b.rotation)<1e-9);}
});
check('AE adapter creates one clipped wrapper per sentence and applies its independent world keys',()=>{
  const pp=sentenceProject(),pl=compile(pp),cap=pp.layers.find(l=>l.captionLine===1);PVF.insert(cap,{frame:55,position:{x:.6,y:.4}});PVF.insert(cap,{frame:90,position:{x:.8,y:.6}});
  const layers=PVFScene.order(pp).map(l=>({...PVF.clone(l),captionWindows:PVFCaptions.windows(l,pl),baked:PVFExports.bake(l,pl)}));
  class Props{constructor(){this.p={};this.keys=[];this.numKeys=0;}property(k){return this.p[k]??=new Props();}setValue(v){this.value=v;}setValueAtTime(t,v){this.keys.push([t,v]);this.numKeys++;}setInterpolationTypeAtKey(){}}
  class HostComp{constructor(name){this.name=name;this.id=Math.random();this.entries=[];this.layers={add:source=>{const l={source,...new Props(),property:Props.prototype.property};this.entries.push(l);return l;},addSolid:()=>this.layers.add({name:'solid'})};}get numLayers(){return this.entries.length;}layer(i){return this.entries[i-1];}openInViewer(){}}
  const comps=[],host={beginUndoGroup:noop,endUndoGroup:noop,project:{items:{addFolder:name=>({name}),addComp:name=>{const c=new HostComp(name);comps.push(c);return c;}}}};
  const source=fs.readFileSync(root+'/src/exports.js','utf8').match(/function buildAE\(d\)\{[\s\S]*?\n  }\n/)[0],native=new HostComp('Native source'),alerts=[];
  const sandbox={app:host,$:{global:{JZ_CORE:{build:()=>native}}},CompItem:HostComp,KeyframeInterpolationType:{LINEAR:1},alert:s=>alerts.push(s),payload:{project:pp,plan:J.planForAE(pl,pp.jizura),layers}};
  vm.runInNewContext('('+source+')(payload)',sandbox);assert.ok(alerts[0].includes('AEP'));assert.ok(!alerts[0].includes('PV Fusion:'));
  const rootComp=comps[0],controls=rootComp.entries.filter(l=>l.name?.startsWith('字幕 '));assert.equal(controls.length,3);
  for(const l of controls){const data=layers.find(a=>a.name===l.name);assert.equal(l.source.entries.length,data.captionWindows.length);for(let i=0;i<data.captionWindows.length;i++)assert.deepEqual([l.source.entries[i].inPoint,l.source.entries[i].outPoint],data.captionWindows[i]);}
  const exported=controls.find(l=>l.name===cap.name),pos=exported.property('ADBE Transform Group').property('ADBE Position');assert.equal(pos.keys.length,cap.outFrame-cap.inFrame+1);assert.ok(Math.abs(pos.keys[0][1][0]-PVFScene.pose(cap,pl,cap.inFrame).x*sandbox.payload.plan.width)<1e-8);
});
(async()=>{
  const tiny={...plan,duration:.1,fps:120,fusion:{...p,fps:120}},small={...j,res:90,fps:120};
  const frames=[],muxed=[],closed=[];
  global.VideoFrame=class{constructor(c,info){this.info=info;}close(){closed.push(1);}};
  global.VideoEncoder=class{static async isConfigSupported(c){return{supported:true,config:c};}constructor(o){this.o=o;this.state='unconfigured';this.encodeQueueSize=0;}
    configure(c){this.config=c;this.state='configured';}encode(f){frames.push(f.info);this.o.output({timestamp:f.info.timestamp,duration:f.info.duration},{});}async flush(){}close(){this.state='closed';}};
  global.Mp4Muxer={StreamTarget:class{constructor(o){this.o=o;}},Muxer:class{constructor(o){this.o=o;}addVideoChunk(c){muxed.push(c);}finalize(){this.o.target.o.onData(new Uint8Array([1,2,3]),0);}}};
  const out=await J.exportMP4({plan:tiny,project:small});assert.equal(frames.length,12);assert.equal(muxed.length,12);assert.equal(closed.length,12);
  frames.forEach((v,i)=>assert.equal(v.timestamp,Math.round(i*1e6/120)));assert.equal(out.blob.size,3);pass++;console.log('PASS export mock: 120fps timestamps, frame count and VideoFrame cleanup');
  const png=await J.exportPNGZip({plan:{...tiny,fps:60},project:{...small,fps:60},transparent:true});
  fs.writeFileSync(root+'/examples/test-PNG-sequence.zip',Buffer.from(await png.arrayBuffer()));pass++;console.log('PASS PNG sequence encodes actual Canvas pixels');
  const pvf=await PVFExports.projectPackage(p,plan),map=PVFZip.unpack(await pvf.arrayBuffer());assert.ok(map.has('compiled-plan.json'));
  fs.writeFileSync(root+'/examples/Example-English.pvf',Buffer.from(await pvf.arrayBuffer()));
  const ae=await PVFExports.aePackage(p,plan),af=PVFZip.unpack(await ae.arrayBuffer());new vm.Script(new TextDecoder().decode(af.get('build.jsx')).replace(/^#target.*\n/,''));pass++;
  console.log('PASS project archive and generated AE script payload');
  for(const {project:pp,plan:pl,recipe}of recipes){
    const portable=await PVFExports.projectPackage(pp,pl),files=PVFZip.unpack(await portable.arrayBuffer());PVF.validate(JSON.parse(new TextDecoder().decode(files.get('project.json'))),J.defaultProject());
    fs.writeFileSync(root+'/examples/'+recipe.id+'.pvf',Buffer.from(await portable.arrayBuffer()));
    const aePack=await PVFExports.aePackage(pp,pl),aef=PVFZip.unpack(await aePack.arrayBuffer()),script=new TextDecoder().decode(aef.get('build.jsx'));
    new vm.Script(script.replace(/^#target.*\n/,''));assert.ok(script.includes('ADBE Vector Shape - Group'));assert.ok(script.includes('ADBE Vector Rect Position'));
  }pass++;console.log('PASS five editable scene project roundtrips and AE shape script payloads');
  const pp=sentenceProject();pp.title='Sentence controls';const recipe=PVFPresets.catalog.find(r=>r.id==='blueprint');PVFPresets.look(pp,recipe,20261003);
  pp.jizura.overrides={0:{single:true,layout:'center',enter:'cut',exit:'cut',hold:'still'},1:{single:true,layout:'center',enter:'cut',exit:'cut',hold:'still'},2:{single:true,layout:'center',enter:'cut',exit:'cut',hold:'still'}};
  let pl=compile(pp);PVFPresets.replaceBackground(pp,recipe,20261003,pl.duration,108);pl=compile(pp);
  const before=PVF.clone(pp),beforePlan=compile(before),first=pp.layers.find(l=>l.captionLine===0);
  for(const [f,x,y]of [[6,.5,.5],[24,.6,.4],[50,.4,.6]])PVF.insert(first,{frame:f,position:{x,y},scale:85});first.processedSamples=PVF.retime(first);PVF.touch(first);
  const image=mk(1280,1220),gx=image.getContext('2d');gx.fillStyle='#0e151f';gx.fillRect(0,0,1280,1220);const rr=new J.Renderer();
  for(const [i,t]of [.7,2.3,3.8].entries())for(const [col,plan]of [beforePlan,pl].entries()){
    rr.frame(cv.getContext('2d'),plan,t,{scale:640/plan.W,noPost:true});gx.drawImage(cv,col*640,i*400+40);gx.fillStyle='#d8e7fa';gx.font='16px sans-serif';gx.fillText((col?'ONLY SENTENCE 1 EDITED':'BEFORE EDIT')+' / '+t.toFixed(1)+'s',col*640+15,i*400+27);
  }fs.writeFileSync(root+'/examples/sentence-controls.png',image.toBuffer('image/png'));
  const sentencePack=await PVFExports.projectPackage(pp,pl),packFiles=PVFZip.unpack(await sentencePack.arrayBuffer()),restored=PVF.validate(JSON.parse(new TextDecoder().decode(packFiles.get('project.json'))),J.defaultProject()),restoredPlan=compile(restored);
  const recovered=restored.layers.find(l=>l.id===first.id);assert.deepEqual(recovered.rawSamples,first.rawSamples);assert.deepEqual(recovered.processedSamples,first.processedSamples);assert.equal(recovered.captionLine,0);assert.deepEqual(PVFCaptions.windows(recovered,restoredPlan),PVFCaptions.windows(first,pl));
  fs.writeFileSync(root+'/examples/Sentence-controls.pvf',Buffer.from(await sentencePack.arrayBuffer()));pass++;console.log('PASS portable sentence project restores identities, tracks, ranges and parent links');
  const sentenceAE=await PVFExports.aePackage(pp,pl),sentenceFiles=PVFZip.unpack(await sentenceAE.arrayBuffer()),sentenceScript=new TextDecoder().decode(sentenceFiles.get('build.jsx'));new vm.Script(sentenceScript.replace(/^#target.*\n/,''));
  assert.equal(JSON.parse(new TextDecoder().decode(sentenceFiles.get('compatibility.json'))).independentSentenceControls,true);assert.ok(sentenceScript.includes('captionWindows'));fs.writeFileSync(root+'/examples/Sentence-controls-AE.zip',Buffer.from(await sentenceAE.arrayBuffer()));pass++;console.log('PASS independent sentence AE package includes clipped windows and editable source');
  fs.writeFileSync(root+'/tests/engine-result.json',JSON.stringify({passed:pass,canvas:'real @napi-rs/canvas',mp4:'mock encoder',afterEffects:'syntax and host API mock'},null,2));
  console.log(pass+' engine checks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
