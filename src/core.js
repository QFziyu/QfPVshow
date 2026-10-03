/* PV Fusion: host-independent project and motion model. Coordinates are normalized;
   key times are integer project frames. Raw and processed samples remain separate. */
(function (root) {
  'use strict';
  const M = root.MTCurve;
  const clone = x => JSON.parse(JSON.stringify(x));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const num = (x, fallback = 0) => Number.isFinite(Number(x)) ? Number(x) : fallback;
  const uid = () => 'l' + Math.random().toString(36).slice(2, 10);
  const naturalSpeed = () => [{time:0,speed:0},{time:.25,speed:.75},{time:.5,speed:1.5},{time:.75,speed:.75},{time:1,speed:0}];
  function layer(type, name, extra = {}) {
    return Object.assign({id:uid(),type,name,visible:true,inFrame:0,outFrame:null,
      base:{x:.5,y:.5,scale:100,rotation:0,opacity:100},rawSamples:[],processedSamples:[],
      speedCurve:naturalSpeed(),width:.16,height:.16,text:'自由文字',color:'#a7d8ff',size:100,scopeLine:null,assetId:null,
      role:type==='background'?'background':'foreground',editLocked:false,followId:null,
      shape:'rect',stroke:0,fill:true,generatedGroup:null,generatedEdited:false,
      captionBinding:null,captionLine:null,captionEdited:false,captionTimingHeld:false},extra);
  }
  function initial(jizura) {
    return {format:'PV-Fusion',schemaVersion:1,application:'Qf-PV show V1',editionAuthor:'QFziyu',title:'未命名 PV',fps:30,jizura,
      background:'#0b1625',bgOpacity:100,templateBackground:true,beatReact:0,captionMode:'group',
      layers:[layer('lyrics','自动歌词组',{id:'lyrics'})],assets:[]};
  }
  function samples(l) { return l.processedSamples.length ? l.processedSamples : l.rawSamples; }
  function cleanSample(s) {
    const p = s.position || {x:.5,y:.5};
    return {frame:Math.max(0,Math.round(num(s.frame))),position:{x:num(p.x,.5),y:num(p.y,.5)},
      scale:Math.max(.01,num(s.scale,100)),rotation:num(s.rotation),opacity:clamp(num(s.opacity,100),0,100),
      ...(s.width!=null?{width:clamp(num(s.width,.28),.01,2)}:{}),...(s.height!=null?{height:clamp(num(s.height,.7),.01,2)}:{}),
      interpolation:s.interpolation==='hold'?'hold':'linear',locked:!!s.locked};
  }
  function insert(l, s) {
    if(l.type==='space'){const q=at(l,s.frame);if(!samples(l).length&&s.frame>l.inFrame){const start=at(l,l.inFrame);l.rawSamples.push(cleanSample({...start,frame:l.inFrame,position:{x:start.x,y:start.y}}));}s={...q,...s};}
    const v=cleanSample(s), i=l.rawSamples.findIndex(x=>x.frame===v.frame);
    if(i<0)l.rawSamples.push(v);else l.rawSamples[i]=v;
    l.rawSamples.sort((a,b)=>a.frame-b.frame);l.processedSamples=[];return v;
  }
  function sampleIndex(a, frame) {
    if(!a.length)return -1;let lo=0,hi=a.length-1;
    while(lo<hi){const m=Math.ceil((lo+hi)/2);if(a[m].frame<=frame)lo=m;else hi=m-1;}return lo;
  }
  function findSample(a, frame) { const i=sampleIndex(a,frame);return i>=0&&a[i].frame===frame?a[i]:undefined; }
  function at(l, frame) {
    const a=samples(l), base=Object.assign({x:.5,y:.5,scale:100,rotation:0,opacity:100},l.base);
    if(l.type==='space'){base.width=l.width;base.height=l.height;}
    if(!a.length)return base;
    const i=sampleIndex(a,frame);
    const left=a[i],right=a[Math.min(i+1,a.length-1)];
    const k=frame<=left.frame||left.interpolation==='hold'||left===right?0:clamp((frame-left.frame)/(right.frame-left.frame),0,1);
    const mix=(x,y)=>x+(y-x)*k;
    return {...(l.type==='space'?{width:mix(left.width??l.width,right.width??l.width),height:mix(left.height??l.height,right.height??l.height)}:{}),x:mix(left.position.x,right.position.x),y:mix(left.position.y,right.position.y),
      scale:mix(left.scale,right.scale),rotation:mix(left.rotation,right.rotation),opacity:mix(left.opacity,right.opacity)};
  }
  function world(l, frame, project, W, H, seen=new Set()) {
    const q=at(l,frame),parent=project.layers.find(p=>p.id===l.followId);
    if(!parent||seen.has(l.id))return q;
    seen.add(l.id);const a=world(parent,frame,project,W,H,seen),r=a.rotation*Math.PI/180;
    const x=(q.x-.5)*W*a.scale/100,y=(q.y-.5)*H*a.scale/100;
    return {x:a.x+(x*Math.cos(r)-y*Math.sin(r))/W,y:a.y+(x*Math.sin(r)+y*Math.cos(r))/H,
      scale:a.scale*q.scale/100,rotation:a.rotation+q.rotation,opacity:a.opacity*q.opacity/100};
  }
  function localPosition(l, p, frame, project, W, H) {
    const parent=project.layers.find(a=>a.id===l.followId);if(!parent)return {x:p.x,y:p.y};
    const a=world(parent,frame,project,W,H),r=-a.rotation*Math.PI/180,s=Math.max(.0001,a.scale/100);
    const x=(p.x-a.x)*W,y=(p.y-a.y)*H;
    return {x:.5+(x*Math.cos(r)-y*Math.sin(r))/s/W,y:.5+(x*Math.sin(r)+y*Math.cos(r))/s/H};
  }
  function canFollow(project, id, parentId) {
    const seen=new Set([id]);let p=project.layers.find(l=>l.id===parentId);
    while(p){if(seen.has(p.id))return false;seen.add(p.id);p=project.layers.find(l=>l.id===p.followId);}return true;
  }
  function touch(l) { if(l.generatedGroup)l.generatedEdited=true;if(l.type==='caption')l.captionEdited=true; }
  function setKeyLock(l, source, frame, locked) {
    const key=l[source]&&findSample(l[source],frame);if(!key)return;
    key.locked=locked;
    for(const a of [l.rawSamples,l.processedSamples]){const s=findSample(a,frame);if(s)s.locked=locked;}
    if(source==='processedSamples'&&locked&&!l.rawSamples.some(s=>s.frame===frame)){
      l.rawSamples.push(cleanSample(key));l.rawSamples.sort((a,b)=>a.frame-b.frame);
    }
    touch(l);
  }
  function hasLocked(l) { return l.editLocked||l.rawSamples.some(s=>s.locked)||l.processedSamples.some(s=>s.locked); }
  function offset(l, dx, dy) {
    if(hasLocked(l))return false;
    l.base.x+=dx;l.base.y+=dy;
    for(const a of [l.rawSamples,l.processedSamples])for(const s of a){s.position.x+=dx;s.position.y+=dy;}
    touch(l);return true;
  }
  function keyRef(project, ref) {
    const l=project.layers.find(x=>x.id===ref.layerId),a=l?.[ref.source];
    return l&&Array.isArray(a)?{l,a,key:findSample(a,ref.frame)}:null;
  }
  // Validate the entire batch before mutation. Locked keys are stationary obstacles.
  function shiftKeys(project, refs, requested) {
    const moving=refs.map(ref=>({ref,...keyRef(project,ref)})).filter(v=>v.key&&!v.key.locked&&!v.l.editLocked);
    if(!moving.length)return {delta:0,refs:clone(refs),reason:'没有可移动的未锁定键'};
    const delta=Math.max(-moving.reduce((n,v)=>Math.min(n,v.key.frame),Infinity),Math.round(num(requested)));
    if(!delta)return {delta:0,refs:clone(refs)};
    const set=new Set(moving.map(v=>v.key)),arrays=new Set(moving.map(v=>v.a)),obstacles=new Map();
    for(const a of arrays)obstacles.set(a,new Set(a.filter(k=>!set.has(k)).map(k=>k.frame)));
    for(const v of moving)if(obstacles.get(v.a).has(v.key.frame+delta))
      return {delta:0,refs:clone(refs),reason:'目标帧已有关键帧，整组选中键保持原位'};
    const changed=new Map(moving.map(v=>[JSON.stringify(v.ref),v.key.frame+delta]));
    const rawLayers=new Set();
    for(const v of moving){v.key.frame+=delta;touch(v.l);if(v.ref.source==='rawSamples')rawLayers.add(v.l);}
    arrays.forEach(a=>a.sort((a,b)=>a.frame-b.frame));
    rawLayers.forEach(l=>l.processedSamples=[]);
    return {delta,refs:refs.map(ref=>({...ref,frame:changed.get(JSON.stringify(ref))??ref.frame}))};
  }
  function smooth(l, windowSize=5) {
    const a=clone(l.rawSamples), half=Math.floor(windowSize/2);
    if(a.length<3)return a;
    return a.map((s,i)=>{
      if(s.locked||i===0||i===a.length-1)return s;
      // A locked sample is a segment boundary, so smoothing never crosses it.
      let lo=Math.max(0,i-half),hi=Math.min(a.length-1,i+half);
      for(let j=i-1;j>=lo;j--)if(a[j].locked){lo=j;break;}
      for(let j=i+1;j<=hi;j++)if(a[j].locked){hi=j;break;}
      const q=a.slice(lo,hi+1);s.position={x:q.reduce((v,p)=>v+p.position.x,0)/q.length,y:q.reduce((v,p)=>v+p.position.y,0)/q.length};return s;
    });
  }
  function speedPoints(a) {
    if(!Array.isArray(a)||a.length<2)throw new Error('速度曲线至少需要两个点');
    const p=a.map(v=>({time:clamp(num(v.time),0,1),speed:clamp(num(v.speed),0,4)})).sort((x,y)=>x.time-y.time);
    p[0].time=0;p[p.length-1].time=1;
    for(let i=1;i<p.length;i++)if(p[i].time-p[i-1].time<.00001)throw new Error('速度点时间不能重复');
    return p;
  }
  function retime(l) {
    const raw=clone(l.rawSamples), output=[];
    if(raw.length<2)throw new Error('至少记录两个位置');
    const curve=speedPoints(l.speedCurve), lut=M.buildSpeedProgressLut(curve,1200);
    // Segment at locked keys: both their position and original frame are preserved.
    const bounds=[0];for(let i=1;i<raw.length-1;i++)if(raw[i].locked)bounds.push(i);bounds.push(raw.length-1);
    for(let b=1;b<bounds.length;b++){
      const a=raw.slice(bounds[b-1],bounds[b]+1), f0=a[0].frame,f1=a[a.length-1].frame;
      const pts=a.map(s=>s.position), total=M.cumulativeDistances(pts).at(-1);
      for(let f=f0;f<=f1;f++){
        if(output.length&&output.at(-1).frame===f)continue;
        const k=(f-f0)/Math.max(1,f1-f0), progress=M.speedProgressAtTime(lut,k);
        const st=at(Object.assign({},l,{rawSamples:a,processedSamples:[]}),f);
        const p=total?M.pointAtArcProgress(pts,progress):pts[0];
        output.push(cleanSample({...st,frame:f,position:p,scale:st.scale,rotation:st.rotation,opacity:st.opacity,
          locked:(f===f0&&a[0].locked)||(f===f1&&a.at(-1).locked)}));
      }
    }
    return output;
  }
  function simplify(l, pixels, W, H) {
    if(l.type==='space')return clone(samples(l)); // Retain independent size changes, including stationary resizing.
    // RDP controls geometry only; retain extra keys if removing them changes timing.
    const a=samples(l), scaled=a.map(s=>Object.assign({},s,{position:{x:s.position.x*W,y:s.position.y*H}}));
    const keep=new Set(M.rdp(scaled,pixels).map(s=>s.frame));
    for(let i=1;i<a.length-1;i++){
      const before=a[i-1],after=a[i+1],k=(a[i].frame-before.frame)/Math.max(1,after.frame-before.frame);
      const x=before.position.x+(after.position.x-before.position.x)*k,y=before.position.y+(after.position.y-before.position.y)*k;
      if(Math.hypot((x-a[i].position.x)*W,(y-a[i].position.y)*H)>pixels||
        Math.abs(a[i].scale-(before.scale+(after.scale-before.scale)*k))>.25||
        Math.abs(a[i].rotation-(before.rotation+(after.rotation-before.rotation)*k))>.25||
        Math.abs(a[i].opacity-(before.opacity+(after.opacity-before.opacity)*k))>.5||a[i].interpolation==='hold')keep.add(a[i].frame);
    }
    // Validate the complete approximation, not only local triples; insert worst errors until within tolerance.
    let keys=a.filter(s=>keep.has(s.frame)), changed=true;
    while(changed){changed=false;let worst=null,err=pixels;
      for(const s of a){const q=at({base:l.base,rawSamples:keys,processedSamples:[]},s.frame);
        const e=Math.max(Math.hypot((q.x-s.position.x)*W,(q.y-s.position.y)*H),Math.abs(q.scale-s.scale)*pixels/.25,
          Math.abs(q.rotation-s.rotation)*pixels/.25,Math.abs(q.opacity-s.opacity)*pixels/.5);
        if(e>err+1e-6){worst=s;err=e;}}
      if(worst){keep.add(worst.frame);keys=a.filter(s=>keep.has(s.frame));changed=true;}}
    return clone(keys);
  }
  function importManual(data, fps, startFrame=0) {
    if(data.schemaVersion!==2||!data.target||!Array.isArray(data.rawSamples))throw new Error('需要 ManualTracker schemaVersion 2 的追踪 JSON');
    const ticks=num(data.target.timebase), sourceFps=ticks>0?254016000000/ticks:fps;
    const convert=arr=>Array.from(new Map(arr.map(s=>{
      const p=s.normalizedPosition||[s.position.x/data.target.frameWidth,s.position.y/data.target.frameHeight];
      const key=cleanSample({frame:startFrame+Math.round(num(s.frameOffset)*fps/sourceFps),position:{x:p[0],y:p[1]},
        scale:s.scale,rotation:s.rotation,locked:s.locked,interpolation:s.interpolation===4?'hold':'linear'});
      return [key.frame,key];
    })).values()).sort((a,b)=>a.frame-b.frame);
    const imported={rawSamples:convert(data.rawSamples),processedSamples:convert(data.processedSamples||[]),speedCurve:speedPoints(data.speedCurve||naturalSpeed())};
    for(const key of imported.processedSamples.filter(k=>k.locked))setKeyLock(imported,'processedSamples',key.frame,true);
    return imported;
  }
  function validate(data, jDefault) {
    if(!data||data.format!=='PV-Fusion'||data.schemaVersion!==1)throw new Error('不支持此项目格式');
    if(![24,25,30,60,120].includes(data.fps))throw new Error('项目帧率无效');
    if(!Array.isArray(data.layers)||data.layers.length>200||!Array.isArray(data.assets))throw new Error('图层或素材表无效');
    const p=clone(data);p.jizura=Object.assign({},jDefault,p.jizura);p.jizura.fps=p.fps;
    p.jizura.fx=Object.assign({},jDefault.fx,p.jizura.fx);p.jizura.timing=Object.assign({},jDefault.timing,p.jizura.timing);
    if(!['16:9','4:3','1:1','9:16'].includes(p.jizura.aspect))throw new Error('画幅无效');
    if(![720,1080,1440].includes(p.jizura.res))throw new Error('输出分辨率无效');
    const ids=new Set();p.layers=p.layers.map(l=>{
      if(!['lyrics','caption','text','reticle','image','video','background','shape','space'].includes(l.type)||typeof l.id!=='string'||ids.has(l.id))throw new Error('图层类型或 ID 无效');ids.add(l.id);
      const v=Object.assign(layer(l.type,String(l.name||l.type)),l);
      for(const k of ['rawSamples','processedSamples']){if(!Array.isArray(v[k])||v[k].length>100000)throw new Error('关键帧数量异常');
        const map=new Map(v[k].map(s=>{const q=cleanSample(s);return[q.frame,q];}));v[k]=Array.from(map.values()).sort((a,b)=>a.frame-b.frame);}
      v.base=Object.assign({x:.5,y:.5,scale:100,rotation:0,opacity:100},v.base);
      for(const k of ['x','y','scale','rotation','opacity'])v.base[k]=num(v.base[k],k==='x'||k==='y'?.5:k==='scale'||k==='opacity'?100:0);
      v.base.scale=Math.max(.01,v.base.scale);v.base.opacity=clamp(v.base.opacity,0,100);
      v.width=clamp(num(v.width,.16),.001,5);v.height=clamp(num(v.height,.16),.001,5);v.stroke=clamp(num(v.stroke),0,200);
      v.role=['lyrics','caption'].includes(v.type)?'foreground':v.role==='background'||v.type==='background'?'background':'foreground';
      v.shape=['rect','ellipse','triangle','line','stripes'].includes(v.shape)?v.shape:'rect';
      v.editLocked=!!v.editLocked;v.generatedEdited=!!v.generatedEdited;v.captionEdited=!!v.captionEdited;v.captionNameCustom=!!v.captionNameCustom;
      if(v.type==='caption'){
        const b=v.captionBinding;if(!b||typeof b.text!=='string'||!Number.isFinite(b.start)||!Number.isFinite(b.end))throw new Error('独立字幕的关联信息无效');
        v.captionLine=null;v.captionTimingHeld=false;
      }
      for(const s of [...v.processedSamples].filter(s=>s.locked))setKeyLock(v,'processedSamples',s.frame,true);
      for(const s of v.rawSamples.filter(s=>s.locked))setKeyLock(v,'rawSamples',s.frame,true);
      v.speedCurve=speedPoints(v.speedCurve);return v;
    });
    if(p.layers.filter(l=>l.type==='space').length>1)throw new Error('项目只支持一个动态留白区域');
    for(const l of p.layers.filter(l=>l.type==='space')){l.spaceDirection=l.spaceDirection==='tb'?'tb':'lr';l.followId=null;l.role='foreground';l.base.opacity=100;l.width=clamp(l.width,.01,2);l.height=clamp(l.height,.01,2);}
    if(p.layers.filter(l=>l.type==='lyrics').length!==1)throw new Error('项目必须有且只有一个自动歌词组');
    p.captionMode=p.captionMode==='lines'?'lines':'group';
    for(const l of p.layers){if(l.followId&&!ids.has(l.followId))l.followId=null;
      if(l.followId&&!canFollow(p,l.id,l.followId))throw new Error('跟随图层不能形成循环');}
    return p;
  }
  root.PVF={clone,clamp,num,uid,naturalSpeed,layer,initial,samples,insert,at,sampleIndex,findSample,world,localPosition,canFollow,touch,setKeyLock,hasLocked,offset,keyRef,shiftKeys,smooth,retime,simplify,importManual,validate,speedPoints};
  if(typeof module!=='undefined')module.exports=root.PVF;
})(typeof window!=='undefined'?window:globalThis);
