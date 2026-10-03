'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
global.MTCurve=require('../src/curves.js');
const F=require('../src/core.js'),Z=require('../src/zip.js');
global.window=global;require('../src/lyrics.js');
let passed=0;function test(name,fn){fn();console.log('PASS',name);passed++;}
const near=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
test('PCHIP speed integral: monotone, zero start, exact endpoint',()=>{
  const lut=MTCurve.buildSpeedProgressLut(F.naturalSpeed(),2000);near(lut[0].progress,0);near(lut.at(-1).progress,1);
  for(let i=1;i<lut.length;i++){assert.ok(lut[i].progress>=lut[i-1].progress);assert.ok(lut[i].speed>=0);}
  assert.throws(()=>MTCurve.buildSpeedProgressLut([{time:0,speed:0},{time:1,speed:0}]),/0/);
});
test('Retime preserves raw data, endpoints and locked frame/position',()=>{
  const l=F.layer('reticle','test');for(const[frame,x,y,locked]of[[0,0,0,false],[15,.2,.9,false],[40,.5,.5,true],[100,1,0,false]])F.insert(l,{frame,position:{x,y},locked});
  const raw=JSON.stringify(l.rawSamples),out=F.retime(l);assert.equal(JSON.stringify(l.rawSamples),raw);
  near(out[0].position.x,0);near(out.at(-1).position.x,1);assert.equal(out.at(-1).frame,100);
  const locked=out.find(s=>s.frame===40);assert.equal(locked.locked,true);near(locked.position.x,.5);near(locked.position.y,.5);
});
test('Smoothing preserves locked keys and does not cross their segment',()=>{
  const l=F.layer('text','test');for(let i=0;i<9;i++)F.insert(l,{frame:i,position:{x:i<4?0:1,y:i===2?1:0},locked:i===4});
  const before=JSON.stringify(l.rawSamples),out=F.smooth(l,5);assert.equal(JSON.stringify(l.rawSamples),before);
  assert.deepEqual(out[4],l.rawSamples[4]);assert.deepEqual(out[0],l.rawSamples[0]);assert.deepEqual(out[8],l.rawSamples[8]);
  assert.ok(out[2].position.x<=.2);assert.ok(out[2].position.y<1);
});
test('Key reduction preserves variable timing even on a straight spatial path',()=>{
  const l=F.layer('text','test');for(let f=0;f<=120;f++)F.insert(l,{frame:f,position:{x:(f/120)**3,y:.5},scale:100+50*Math.sin(f/120*Math.PI),rotation:f/10});
  const keys=F.simplify(l,2,1920,1080);assert.ok(keys.length<l.rawSamples.length);assert.ok(keys.length>2);
  for(const s of l.rawSamples){const p=F.at({...l,rawSamples:keys,processedSamples:[]},s.frame);
    assert.ok(Math.abs(p.x-s.position.x)*1920<=2.00001);assert.ok(Math.abs(p.scale-s.scale)<=.25001);assert.ok(Math.abs(p.rotation-s.rotation)<=.25001);}
});
test('Hold interpolation and duplicate-key overwrite',()=>{
  const l=F.layer('text','test');F.insert(l,{frame:0,position:{x:0,y:0},interpolation:'hold'});F.insert(l,{frame:10,position:{x:1,y:1}});
  near(F.at(l,9).x,0);near(F.at(l,10).x,1);F.insert(l,{frame:10,position:{x:.8,y:1}});assert.equal(l.rawSamples.length,2);near(F.at(l,10).x,.8);
});
test('PR import converts source timebase and normalizes canvas coordinates',()=>{
  const d={schemaVersion:2,target:{timebase:'10160640000',frameWidth:1920,frameHeight:1080},rawSamples:[{frameOffset:0,position:{x:960,y:540}},{frameOffset:25,position:{x:1920,y:0}}]};
  const a=F.importManual(d,30,13);assert.equal(a.rawSamples[0].frame,13);assert.equal(a.rawSamples[1].frame,43);near(a.rawSamples[0].position.x,.5);
});
test('Project validation merges nested defaults without modifying the caller',()=>{
  const j={fps:30,aspect:'16:9',res:1080,fx:{motion:.4,flash:false},timing:{bpm:0,tail:.9}},p=F.initial(j);p.jizura={aspect:'16:9',res:1080,fx:{decor:.2}};
  const out=F.validate(p,j);near(out.jizura.fx.motion,.4);near(out.jizura.fx.decor,.2);assert.deepEqual(j.fx,{motion:.4,flash:false});
  const zero=F.clone(p);zero.layers[0].speedCurve=[{time:0,speed:0},{time:1,speed:0}];F.validate(zero,j);
});
test('Follow transform respects aspect, rotation, scale, opacity and inverse mapping',()=>{
  const p=F.initial({}),a=F.layer('reticle','target',{base:{x:.25,y:.3,scale:200,rotation:90,opacity:80}}),b=F.layer('text','caption',{followId:a.id,base:{x:.6,y:.5,scale:80,rotation:-15,opacity:50}});p.layers.push(a,b);
  const q=F.world(b,0,p,1920,1080);near(q.x,.25);near(q.y,.3+384/1080);near(q.scale,160);near(q.rotation,75);near(q.opacity,40);
  const local=F.localPosition(b,q,0,p,1920,1080);near(local.x,.6);near(local.y,.5);assert.equal(F.canFollow(p,a.id,b.id),false);assert.equal(F.canFollow(p,b.id,a.id),true);
});
test('Key batches reject collisions atomically and keep locked obstacles stationary',()=>{
  const p=F.initial({}),l=F.layer('shape','paper',{generatedGroup:'recipe'}),b=F.layer('text','label');
  for(const f of [0,10,20])F.insert(l,{frame:f,position:{x:f/100,y:.5},locked:f===20});F.insert(b,{frame:2,position:{x:.2,y:.5}});l.processedSamples=F.retime(l);p.layers.push(l,b);
  const refs=[0,10].map(frame=>({layerId:l.id,source:'rawSamples',frame})),all=[...refs,{layerId:b.id,source:'rawSamples',frame:2}],before=F.clone(p);
  assert.equal(F.shiftKeys(p,all,10).delta,0);assert.deepEqual(p,before);
  const moved=F.shiftKeys(p,all,1);assert.equal(moved.delta,1);assert.deepEqual(l.rawSamples.map(s=>s.frame),[1,11,20]);assert.equal(b.rawSamples[0].frame,3);assert.equal(l.processedSamples.length,0);assert.equal(l.generatedEdited,true);
  const back=F.shiftKeys(p,moved.refs,-100);assert.equal(back.delta,-1);assert.deepEqual(l.rawSamples.map(s=>s.frame),[0,10,20]);assert.equal(l.rawSamples[2].locked,true);
});
test('Dense processed key selection shifts once and preserves source data',()=>{
  const l=F.layer('shape','dense'),p=F.initial({});l.rawSamples=[{frame:0,position:{x:0,y:0},scale:100,rotation:0,opacity:100,locked:false,interpolation:'linear'}];
  l.processedSamples=Array.from({length:6000},(_,frame)=>({...F.clone(l.rawSamples[0]),frame,position:{x:frame/6000,y:.5}}));p.layers.push(l);const before=F.clone(l.rawSamples);
  const refs=l.processedSamples.map(k=>({layerId:l.id,source:'processedSamples',frame:k.frame}));assert.equal(F.shiftKeys(p,refs,30).delta,30);assert.equal(l.processedSamples[0].frame,30);assert.equal(l.processedSamples.at(-1).frame,6029);assert.deepEqual(l.rawSamples,before);
  near(F.at(l,1234.5).x,1204.5/6000);
});
test('Whole-layer offsets preserve both streams and refuse locked trajectories',()=>{
  const l=F.layer('shape','paper');F.insert(l,{frame:0,position:{x:.2,y:.3}});F.insert(l,{frame:30,position:{x:.4,y:.7}});l.processedSamples=F.retime(l);
  const before=F.clone(l);assert.equal(F.offset(l,.1,-.05),true);near(l.rawSamples[0].position.x,.3);near(l.processedSamples[15].position.y,before.processedSamples[15].position.y-.05);
  F.setKeyLock(l,'rawSamples',0,true);const locked=F.clone(l);assert.equal(F.offset(l,1,1),false);assert.deepEqual(l,locked);
});
test('Locking a processed key creates a durable source constraint without destroying output',()=>{
  const l=F.layer('reticle','target');F.insert(l,{frame:0,position:{x:0,y:0}});F.insert(l,{frame:100,position:{x:1,y:1}});l.processedSamples=F.retime(l);
  const point=F.clone(l.processedSamples[35]);F.setKeyLock(l,'processedSamples',35,true);assert.equal(l.processedSamples.length,101);assert.equal(l.rawSamples.length,3);assert.ok(l.rawSamples[1].locked);
  const result=F.retime(l).find(s=>s.frame===35);assert.deepEqual(result.position,point.position);assert.equal(result.locked,true);F.setKeyLock(l,'processedSamples',35,false);assert.equal(l.rawSamples[1].locked,false);
});
test('Version 0.1 project defaults migrate and invalid follow cycles are rejected',()=>{
  const j={fps:30,aspect:'16:9',res:1080,fx:{},timing:{}},p=F.initial(j);delete p.layers[0].role;delete p.layers[0].editLocked;delete p.layers[0].followId;
  const q=F.validate(p,j);assert.equal(q.layers[0].role,'foreground');assert.equal(q.layers[0].editLocked,false);
  const a=F.layer('shape','a'),b=F.layer('shape','b');a.followId=b.id;b.followId=a.id;p.layers.push(a,b);assert.throws(()=>F.validate(p,j),/循环/);
});
test('Imported higher-fps paths deduplicate keys after project-fps conversion',()=>{
  const d={schemaVersion:2,target:{timebase:254016000000/120,frameWidth:1920,frameHeight:1080},rawSamples:[0,1,2,3,4].map(frameOffset=>({frameOffset,position:{x:frameOffset*100,y:540}}))};
  const keys=F.importManual(d,30).rawSamples;assert.deepEqual(keys.map(s=>s.frame),[0,1]);near(keys[0].position.x,100/1920);near(keys[1].position.x,400/1920);
});
test('Line tapping retains lyric text and yields exact sequential timestamps',()=>{
  const rows=PVFLyrics.parse('第一句/第一镜\n第二句\n第三句');[1.25,3.5,6].forEach((t,i)=>PVFLyrics.setStart(rows,i,t));
  assert.equal(PVFLyrics.serialize(rows),'[00:01.250][end:3.5]第一句/第一镜\n[00:03.500][end:6]第二句\n[00:06.000]第三句');
  const before=F.clone(rows);assert.throws(()=>PVFLyrics.setStart(rows,1,1),/上一句/);assert.deepEqual(rows,before);
});
test('Retapping invalidates only conflicting later timestamps and beat snap has a bounded window',()=>{
  const rows=PVFLyrics.parse('[00:01.0]one\n[00:02.0]two\n[00:03.0]three');PVFLyrics.setStart(rows,0,2.5);assert.equal(rows[1].start,null);assert.equal(rows[2].start,3);assert.equal(rows[1].text,'two');
  near(PVFLyrics.snap(1.08,[0,1,2]),1);near(PVFLyrics.snap(1.3,[0,1,2]),1.3);near(PVFLyrics.snap(5,[]),5);
});
test('Sentence project validation preserves stable IDs, both key streams and parent controls',()=>{
  const j={fps:30,aspect:'16:9',res:1080,fx:{},timing:{}},p=F.initial(j);p.captionMode='lines';
  const cap=F.layer('caption','line',{followId:'lyrics',captionLine:2,captionBinding:{text:'line',start:2,end:4,line:2,frameStart:60},captionNameCustom:true});
  F.insert(cap,{frame:60,position:{x:.6,y:.4}});F.insert(cap,{frame:90,position:{x:.8,y:.6}});cap.processedSamples=F.retime(cap);p.layers.push(cap);
  const out=F.validate(JSON.parse(JSON.stringify(p)),j),restored=out.layers[1];assert.equal(out.captionMode,'lines');assert.equal(restored.id,cap.id);assert.equal(restored.followId,'lyrics');assert.deepEqual(restored.rawSamples,cap.rawSamples);assert.deepEqual(restored.processedSamples,cap.processedSamples);assert.equal(restored.captionLine,null);assert.equal(restored.captionNameCustom,true);
});
test('Malformed sentence binding is rejected and old projects retain group mode by default',()=>{
  const j={fps:30,aspect:'16:9',res:1080,fx:{},timing:{}},p=F.initial(j);delete p.captionMode;assert.equal(F.validate(p,j).captionMode,'group');
  p.layers.push(F.layer('caption','broken',{captionBinding:{text:'word',start:'oops',end:2}}));assert.throws(()=>F.validate(p,j),/关联信息/);
});
(async()=>{
  const bytes=new Uint8Array([0,1,200,255]);const blob=Z.pack([['project.json','{"format":"PV-Fusion"}'],['assets/中文.bin',bytes]]),buffer=await blob.arrayBuffer();
  const m=Z.unpack(buffer);assert.deepEqual(m.get('assets/中文.bin'),bytes);assert.equal(new TextDecoder().decode(m.get('project.json')),'{"format":"PV-Fusion"}');
  const bad=buffer.slice(0);new Uint8Array(bad)[45]^=1;assert.throws(()=>Z.unpack(bad),/校验/);
  console.log('PASS portable ZIP roundtrip, UTF-8 names and CRC failure');passed++;
  fs.writeFileSync(__dirname+'/core-result.json',JSON.stringify({passed},null,2));console.log(passed+' tests passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
