/* Application handlers exercised against a small DOM fixture, not a real browser.
   Canvas drawing uses @napi-rs/canvas. No external website interaction. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),C=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||path.join(root,'node_modules'),'@napi-rs/canvas'));
const listeners={},raf=[],elements={},noop=()=>{};
class E{
  constructor(id,tag='DIV',attrs=''){this.id=id;this.tagName=tag.toUpperCase();this.style={};this.listeners={};this.options=[];this.dataset={};this._value='';this._html='';this.width=+(attrs.match(/width="(\d+)"/)||[])[1]||640;this.height=+(attrs.match(/height="(\d+)"/)||[])[1]||360;
    this.checked=/\bchecked\b/.test(attrs);this._value=(attrs.match(/\bvalue="([^"]*)"/)||[])[1]||'';this.classList={toggle:noop};}
  set innerHTML(s){this._html=s;this.options=Array.from(s.matchAll(/<option(?:\s+value="([^"]*)")?[^>]*>([^<]*)<\/option>/g),m=>({value:m[1]??m[2],textContent:m[2]}));if(!this._value&&this.options.length)this._value=this.options[0].value;}
  get innerHTML(){return this._html;}set value(v){this._value=String(v);}get value(){return this._value;}
  get selectedOptions(){return[this.options.find(o=>o.value===this.value)||{textContent:this.value}];}
  addEventListener(n,f){(this.listeners[n]??=[]).push(f);}fire(n,e={}){for(const f of this.listeners[n]||[])f({button:0,pointerId:1,preventDefault:noop,...e,target:this});}
  getBoundingClientRect(){return{left:0,top:0,width:this.id==='speedCanvas'?270:800,height:this.id==='speedCanvas'?120:this.id==='timeline'?(parseFloat(this.style.height)||170):450};}
  focus(){document.activeElement=this;}setAttribute(k,v){this[k]=String(v);}setPointerCapture(){}click(){this.onclick?.({target:this});}showModal(){this.open=true;}close(){this.open=false;}appendChild(){}remove(){}
}
const html=fs.readFileSync(root+'/src/studio.html','utf8');
for(const m of html.matchAll(/<(\w+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){const e=new E(m[3],m[1],m[2]);
  if(e.tagName==='CANVAS'){
    const c=C.createCanvas(e.width,e.height);Object.assign(c,{id:e.id,tagName:'CANVAS',style:e.style,listeners:e.listeners,
      addEventListener:E.prototype.addEventListener,fire:E.prototype.fire,getBoundingClientRect:E.prototype.getBoundingClientRect,focus:E.prototype.focus,setPointerCapture:noop});elements[e.id]=c;
  }else elements[e.id]=e;
}
for(const m of html.matchAll(/<select[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g))elements[m[1]].innerHTML=m[2];
elements.stage.parentElement=new E('area');elements.magnifier.firstElementChild=C.createCanvas(180,180);
global.window=global;global.innerWidth=1600;global.innerHeight=900;global.devicePixelRatio=1;global.Path2D=C.Path2D;global.DOMMatrix=C.DOMMatrix;global.Image=C.Image;
global.document={readyState:'complete',activeElement:null,createElement:n=>{if(n==='canvas'){const c=C.createCanvas(1,1);c.style={};return c;}return new E('',n);},
  getElementById:id=>elements[id]||null,querySelectorAll:()=>[],head:{appendChild:noop},fonts:{load:async()=>[],ready:Promise.resolve()},hidden:false,
  addEventListener:(n,f)=>(listeners[n]??=[]).push(f)};
global.localStorage={getItem:()=>null,setItem:noop};global.ResizeObserver=class{observe(){}};global.addEventListener=noop;
global.requestAnimationFrame=f=>raf.push(f);global.PVF_AE_CORE='';
for(const f of fs.readdirSync(root+'/vendor/jizura/src').filter(f=>f.endsWith('.js')).sort())vm.runInThisContext(fs.readFileSync(root+'/vendor/jizura/src/'+f,'utf8'),{filename:f});
for(const f of ['curves','core','scene','space','templates','presets','lyrics','captions','zip','renderer','exports','ui','app']){
  let source=fs.readFileSync(root+'/src/'+f+'.js','utf8');
  // Test-only access to state. The delivered HTML exposes no test hooks.
  if(f==='app')source=source.replace("  if(document.readyState==='loading')", "  window.__testState=S;\n  if(document.readyState==='loading')");
  vm.runInThisContext(source,{filename:f+'.js'});
}
function tick(){raf.shift()?.(performance.now());}
const el=id=>elements[id],S=global.__testState;let passed=0;function test(n,fn){fn();tick();passed++;console.log('PASS',n);}
const active=()=>S.project.layers.find(l=>l.id===S.selected);
function selectLayer(id,shift=false){el('layerList').onclick({shiftKey:shift,target:{closest:()=>({dataset:{layer:id}})}});tick();}
function frame(f){el('frameInput').value=f;el('frameInput').onchange();tick();}
function drag(id,a,b,extra={}){el(id).fire('pointerdown',{clientX:a[0],clientY:a[1],...extra});el(id).fire('pointermove',{clientX:b[0],clientY:b[1],...extra});el(id).fire('pointerup',{clientX:b[0],clientY:b[1],...extra});tick();}
test('Boot, plan statistics and initial Canvas paint',()=>{tick();assert.ok(el('planStats').textContent.includes('30 fps'));assert.ok(el('layerName').value.includes('歌词'));assert.ok(el('preview').toBuffer('image/png').length>1000);fs.writeFileSync(root+'/docs/preview-frame.png',el('preview').toBuffer('image/png'));});
test('Add text, point tracking and automatic frame advance',()=>{
  el('addText').click();assert.ok(el('layerName').value.includes('自由文字'));el('mode').value='single';el('mode').onchange();const before=+el('frameInput').value;
  el('overlay').fire('pointerdown',{clientX:200,clientY:225});tick();assert.equal(+el('frameInput').value,before+3);assert.equal(el('keyCount').textContent,'1 键');
});
test('Two-point scale/rotation uses one sample per completed pair',()=>{
  el('mode').value='two';el('mode').onchange();el('overlay').fire('pointerdown',{clientX:200,clientY:225});assert.equal(el('keyCount').textContent,'1 键');
  el('overlay').fire('pointerdown',{clientX:400,clientY:225});assert.equal(el('keyCount').textContent,'2 键');
  el('overlay').fire('pointerdown',{clientX:200,clientY:225});el('overlay').fire('pointerdown',{clientX:200,clientY:337.5});assert.equal(el('keyCount').textContent,'3 键');assert.ok(+el('rotation').value>80);
});
test('Undo restores the last whole edit',()=>{el('undo').click();assert.equal(el('keyCount').textContent,'2 键');el('redo').click();assert.equal(el('keyCount').textContent,'3 键');});
test('FPS changes preserve sample times to new frame precision',()=>{const before=+el('frameInput').value;el('fps').value='60';el('fps').onchange();tick();assert.equal(+el('frameInput').value,before*2);assert.ok(el('planStats').textContent.includes('60 fps'));});
test('Template regeneration retains manually authored layer tracks',()=>{const before=el('keyCount').textContent;el('generate').click();assert.equal(el('keyCount').textContent,before);});
test('Natural speed retiming and restore-original maintain source samples',()=>{el('retime').click();assert.ok(parseInt(el('keyCount').textContent)>3);el('resetRaw').click();assert.equal(el('keyCount').textContent,'3 键');});
test('Sketch path extends project duration and participates in undo',()=>{el('mode').value='path';el('mode').onchange();el('pathDuration').value='900';el('overlay').fire('pointerdown',{clientX:100,clientY:100});
  el('overlay').fire('pointermove',{clientX:200,clientY:150});el('overlay').fire('pointermove',{clientX:500,clientY:250});el('overlay').fire('pointerup');tick();const duration=el('timeReadout').textContent.split(' / ').at(-1).split(':');assert.ok(+duration[0]*60+ +duration[1]>=15);el('undo').click();});
test('Canvas click selects an independent object without writing keys or history',()=>{
  el('addShape').click();el('layerWidth').value=12;el('layerWidth').onchange();el('layerHeight').value=12;el('layerHeight').onchange();
  const id=S.selected,before=S.undo.length;el('mode').value='select';el('mode').onchange();el('overlay').fire('pointerdown',{clientX:400,clientY:225});el('overlay').fire('pointerup',{clientX:400,clientY:225});
  assert.equal(S.selected,id);assert.equal(active().rawSamples.length,0);assert.equal(S.undo.length,before);assert.equal(el('overlay').style.cursor,'default');
});
test('Canvas offset drag preserves raw and processed animation instead of adding a key',()=>{
  const l=active();PVF.insert(l,{frame:0,position:{x:.4,y:.5}});PVF.insert(l,{frame:60,position:{x:.6,y:.5}});l.processedSamples=PVF.retime(l);frame(30);
  const source=PVF.clone(l.rawSamples),processed=PVF.clone(l.processedSamples);el('canvasEditMode').value='offset';
  drag('overlay',[400,225],[440,225]);const moved=active();assert.equal(moved.rawSamples.length,2);assert.equal(moved.processedSamples.length,61);
  assert.ok(Math.abs(moved.rawSamples[0].position.x-source[0].position.x-.05)<1e-8);assert.ok(Math.abs(moved.processedSamples[25].position.x-processed[25].position.x-.05)<1e-8);
  el('undo').click();assert.deepEqual(active().rawSamples,source);
});
test('Current-frame drag writes one key and undo restores the processed path',()=>{
  el('canvasEditMode').value='key';frame(30);drag('overlay',[400,225],[424,234]);assert.equal(active().rawSamples.length,3);assert.equal(active().processedSamples.length,0);assert.equal(active().rawSamples[1].frame,30);
  el('undo').click();assert.equal(active().rawSamples.length,2);assert.equal(active().processedSamples.length,61);el('canvasEditMode').value='offset';
});
test('Canvas background marquee selects several separate shapes; Escape cancels drag',()=>{
  el('selectionFilter').value='background';drag('overlay',[1,1],[799,449]);assert.ok(S.selectedIds.length>=8);assert.equal(S.project.layers.filter(l=>l.generatedGroup).length,10);
  el('selectionFilter').value='foreground';selectLayer(S.project.layers.find(l=>l.name.startsWith('自由几何')).id);frame(30);const before=PVF.clone(active());
  el('overlay').fire('pointerdown',{clientX:400,clientY:225});el('overlay').fire('pointermove',{clientX:448,clientY:250});el('overlay').fire('pointercancel');assert.deepEqual(active(),before);el('selectionFilter').value='all';
});
test('Timeline shows all rows and independently marquee-selects source keyframes',()=>{
  const l=active(),rows=PVFScene.order(S.project).reverse(),i=rows.findIndex(a=>a.id===l.id),y=25+i*29+13,x=f=>116+667*f/S.project.fps/S.plan.duration;
  assert.ok(el('timeline').height>=25+S.project.layers.length*29);el('keySource').value='rawSamples';el('keySource').onchange();
  drag('timeline',[x(0)+7,y-11],[x(60)+7,y+11]);assert.equal(S.keySelection.length,1);assert.equal(S.keySelection[0].frame,60);assert.equal(active().rawSamples.length,2);
  drag('timeline',[x(60)+7,y-11],[x(0)-7,y+11]);assert.equal(S.keySelection.length,2);assert.equal(el('timeline').style.cursor,'default');
});
test('Timeline selected keys shift as a group; processed result invalidates once',()=>{
  const l=active(),i=PVFScene.order(S.project).reverse().findIndex(a=>a.id===l.id),y=25+i*29+13,x=f=>116+667*f/S.project.fps/S.plan.duration,dx=667*12/S.project.fps/S.plan.duration;
  drag('timeline',[x(60),y],[x(60)+dx,y]);assert.deepEqual(active().rawSamples.map(s=>s.frame),[12,72]);assert.equal(active().processedSamples.length,0);assert.deepEqual(S.keySelection.map(r=>r.frame),[12,72]);
  el('undo').click();assert.deepEqual(active().rawSamples.map(s=>s.frame),[0,60]);assert.equal(active().processedSamples.length,61);
});
test('Key copy/paste targets current frame and deletion respects locked keys',()=>{
  const id=active().id;S.keySelection=[{layerId:id,source:'rawSamples',frame:0},{layerId:id,source:'rawSamples',frame:60}];el('copyKeys').click();frame(90);el('pasteKeys').click();
  assert.deepEqual(active().rawSamples.map(s=>s.frame),[0,60,90,150]);assert.equal(S.keySelection.length,2);el('toggleKeysLock').click();assert.ok(active().rawSamples.filter(s=>s.frame>=90).every(s=>s.locked));
  el('deleteKeys').click();assert.equal(active().rawSamples.length,4);el('toggleKeysLock').click();el('deleteKeys').click();assert.deepEqual(active().rawSamples.map(s=>s.frame),[0,60]);
});
test('Shape properties and layer lock are independent of the template',()=>{
  el('shapeType').value='ellipse';el('shapeType').onchange();el('shapeFill').checked=false;el('shapeFill').onchange();el('shapeStroke').value=12;el('shapeStroke').onchange();
  assert.equal(active().shape,'ellipse');assert.equal(active().fill,false);assert.equal(active().stroke,12);el('layerLock').click();assert.equal(active().editLocked,true);assert.equal(el('addKey').disabled,true);el('layerLock').click();
});
test('Marquee tool can start on a full-frame background without moving it',()=>{
  const bg=PVF.layer('background','full media',{assetId:'dummy'});S.project.layers.unshift(bg);S.project.assets.push({id:'dummy',kind:'image',width:1920,height:1080,name:'dummy'});
  el('canvasMarquee').click();el('selectionFilter').value='all';const before=PVF.clone(bg.base);drag('overlay',[170,60],[630,420]);assert.ok(S.selectedIds.length>1);assert.deepEqual(S.project.layers.find(l=>l.id===bg.id).base,before);assert.equal(el('mode').value,'box');
  S.project.layers=S.project.layers.filter(l=>l.id!==bg.id);S.project.assets=S.project.assets.filter(a=>a.id!=='dummy');el('canvasSelect').click();
});
test('Selected corner scales contents; click and resize keep key times unchanged',()=>{
  el('addShape').click();const l=active();el('layerWidth').value=12;el('layerWidth').onchange();el('layerHeight').value=12;el('layerHeight').onchange();frame(30);
  // A 12% rectangle at the center has its bottom-right corner at (448, 252).
  drag('overlay',[448,252],[472,265.5]);assert.ok(Math.abs(active().base.scale-150)<.01);assert.equal(active().rawSamples.length,0);el('undo').click();assert.equal(active().base.scale,100);
});
test('One-click recipes replace unedited backgrounds and preserve manual/edited/locked layers',()=>{
  const manualId=active().id,edited=S.project.layers.find(l=>l.generatedGroup),lock=S.project.layers.filter(l=>l.generatedGroup)[1];
  selectLayer(edited.id);el('layerName').value='我的纸片';el('layerName').onchange();selectLayer(lock.id);el('layerLock').click();
  el('presetChoice').value='construct';el('oneClick').click();assert.equal(S.project.backgroundRecipe.id,'construct');assert.equal(S.project.jizura.style,'crimson');
  assert.ok(S.project.layers.some(l=>l.id===manualId));assert.ok(S.project.layers.some(l=>l.id===edited.id));assert.ok(S.project.layers.some(l=>l.id===lock.id));assert.equal(S.project.layers.filter(l=>l.generatedGroup).length,10);
  el('presetChoice').value='orbit';el('oneClick').click();assert.equal(S.project.layers.filter(l=>l.generatedGroup).length,10);assert.equal(S.project.jizura.style,'mint');
});
test('A caption can follow a tracked target while automatic text remains compiled',()=>{
  el('addText').click();const id=active().id,parent=S.project.layers.find(l=>l.type==='reticle');el('followLayer').value=parent.id;el('followLayer').onchange();
  assert.equal(active().followId,parent.id);frame(60);const q=PVF.world(active(),60,S.project,S.plan.W,S.plan.H),target=PVF.world(parent,60,S.project,S.plan.W,S.plan.H);assert.ok(Math.abs(q.x-target.x)<1e-8);
  const before=q;el('followLayer').value='';el('followLayer').onchange();assert.equal(active().followId,null);assert.equal(active().rawSamples.length,Math.ceil(S.plan.duration*S.project.fps));assert.ok(Math.abs(PVF.at(active(),60).x-before.x)<1e-8);assert.ok(S.plan.cuts.length>0);
});
test('Lyric tapping uses project time; apply keeps authored tracks; undo retains timing draft',()=>{
  const manual=S.project.layers.filter(l=>!l.generatedGroup&&l.type!=='caption').map(l=>({id:l.id,keys:PVF.clone(l.rawSamples)}));el('lyrics').value='第一句\n第二句\n第三句';el('timingClear').click();
  for(const f of [60,120,180]){frame(f);el('timingTap').click();}assert.deepEqual(S.timingRows.map(r=>r.start),[1,2,3]);assert.equal(S.timingCursor,3);
  el('timingBack').click();assert.equal(S.timingCursor,2);assert.equal(S.timingRows[2].start,null);frame(210);el('timingTap').click();S.project.jizura.timing.lineTimes={0:100};el('timingApply').click();assert.ok(S.project.jizura.lyrics.includes('[00:03.500]第三句'));assert.equal(S.plan.lines[0].start,1);
  assert.deepEqual(S.project.layers.filter(l=>!l.generatedGroup&&l.type!=='caption').map(l=>({id:l.id,keys:l.rawSamples})),manual);
  el('undo').click();assert.equal(S.project.lyricTimingDraft.rows[2].start,3.5);
});
test('Automatic sentences have separate controls, and lyric-row selection picks the matching sentence',()=>{
  el('demo').click();assert.equal(S.project.captionMode,'lines');const caps=S.project.layers.filter(l=>l.type==='caption');assert.equal(caps.length,4);
  assert.ok(caps.every(l=>l.followId==='lyrics'));el('lineList').onclick({target:{closest:s=>s==='[data-line]'?{dataset:{line:'1'}}:null}});
  assert.equal(active().captionLine,1);assert.equal(el('captionFields').hidden,false);assert.equal(el('inFrame').disabled,true);assert.equal(el('duplicateLayer').disabled,true);
});
test('Moving a sentence changes only its own outer track and preserves native compiled cuts',()=>{
  const id=active().id,before=PVF.clone(S.project.layers.filter(l=>l.type==='caption'&&l.id!==id)),cuts=JSON.stringify(S.plan.cuts);
  const old=active().base.x;el('posX').value=+el('posX').value+192;el('posX').onchange();assert.ok(Math.abs(active().base.x-old-.1)<1e-8);
  assert.deepEqual(S.project.layers.filter(l=>l.type==='caption'&&l.id!==id),before);assert.equal(JSON.stringify(S.plan.cuts),cuts);
  const q=PVF.world(active(),S.frame,S.project,S.plan.W,S.plan.H);assert.ok(Math.abs(q.x-.6)<1e-8);
  el('canvasEditMode').value='key';el('addKey').click();assert.equal(active().rawSamples.length,1);assert.equal(active().rawSamples[0].frame,S.frame);el('canvasEditMode').value='offset';
});
test('Sentence control on Canvas is picked and dragged without writing an unwanted key',()=>{
  for(const l of S.project.layers)if(l.type!=='caption'&&l.type!=='lyrics')l.visible=false;
  const l=active(),bounds=PVFScene.bounds(l,S.plan,S.frame,el('preview').getContext('2d'));
  // Compute the alpha bounds of the same untransformed native foreground.
  const rr=new J.Renderer(),c=C.createCanvas(800,450);rr.frame(c.getContext('2d'),S.plan,S.frame/S.project.fps,{scale:800/S.plan.W});
  const g=rr.lyricBounds(S.plan),q=PVFScene.pose(l,S.plan,S.frame),center=PVFScene.worldPoint(q,{x:g.cx,y:g.cy},S.plan);
  const a=[center.x*800/S.plan.W,center.y*450/S.plan.H],count=l.rawSamples.length,old=l.base.x;el('selectNone').click();tick();drag('overlay',a,[a[0]+24,a[1]]);
  assert.equal(S.selected,l.id);assert.equal(active().rawSamples.length,count);assert.ok(Math.abs(active().base.x-old-.03)<1e-8);
});
test('Collapsing and reopening sentence controls preserves IDs and authored keys',()=>{
  const captions=PVF.clone(S.project.layers.filter(l=>l.type==='caption'));el('captionMode').checked=false;el('captionMode').onchange();assert.equal(S.project.captionMode,'group');assert.equal(S.selected,'lyrics');
  el('captionMode').checked=true;el('captionMode').onchange();assert.deepEqual(S.project.layers.filter(l=>l.type==='caption'),captions);
});
test('Sentence FPS conversion changes each key time once and keeps cue alignment',()=>{
  const l=S.project.layers.find(l=>l.type==='caption'&&l.rawSamples.length);selectLayer(l.id);const keys=PVF.clone(l.rawSamples),id=l.id;
  el('fps').value=60;el('fps').onchange();assert.equal(active().id,id);assert.deepEqual(active().rawSamples.map(k=>k.frame),keys.map(k=>k.frame*2));
  assert.equal(active().inFrame,Math.round(active().captionBinding.start*60));el('fps').value=30;el('fps').onchange();
});
test('Per-sentence text rewrite preserves all cue times, ID, keys and sibling words',()=>{
  const l=active(),id=l.id,keys=PVF.clone(l.rawSamples),times=S.plan.lines.map(r=>[r.start,r.end]),siblings=S.plan.lines.map(r=>r.text);
  el('captionText').value='只修改/这一句文案';el('captionTextApply').click();assert.equal(active().id,id);assert.equal(active().text,'只修改这一句文案');assert.deepEqual(active().rawSamples,keys);
  assert.deepEqual(S.plan.lines.map(r=>[r.start,r.end]),times);for(let i=0;i<S.plan.lines.length;i++)if(i!==l.captionLine)assert.equal(S.plan.lines[i].text,siblings[i]);
  el('undo').click();assert.equal(active().text,siblings[l.captionLine]);
});
test('Removed edited sentence becomes an orphan and can relink without overwriting a modified target',()=>{
  const l=active(),id=l.id,keys=PVF.clone(l.rawSamples);el('lyrics').value='[00:00.600][end:3.3]全新的句子\n[00:06.600][end:9.2]轨迹由你/亲手掌控';el('lyrics').onchange();
  selectLayer(id);assert.equal(active().captionLine,null);assert.deepEqual(active().rawSamples,keys);assert.equal(el('captionRelinkFields').hidden,false);assert.equal(el('captionTextApply').disabled,true);
  const target=S.project.layers.find(a=>a.type==='caption'&&a.captionLine===0);PVF.insert(target,{frame:30,position:{x:.4,y:.4}});el('captionTarget').value=0;el('captionRelink').click();assert.equal(active().captionLine,null);assert.ok(el('status').textContent.includes('目标句已有'));
  const restored=S.project.layers.find(a=>a.id===target.id);restored.rawSamples=[];restored.captionEdited=false;el('captionRelink').click();assert.equal(active().id,id);assert.equal(active().captionLine,0);assert.ok(S.project.layers.some(a=>a.id===id));
});
test('Sentence reset respects key locks and removes only manual outer motion',()=>{
  const l=active();frame(l.inFrame+5);el('addKey').click();el('lockKey').click();const before=PVF.clone(l.rawSamples);el('captionReset').click();assert.deepEqual(active().rawSamples,before);assert.ok(el('status').textContent.includes('锁定关键帧'));
  el('lockKey').click();el('captionReset').click();assert.equal(active().rawSamples.length,0);assert.equal(active().followId,'lyrics');assert.equal(active().base.x,.5);assert.ok(S.plan.cuts.length>0);
});

test('Full JIZURA generation retains song category, chosen palette, edited shapes and sentence motion',()=>{
  el('presetChoice').value='jizura';el('profile').value='ballad';el('profile').onchange();el('style').value='sakura';el('style').onchange();
  const cap=S.project.layers.find(l=>l.captionLine===0);PVF.insert(cap,{frame:40,position:{x:.62,y:.45}});const id=cap.id,keys=PVF.clone(cap.rawSamples);
  el('oneClick').click();assert.equal(S.project.jizura.songProfile,'ballad');assert.equal(S.project.jizura.style,'sakura');assert.equal(S.project.templateBackground,true);assert.deepEqual(S.project.layers.find(l=>l.id===id).rawSamples,keys);
  const shots=()=>S.plan.cuts.filter(c=>c.layout!=='interlude').map(c=>({text:c.text,start:c.start,end:c.end,layout:c.layout,enter:c.enter,exit:c.exit,hold:c.hold}));const beforeShots=shots();el('backgroundGenerate').click();assert.deepEqual(shots(),beforeShots);
  el('presetChoice').value='orbit';el('oneClick').click();assert.equal(S.project.jizura.songProfile,'ballad');assert.ok(S.project.jizura.fx.motion<=J.SONG_PROFILES.ballad.fx.motion);
});
test('Expansion switches and free mode restore the complete random pool; manual templates stay editable',()=>{
  el('packExtra').checked=true;el('packExtra').onchange();el('profile').value='free';el('profile').onchange();assert.equal(S.project.jizura.extra,true);
  assert.equal(S.project.jizura.enabled.layout.pendulum,true);el('templateGroup').value='layout';el('templateGroup').onchange();el('templatePart').value='pendulum';el('applyTemplate').click();
  assert.ok(S.plan.cuts.filter(c=>c.line===S.line&&c.layout!=='interlude').every(c=>c.layout==='pendulum'),JSON.stringify({line:S.line,row:S.plan.lines[S.line],status:el('status').textContent,override:S.project.jizura.overrides[S.line],cuts:S.plan.cuts.filter(c=>c.line===S.line).map(c=>c.layout)}));
  el('resetTemplate').click();assert.equal(S.project.jizura.overrides[S.line],undefined);
});
test('Dynamic space creates one control, captures position and independent width/height at current frame',()=>{
  el('selectSpace').click();frame(0);assert.equal(active().type,'space');const id=active().id;
  el('canvasEditMode').value='key';el('addKey').click();const first=PVF.clone(active().rawSamples[0]);
  frame(30);el('spaceWidth').value=40;el('spaceWidth').onchange();el('spaceHeight').value=60;el('spaceHeight').onchange();el('posX').value=S.plan.W*.6;el('posX').onchange();
  assert.equal(active().rawSamples.length,2);assert.deepEqual(active().rawSamples[0],first);const q=PVF.at(active(),15);assert.ok(Math.abs(q.width-(first.width+.4)/2)<1e-9);assert.ok(Math.abs(q.height-(first.height+.6)/2)<1e-9);assert.ok(Math.abs(q.x-.55)<.001);
  el('selectSpace').click();assert.equal(active().id,id);assert.equal(S.project.layers.filter(l=>l.type==='space').length,1);
});
test('Dragging the space writes position keys and resizing a corner changes width and height separately',()=>{
  frame(60);const l=active(),q=PVF.at(l,S.frame);drag('overlay',[q.x*800,q.y*450],[q.x*800+32,q.y*450+15]);assert.equal(active().rawSamples.length,3);assert.ok(PVF.at(active(),60).x>q.x);
  frame(90);const a=PVFScene.bounds(active(),S.plan,S.frame,el('preview').getContext('2d')),corner=a.corners[2];
  drag('overlay',[corner.x/S.plan.W*800,corner.y/S.plan.H*450],[corner.x/S.plan.W*800+20,corner.y/S.plan.H*450-15]);
  const end=PVF.at(active(),90),prev=PVF.at(active(),60);assert.ok(end.width>prev.width);assert.ok(end.height<prev.height);assert.equal(active().rawSamples.length,4);
  el('undo').click();assert.equal(active().rawSamples.length,3);el('redo').click();assert.equal(active().rawSamples.length,4);
});
test('Space key locks, project validation, FPS conversion and mode toggling retain editable geometry',()=>{
  el('lockKey').click();const before=PVF.clone(active().rawSamples);el('spaceWidth').value=70;el('spaceWidth').onchange();assert.deepEqual(active().rawSamples,before);
  el('lockKey').click();const old=S.project.fps;el('fps').value=old===60?30:60;el('fps').onchange();assert.ok(active().rawSamples.some(k=>k.frame===Math.round(90*S.project.fps/old)&&Math.abs(k.width-before.at(-1).width)<1e-9));
  const restored=PVF.validate(S.project,J.defaultProject());assert.deepEqual(PVFSpace.layer(restored).rawSamples,active().rawSamples);
  el('centerFree').checked=false;el('centerFree').onchange();assert.equal(PVFSpace.active(S.plan,S.frame/S.project.fps),null);el('centerFree').checked=true;el('centerFree').onchange();assert.ok(PVFSpace.active(S.plan,S.frame/S.project.fps));
});
test('Space offset mode preserves key timing and refuses to move locked tracks',()=>{
  el('canvasEditMode').value='offset';const before=PVF.clone(active().rawSamples),q=PVF.at(active(),S.frame);drag('overlay',[q.x*800,q.y*450],[q.x*800-20,q.y*450]);
  assert.deepEqual(active().rawSamples.map(s=>s.frame),before.map(s=>s.frame));assert.ok(active().rawSamples[0].position.x<before[0].position.x);
  el('lockKey').click();const locked=PVF.clone(active().rawSamples);el('centerSpace').click();assert.deepEqual(active().rawSamples,locked);el('lockKey').click();
});

test('Workflow tabs switch panels without changing project or keyframe state',()=>{
  const before=JSON.stringify(S.project);el('tabStyle').click();assert.equal(el('panelStyle').hidden,false);assert.equal(el('panelMaterial').hidden,true);assert.equal(el('tabStyle')['aria-selected'],'true');
  el('goComposition').click();assert.equal(el('panelComposition').hidden,false);assert.equal(el('tabComposition').tabIndex,0);assert.equal(el('tabStyle').tabIndex,-1);
  el('tabMaterial').click();assert.equal(el('panelMaterial').hidden,false);assert.equal(JSON.stringify(S.project),before);
});
test('Tab keyboard navigation wraps and supports Home and End',()=>{
  el('tabMaterial').fire('keydown',{key:'ArrowLeft'});assert.equal(QFUI.current.left,'composition');assert.equal(document.activeElement,el('tabComposition'));
  el('tabComposition').fire('keydown',{key:'Home'});assert.equal(QFUI.current.left,'material');el('tabMaterial').fire('keydown',{key:'End'});assert.equal(QFUI.current.left,'composition');
  el('tabComposition').fire('keydown',{key:'ArrowRight'});assert.equal(QFUI.current.left,'material');
});
test('Header export entry reveals all export controls and return to properties preserves selection',()=>{
  const id=S.selected,project=JSON.stringify(S.project);el('showExport').click();assert.equal(el('panelExport').hidden,false);assert.equal(el('panelElements').hidden,true);assert.equal(el('editTitle').hidden,true);
  el('tabMotion').click();assert.equal(el('panelMotion').hidden,false);assert.equal(el('editTitle').hidden,false);el('backElements').click();assert.equal(el('panelElements').hidden,false);assert.equal(S.selected,id);assert.equal(JSON.stringify(S.project),project);
});
test('Selecting the dynamic space and current sentence opens the correct property panel',()=>{
  el('showExport').click();el('selectSpace').click();assert.equal(QFUI.current.right,'elements');assert.equal(el('spaceFields').hidden,false);
  frame(30);el('showExport').click();el('selectCaption').click();assert.equal(QFUI.current.right,'elements');assert.equal(el('panelElements').hidden,false);
});
test('Author dialog opens and closes without changing the project',()=>{
  const before=JSON.stringify(S.project);el('showAbout').click();assert.equal(el('aboutDialog').open,true);el('closeAbout').click();assert.equal(el('aboutDialog').open,false);assert.equal(document.activeElement,el('showAbout'));assert.equal(JSON.stringify(S.project),before);
  assert.ok(html.includes('Created by QFziyu'));assert.ok(html.includes('README-SOURCES.md'));assert.ok(html.includes('Qf-PV show V1'));
});
console.log(passed+' UI simulation checks passed');
fs.writeFileSync(root+'/tests/ui-simulation-result.json',JSON.stringify({passed,environment:'DOM fixture + real Canvas, no browser verification'},null,2));
