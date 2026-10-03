(function(){
  'use strict';
  const F=PVF,$=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const S={project:null,plan:null,frame:0,selected:'lyrics',selectedIds:['lyrics'],line:0,playing:false,loop:true,dirty:true,undo:[],redo:[],pending:null,baseline:null,path:null,speedSelected:null,busy:false,
    keySelection:[],keyClipboard:[],canvasBox:null,timelineBox:null,timingRows:[],timingCursor:0,timingHistory:[],timingActive:false};
  let renderer=new J.Renderer(),timer=0,clock=0,ac=null,source=null,startAudio=0;
  const fps=()=>S.project.fps,selected=()=>S.project.layers.find(l=>l.id===S.selected)||null;
  const chosen=()=>S.project.layers.filter(l=>S.selectedIds.includes(l.id));
  const lyricId=()=>S.project.layers.find(l=>l.type==='lyrics').id;
  const status=(s,error=false)=>{$('status').textContent=s;$('status').style.color=error?'#ddb18b':'';};
  const maxFrame=()=>Math.max(0,Math.ceil(S.plan.duration*fps())-1);
  function demoProject(){
    const j=J.defaultProject();J.applySongProfile(j,'cinematic');
    Object.assign(j,{lang:'zh-Hans',style:'paper',fps:30,res:1080,aspect:'16:9',title:'在光里前行',unify:true,typeset:true,staticInterludes:true,
      lyrics:'[00:00.600][end:3.3]把灵感/变成画面\n[00:03.600][end:6.2]让文字/跟随节拍\n[00:06.600][end:9.2]轨迹由你/亲手掌控\n[00:09.600][end:12.0]在光里/继续前行'});
    const p=F.initial(j);p.title=j.title;p.captionMode='lines';
    const r=F.layer('reticle','运动路径演示',{text:'MOTION / 01',width:.075,color:'#cbb092',base:{x:.2,y:.8,scale:100,rotation:0,opacity:90}});
    for(const [frame,x,y] of [[0,.15,.78],[90,.32,.68],[180,.62,.78],[360,.85,.64]])F.insert(r,{frame,position:{x,y},scale:100,rotation:0,opacity:85});
    r.processedSamples=F.retime(r);p.layers.push(r);
    const recipe={...PVFPresets.catalog.find(r=>r.id==='blueprint'),style:'paper',bg:'#ebe5dc',colors:['#9a674a','#4d433a','#b39d84','#d4c5b4']};PVFPresets.look(p,recipe,20261003);j.unify=true;j.typeset=true;j.staticInterludes=true;PVFPresets.replaceBackground(p,recipe,20261003,12,108);return p;
  }
  function remember(){S.undo.push(F.clone(S.project));if(S.undo.length>30)S.undo.shift();S.redo=[];buttons();}
  function change(fn,plan=false){if(S.busy)return false;remember();try{fn();if(plan)replan();else refresh();saveDraft();return true;}
    catch(e){S.project=S.undo.pop();syncControls();replan();status(e.message,true);return false;}}
  function normalizeSelection(){
    const ids=new Set(S.project.layers.map(l=>l.id));
    if(S.selected&&!ids.has(S.selected))S.selected=lyricId();
    S.selectedIds=S.selectedIds.filter(id=>ids.has(id));
    if(S.selected&&!S.selectedIds.includes(S.selected))S.selectedIds=[S.selected];
    S.keySelection=S.keySelection.filter(ref=>F.keyRef(S.project,ref)?.key);
  }
  function buttons(){$('undo').disabled=!S.undo.length;$('redo').disabled=!S.redo.length;}
  function saveDraft(){clearTimeout(timer);timer=setTimeout(()=>{try{localStorage.setItem('qfpvshow.draft.v1',JSON.stringify(S.project));$('saveState').textContent=S.project.assets.length?'草稿 · 素材待保存':'草稿已保存';}
    catch(e){$('saveState').textContent='请下载完整项目';}},450);}
  function audioLike(){const a=PVFAssets.get(S.project.audioId)?.analysis;const bpm=+S.project.jizura.timing.bpm;
    if(a)return Object.assign({},a,{beats:bpm>0?J.beatGrid(bpm,0,a.duration):a.beats});return bpm>0?{beats:J.beatGrid(bpm,0,600)}:null;}
  function replan(){
    if(S.project.jizura.centerFree)PVFSpace.ensure(S.project);
    S.project.jizura.fps=fps();S.project.jizura.title=S.project.title;
    S.plan=J.plan(S.project.jizura,audioLike());S.plan.fusion=S.project;S.plan._baseDuration=S.plan.duration;
    PVFCaptions.sync(S.project,S.plan);extendDuration();
    S.frame=Math.min(S.frame,maxFrame());S.dirty=true;normalizeSelection();refreshLists();syncInspector();
    $('planStats').textContent=S.plan.W+' × '+S.plan.H+' · '+fps()+' fps · '+S.plan.cuts.length+' 镜头';
    fitStage();saveDraft();
  }
  function extendDuration(){let end=S.plan._baseDuration;for(const l of S.project.layers){
    if(l.type==='caption')continue;
    const a=F.samples(l);if(a.length)end=Math.max(end,(a.at(-1).frame+1)/fps());if(l.outFrame!=null)end=Math.max(end,(l.outFrame+1)/fps());}
    S.plan.duration=end;}
  function refresh(){S.plan.fusion=S.project;S.plan._captionByLine=new Map(S.project.layers.filter(l=>l.type==='caption'&&l.captionLine!=null).map(l=>[l.captionLine,l]));extendDuration();normalizeSelection();refreshLists();syncInspector();S.dirty=true;}
  function syncControls(){const p=S.project,j=p.jizura;
    for(const [id,v] of Object.entries({projectTitle:p.title,profile:j.songProfile,style:j.style,aspect:j.aspect,fps:p.fps,resolution:j.res,bpm:j.timing.bpm,lyrics:j.lyrics,motion:j.fx.motion,decor:j.fx.decor,beatReact:p.beatReact}))$(id).value=v;
    for(const [id,v] of Object.entries({templateBg:p.templateBackground,staticInterludes:j.staticInterludes,centerFree:j.centerFree,flash:j.fx.flash}))$(id).checked=v;
    $('captionMode').checked=p.captionMode==='lines';
    for(const [id,key]of Object.entries({packExtra:'extra',packWa:'wa',packTypo:'typo',packKinetic:'kinetic',packHorror:'horror'}))$(id).checked=!!j[key];
    $('spaceDirection').value=PVFSpace.layer(p)?.spaceDirection||(j.aspect==='9:16'?'tb':'lr');
    $('profileDescription').textContent=J.SONG_PROFILES[j.songProfile]?.desc||'自由搭配：使用已开启的完整模板库，手动编辑仍保留。';
    const timing=p.lyricTimingDraft;S.timingRows=F.clone(timing?.rows||[]);S.timingCursor=timing?.cursor||0;
    S.timingActive=!!S.timingRows.length;S.timingHistory=[];refreshTiming();
  }
  function refreshLists(){
    $('layerList').innerHTML=PVFScene.order(S.project).reverse().map(l=>`<div class="layer-item ${l.id===S.selected?'active':S.selectedIds.includes(l.id)?'multi':''} ${l.type==='caption'&&l.captionLine==null?'orphan':''}" role="button" tabindex="0" data-layer="${esc(l.id)}"><span>${l.editLocked?'▣':l.visible?'●':'○'} ${esc(l.name)}</span><small>${l.type==='caption'&&l.captionLine==null?'失联 · ':''}${F.samples(l).length} 键</small></div>`).join('');
    $('lineList').innerHTML=S.plan.lines.map((l,i)=>`<div class="line-item ${i===S.line?'active':''}" data-line="${i}"><span class="time">${l.start.toFixed(1)}s</span><span class="text">${esc(l.text||'间奏')}</span><button data-lock="${i}" title="锁定此行的自动编排">${S.project.jizura.overrides[i]?.lock?'◆':'◇'}</button></div>`).join('');
    $('scopeLine').innerHTML='<option value="">全片</option>'+S.plan.lines.map((l,i)=>`<option value="${i}">第 ${i+1} 行 · ${esc(l.text).slice(0,20)}</option>`).join('');
    $('followLayer').innerHTML='<option value="">不跟随</option>'+S.project.layers.filter(l=>l.id!==S.selected&&F.canFollow(S.project,S.selected,l.id)).map(l=>`<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('');
    $('captionTarget').innerHTML=S.plan.lines.flatMap((l,i)=>l.text&&!l.interlude?[`<option value="${i}">第 ${i+1} 句 · ${esc(l.text).slice(0,24)}</option>`]:[]).join('');
    const captions=S.project.layers.filter(l=>l.type==='caption'),missing=captions.filter(l=>l.captionLine==null).length,held=captions.filter(l=>l.captionTimingHeld).length;
    $('captionMode').checked=S.project.captionMode==='lines';
    $('captionStats').textContent=(S.project.captionMode==='lines'?'逐句编辑：'+captions.filter(l=>l.captionLine!=null).length+' 句。点选画面、歌词行或图层进入独立编辑。':'整组编辑；逐句轨迹保留，重新开启后恢复。')+(missing?' '+missing+' 句已失联，手工轨迹保留，可重新关联。':'')+(held?' '+held+' 句含锁定点，轨迹保留绝对时刻。':'');
    $('selectedCount').textContent=S.selectedIds.length+' 个元素';$('keySelectionCount').textContent=S.keySelection.length+' 个键';
    $('assetCount').textContent=S.project.assets.length;
    $('assetList').innerHTML=S.project.assets.map(a=>`<div class="asset-item"><span title="${esc(a.name)}">${esc(a.kind.toUpperCase()+' / '+a.name)}</span><span class="${PVFAssets.has(a.id)?'':'missing'}">${PVFAssets.has(a.id)?'已关联':'待关联'}</span></div>`).join('');
    $('templateTarget').textContent='当前行：'+(S.plan.lines[S.line]?.text||'尚无歌词');
    buttons();
  }
  function syncInspector(){const l=selected();
    const fields=['layerName','layerText','fontSize','layerColor','layerRole','shapeType','layerHeight','shapeStroke','shapeFill','followLayer','posX','posY','scale','rotation','opacity','inFrame','outFrame','scopeLine','layerWidth','addKey','lockKey','smooth','retime','resetRaw','simplify','importTracker','resetSpeed','uniformSpeed','duplicateLayer','deleteLayer','layerUp','layerDown','layerVisible','captionText','captionTextApply','captionReset','captionTarget','captionRelink','spaceWidth','spaceHeight'];
    for(const id of fields)$(id).disabled=!l||!!l.editLocked;
    $('layerLock').disabled=!l;
    $('editTitle').textContent=l?l.name+' · 独立关键帧'+(S.selectedIds.length>1?'（主选）':''):'点击或框选画面中的元素';
    $('spaceFields').hidden=l?.type!=='space';
    if(!l){$('keyCount').textContent='未选中元素';$('speedCanvas').getContext('2d').clearRect(0,0,$('speedCanvas').width,$('speedCanvas').height);return;}
    const q=F.at(l,S.frame),p=S.plan,w=F.world(l,S.frame,S.project,p.W,p.H);
    const vals={layerName:l.name,layerText:l.text,fontSize:l.size,layerColor:/^#[0-9a-f]{6}$/i.test(l.color)?l.color:'#a7d8ff',posX:Math.round(w.x*p.W),posY:Math.round(w.y*p.H),scale:q.scale.toFixed(2),rotation:q.rotation.toFixed(2),opacity:q.opacity.toFixed(1),inFrame:l.inFrame,outFrame:l.outFrame??'',scopeLine:l.scopeLine??'',layerWidth:+(l.width*100).toFixed(2),layerHeight:+(l.height*100).toFixed(2),shapeType:l.shape,shapeStroke:l.stroke,layerRole:l.role,followLayer:l.followId||''};
    for(const[id,v]of Object.entries(vals))if(document.activeElement!==$(id))$(id).value=v;
    $('textFields').hidden=!['text','reticle'].includes(l.type);
    if(l.type==='space'){ $('spaceWidth').value=+(q.width*100).toFixed(2);$('spaceHeight').value=+(q.height*100).toFixed(2); }
    const caption=l.type==='caption';$('captionFields').hidden=!caption;
    $('layerColorField').hidden=['lyrics','caption','space'].includes(l.type);
    if(caption){
      $('captionInfo').textContent=l.captionLine==null?'原文已移除或改写，轨迹仍保留。选择新句重新关联，或移除此失联图层。':'第 '+(l.captionLine+1)+' 句 · '+(l.inFrame/fps()).toFixed(2)+'–'+((l.outFrame+1)/fps()).toFixed(2)+' 秒。保留句内字效；跨句转场跟随新一句。'+(l.captionTimingHeld?' 含锁定点，轨迹未随打轴平移。':'');
      if(document.activeElement!==$('captionText'))$('captionText').value=l.text;
      $('captionRelinkFields').hidden=l.captionLine!=null;
      $('captionText').disabled=l.editLocked||l.captionLine==null;$('captionTextApply').disabled=$('captionText').disabled;
      for(const id of ['inFrame','outFrame','scopeLine','layerWidth','duplicateLayer'])$(id).disabled=true;
      $('deleteLayer').disabled=l.editLocked||l.captionLine!=null;
    }
    $('shapeFields').hidden=l.type!=='shape';$('shapeFill').checked=l.fill!==false;
    $('layerRole').disabled=['lyrics','caption','background','space'].includes(l.type)||l.editLocked;
    if(l.type==='space')for(const id of ['opacity','layerWidth','duplicateLayer','followLayer','importTracker'])$(id).disabled=true;
    $('layerLock').textContent=l.editLocked?'解锁元素':'锁定元素';
    $('followHint').textContent=l.followId?'位置显示为画面坐标；缩放和旋转为相对目标的局部变换。自动字幕内部动效保留。':'自动字幕保留内部动效，组运动可叠加人工轨迹或跟随一个追踪对象。';
    $('keyCount').textContent=F.samples(l).length+' 键';
    $('lockKey').textContent=activeKeys(l).find(s=>s.frame===S.frame)?.locked?'解锁当前键':'锁定当前键';
    drawSpeed();
  }
  function setSelection(ids,primary){S.selectedIds=[...new Set(ids)];S.selected=primary&&ids.includes(primary)?primary:S.selectedIds.at(-1)||null;S.pending=null;S.baseline=null;S.speedSelected=null;refresh();}
  function select(id,add=false){setSelection(add?(S.selectedIds.includes(id)?S.selectedIds.filter(x=>x!==id):[...S.selectedIds,id]):[id],id);}
  function selectLayerAt(id,add=false){
    const l=S.project.layers.find(l=>l.id===id);
    if(!add&&l?.type==='caption'&&l.captionLine!=null&&!PVFVisible(l,S.plan,S.frame/fps())){
      pause();seek(Math.min(l.outFrame,l.inFrame+Math.round(.35*fps())));S.line=l.captionLine;
    }select(id,add);
  }
  function focusEditor(){const l=selected();if(!l)return;QFUI.show('right','elements');$('editTitle').scrollIntoView?.({block:'nearest',behavior:'smooth'});$('layerName').focus();status('正在编辑“'+l.name+'”的独立关键帧。');}
  function seek(frame){S.frame=F.clamp(Math.round(frame),0,maxFrame());if(S.playing){clock=performance.now()-S.frame/fps()*1000;playAudio();}S.dirty=true;syncInspector();}
  function stopAudio(){if(source){try{source.stop();source.disconnect();}catch(e){}source=null;}}
  function playAudio(){stopAudio();const a=PVFAssets.get(S.project.audioId)?.analysis;if(!a)return;
    if(!ac)ac=new(window.AudioContext||window.webkitAudioContext)();ac.resume();const gain=ac.createGain();gain.gain.value=.7;gain.connect(ac.destination);
    source=ac.createBufferSource();source.buffer=a.buffer;source.connect(gain);const off=S.frame/fps();
    if(off<a.duration){source.start(0,off);startAudio=ac.currentTime-off;}else source=null;}
  function pause(){S.playing=false;stopAudio();$('play').textContent='▶';$('play').setAttribute('aria-label','播放');S.dirty=true;}
  function play(){if(S.busy)return;if(S.playing){pause();return;}S.playing=true;clock=performance.now()-S.frame/fps()*1000;playAudio();$('play').textContent='❚❚';$('play').setAttribute('aria-label','暂停');}
  function fitStage(){const area=$('stage').parentElement,r=area.getBoundingClientRect(),ratio=S.plan.W/S.plan.H;
    const w=Math.max(100,Math.min(r.width-32,(r.height-32)*ratio)),h=w/ratio;
    $('stage').style.width=w+'px';$('stage').style.height=h+'px';
    const pw=Math.round(Math.min(1100,w*devicePixelRatio)),ph=Math.round(pw/ratio);
    for(const id of ['preview','overlay']){$(id).width=pw;$(id).height=ph;}S.dirty=true;
  }
  function time(t){return String(Math.floor(t/60)).padStart(2,'0')+':'+(t%60).toFixed(3).padStart(6,'0');}
  function draw(){renderer.frame($('preview').getContext('2d'),S.plan,S.frame/fps(),{scale:$('preview').width/S.plan.W});
    drawOverlay();drawTimeline();$('timeReadout').textContent=time(S.frame/fps())+' / '+time(S.plan.duration);
    $('frameInput').value=S.frame;$('scrub').value=maxFrame()?Math.round(S.frame/maxFrame()*10000):0;
    const c=J.cutAt(S.plan,S.frame/fps());if(c&&c.line!==S.line&&c.line>=0){S.line=c.line;
      document.querySelectorAll('.line-item').forEach(e=>e.classList.toggle('active',+e.dataset.line===S.line));}
  }
  function tick(now){requestAnimationFrame(tick);if(S.busy)return;
    if(S.playing){let t=source&&ac?ac.currentTime-startAudio:(now-clock)/1000;
      if(t>=S.plan.duration){if(S.loop){seek(0);t=0;}else{pause();t=S.plan.duration-1/fps();}}
      const f=Math.floor(Math.max(0,t)*fps());if(S.frame!==f){S.frame=Math.min(f,maxFrame());S.dirty=true;}}
    if(S.dirty){S.dirty=false;try{draw();}catch(e){pause();status('渲染失败：'+e.message,true);}}
  }
  function point(e,cv=$('overlay')){const r=cv.getBoundingClientRect();return{x:F.clamp((e.clientX-r.left)/r.width,0,1),y:F.clamp((e.clientY-r.top)/r.height,0,1)};}
  function record(x,y,attrs={}){const l=selected();if(!l||l.editLocked)throw new Error('先选择一个未锁定元素');
    if(F.samples(l).some(k=>k.frame===S.frame&&k.locked)||l.rawSamples.some(k=>k.frame===S.frame&&k.locked))throw new Error('当前关键帧已锁定，请先解锁');
    const q=F.at(l,S.frame),position=F.localPosition(l,{x,y},S.frame,S.project,S.plan.W,S.plan.H);
    F.insert(l,{...q,frame:S.frame,position,scale:q.scale,rotation:q.rotation,opacity:q.opacity,interpolation:$('interpolation').value,...attrs});F.touch(l);}
  function elementBounds(l){return PVFScene.bounds(l,S.plan,S.frame,$('preview').getContext('2d'),['lyrics','caption'].includes(l.type)?renderer.lyricBounds(S.plan):null);}
  function eligible(l){return (l.type!=='space'||(S.project.jizura.centerFree&&S.selected===l.id))&&PVFVisible(l,S.plan,S.frame/fps())&&(l.type!=='lyrics'||PVFCaptions.owns(l,S.plan,S.frame/fps()))&&($('selectionFilter').value==='all'||PVFScene.isBack(l)===($('selectionFilter').value==='background'));}
  function hitObjects(p){const ctx=$('preview').getContext('2d'),pt={x:p.x*S.plan.W,y:p.y*S.plan.H};
    return PVFScene.order(S.project).reverse().filter(l=>eligible(l)&&PVFScene.contains(l,S.plan,S.frame,pt,ctx,['lyrics','caption'].includes(l.type)?renderer.lyricBounds(S.plan):null,6*S.plan.W/$('overlay').getBoundingClientRect().width));}
  function drawBox(x,box,W,H){if(!box)return;const a=box.start,b=box.end;x.fillStyle='#c3b6a622';x.strokeStyle='#c3b6a6';x.lineWidth=1;x.fillRect(a.x*W,a.y*H,(b.x-a.x)*W,(b.y-a.y)*H);x.strokeRect(a.x*W,a.y*H,(b.x-a.x)*W,(b.y-a.y)*H);}
  function drawOverlay(){const cv=$('overlay'),x=cv.getContext('2d'),l=selected(),w=cv.width,h=cv.height,k=w/S.plan.W;x.clearRect(0,0,w,h);
    const space=PVFSpace.active(S.plan,S.frame/fps());if(space&&$('guides').checked){const a=PVFSpace.corners(space,S.plan,S.frame);x.save();x.fillStyle='#c6ab8e12';x.strokeStyle='#c6ab8e';x.setLineDash([5,4]);x.beginPath();a.forEach((v,i)=>i?x.lineTo(v.x*k,v.y*k):x.moveTo(v.x*k,v.y*k));x.closePath();x.fill();x.stroke();x.setLineDash([]);x.font='11px sans-serif';x.fillStyle='#c6ab8e';x.fillText('留白区域 · 辅助框不导出',a[0].x*k+6,Math.max(14,a[0].y*k+16));x.restore();}
    for(const item of chosen())if(PVFVisible(item,S.plan,S.frame/fps())){
      const b=elementBounds(item);x.strokeStyle=item.editLocked?'#c88d72':item.id===S.selected?'#cbb092':'#c3b6a6';x.lineWidth=1.3;
      x.beginPath();b.corners.forEach((p,i)=>i?x.lineTo(p.x*k,p.y*k):x.moveTo(p.x*k,p.y*k));x.closePath();x.stroke();
      if(S.selectedIds.length===1&&!item.editLocked&&$('mode').value==='select'){
        x.fillStyle='#cbb092';for(const p of b.corners)x.fillRect(p.x*k-3,p.y*k-3,6,6);
        const top={x:(b.corners[0].x+b.corners[1].x)/2,y:(b.corners[0].y+b.corners[1].y)/2},r=b.q.rotation*Math.PI/180;
        const handle={x:top.x+Math.sin(r)*24/k,y:top.y-Math.cos(r)*24/k};x.beginPath();x.moveTo(top.x*k,top.y*k);x.lineTo(handle.x*k,handle.y*k);x.stroke();x.beginPath();x.arc(handle.x*k,handle.y*k,4,0,Math.PI*2);x.fill();
      }
    }
    drawBox(x,S.canvasBox,w,h);
    if(!$('guides').checked||!l||!PVFVisible(l,S.plan,S.frame/fps()))return;
    const samplePose=s=>F.world({...l,rawSamples:[s],processedSamples:[]},s.frame,S.project,S.plan.W,S.plan.H);
    const a=F.samples(l);if(a.length){x.strokeStyle='#c3b6a699';x.lineWidth=1.2;x.setLineDash([4,4]);x.beginPath();const step=Math.max(1,Math.ceil(a.length/800));
      for(let i=0;i<a.length;i+=step){const q=samplePose(a[i]);i?x.lineTo(q.x*w,q.y*h):x.moveTo(q.x*w,q.y*h);}const end=samplePose(a.at(-1));x.lineTo(end.x*w,end.y*h);x.stroke();x.setLineDash([]);
      const dotStep=Math.max(1,Math.ceil(l.rawSamples.length/500));let dots=0;for(const [i,s]of l.rawSamples.entries())if(dots<1500&&(i%dotStep===0||s.locked)){
        const q=samplePose(s);x.fillStyle=s.locked?'#cbb092':'#c3b6a6';x.beginPath();x.arc(q.x*w,q.y*h,s.locked?4:2.5,0,Math.PI*2);x.fill();dots++;}}
    const q=PVFScene.pose(l,S.plan,S.frame);x.strokeStyle='#cbb092';x.lineWidth=1.5;x.beginPath();x.arc(q.x*w,q.y*h,5,0,Math.PI*2);x.stroke();
    if(S.pending){x.fillStyle='#ddb18b';x.beginPath();x.arc(S.pending.x*w,S.pending.y*h,5,0,Math.PI*2);x.fill();}
    if(S.path?.length){x.strokeStyle='#cbb092';x.beginPath();S.path.forEach((s,i)=>i?x.lineTo(s.x*w,s.y*h):x.moveTo(s.x*w,s.y*h));x.stroke();}
  }
  const timelineRows=()=>PVFScene.order(S.project).reverse();
  const activeSource=l=>$('keySource').value==='processedSamples'&&l.processedSamples.length?'processedSamples':'rawSamples';
  const activeKeys=l=>l[activeSource(l)];
  const keyToken=ref=>JSON.stringify([ref.layerId,ref.source,ref.frame]);
  const keySelected=ref=>S.keySelection.some(r=>keyToken(r)===keyToken(ref));
  const timelineLayout=()=>({left:116,top:25,row:29,width:Math.max(10,$('timeline').getBoundingClientRect().width-133)});
  function drawTimeline(){const cv=$('timeline'),r=cv.getBoundingClientRect(),dpr=devicePixelRatio,w=Math.round(r.width*dpr),h=Math.round(170*dpr);
    const a=timelineLayout(),T=S.plan.duration,rows=timelineRows(),height=Math.max(160,a.top+rows.length*a.row+8),hh=Math.round(height*dpr),selectedTokens=new Set(S.keySelection.map(keyToken));
    cv.style.height=height+'px';if(cv.width!==w||cv.height!==hh){cv.width=w;cv.height=hh;}const x=cv.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,r.width,height);x.font='11px monospace';
    for(let i=0;i<=6;i++){const px=a.left+a.width*i/6;x.strokeStyle='#38332e';x.beginPath();x.moveTo(px,22);x.lineTo(px,height);x.stroke();x.fillStyle='#a69c90';x.fillText((T*i/6).toFixed(1)+'s',px+3,14);}
    rows.forEach((l,i)=>{const y=a.top+i*a.row;if(S.selectedIds.includes(l.id)){x.fillStyle=l.id===S.selected?'#38312a':'#2e2924';x.fillRect(0,y-1,r.width,a.row-2);}x.fillStyle=l.editLocked?'#c89e7d':'#ded5ca';x.font='11px sans-serif';x.fillText((l.editLocked?'▣ ':'')+l.name.slice(0,12),9,y+17);
      x.fillStyle=l.type==='caption'?(l.captionLine==null?'#614334':'#655444'):l.type==='lyrics'?'#8c7055':'#4e5048';const start=a.left+a.width*l.inFrame/fps()/T,end=l.outFrame==null?a.left+a.width:a.left+a.width*(l.outFrame+1)/fps()/T;x.fillRect(start,y+8,Math.max(1,end-start),10);
      const painted=new Set();for(const s of activeKeys(l)){const px=a.left+a.width*s.frame/fps()/T,sel=selectedTokens.has(keyToken({layerId:l.id,source:activeSource(l),frame:s.frame})),bin=Math.round(px)+(sel?'/s':s.locked?'/l':'/k');
        if(painted.has(bin))continue;painted.add(bin);x.fillStyle=sel?'#e6bd95':s.locked?'#cbb092':'#d6c8b7';x.beginPath();x.moveTo(px,y+6);x.lineTo(px+4,y+13);x.lineTo(px,y+20);x.lineTo(px-4,y+13);x.closePath();x.fill();if(sel){x.strokeStyle='#f4eee6';x.stroke();}}});
    const px=a.left+a.width*S.frame/fps()/T;x.strokeStyle='#cbb092';x.beginPath();x.moveTo(px,20);x.lineTo(px,height);x.stroke();x.fillStyle='#cbb092';x.fillRect(px-3,18,6,5);
    if(S.timelineBox){const b=S.timelineBox;x.fillStyle='#c3b6a622';x.strokeStyle='#c3b6a6';x.fillRect(b.start.x,b.start.y,b.end.x-b.start.x,b.end.y-b.start.y);x.strokeRect(b.start.x,b.start.y,b.end.x-b.start.x,b.end.y-b.start.y);}
    $('keySelectionCount').textContent=S.keySelection.length+' 个键';
  }
  function speedMap(e){const p=point(e,$('speedCanvas'));return{time:F.clamp((p.x-.075)/.88,0,1),speed:F.clamp((.88-p.y)/.72*3,0,3)};}
  function drawSpeed(){const cv=$('speedCanvas'),x=cv.getContext('2d'),w=cv.width,h=cv.height,p=selected()?.speedCurve;if(!p)return;
    x.clearRect(0,0,w,h);const X=t=>w*(.075+.88*t),Y=s=>h*(.88-.72*s/3);x.strokeStyle='#3a342d';x.lineWidth=1;x.font='13px sans-serif';x.fillStyle='#a69c90';
    for(let i=0;i<=3;i++){x.beginPath();x.moveTo(X(0),Y(i));x.lineTo(X(1),Y(i));x.stroke();x.fillText(i+'',8,Y(i)+4);}x.fillText('0%',X(0),h-4);x.fillText('时间 → 100%',X(1)-93,h-4);
    const slopes=MTCurve.pchipSlopes(p);x.strokeStyle='#c3b6a6';x.lineWidth=2.5;x.beginPath();for(let i=0;i<=180;i++){const px=X(i/180),py=Y(MTCurve.evaluateSpeedCurve(p,i/180,slopes));i?x.lineTo(px,py):x.moveTo(px,py);}x.stroke();
    p.forEach((v,i)=>{x.fillStyle=i===S.speedSelected?'#cbb092':'#c3b6a6';x.beginPath();x.arc(X(v.time),Y(v.speed),5,0,Math.PI*2);x.fill();});
  }
  async function pick(accept,multiple=false){const inp=$('fileInput');inp.value='';inp.accept=accept;inp.multiple=multiple;
    return new Promise(resolve=>{inp.onchange=()=>resolve(Array.from(inp.files));inp.oncancel=()=>resolve([]);inp.click();});}
  async function loadAsset(file,meta){
    const kind=meta?.kind||(file.type.startsWith('video/')?'video':file.type.startsWith('audio/')?'audio':'image');
    const a=meta||{id:F.uid(),name:file.name,kind,mime:file.type,size:file.size};let obj={file,kind};
    if(kind==='audio')obj.analysis=await J.analyzeAudio(file);
    else{
      const url=URL.createObjectURL(file),el=kind==='video'?document.createElement('video'):new Image();obj.url=url;obj.element=el;
      if(kind==='video'){el.muted=true;el.preload='auto';el.playsInline=true;}
      await new Promise((resolve,reject)=>{el[kind==='video'?'onloadeddata':'onload']=resolve;el.onerror=()=>reject(new Error('不能解码素材：'+file.name));el.src=url;});
      a.width=el.videoWidth||el.naturalWidth;a.height=el.videoHeight||el.naturalHeight;if(kind==='video'){a.duration=el.duration;el.addEventListener('seeked',()=>S.dirty=true);}
    }
    const old=PVFAssets.get(a.id);if(old?.url)URL.revokeObjectURL(old.url);PVFAssets.set(a.id,obj);return a;
  }
  async function importMedia(kind){try{const files=await pick(kind==='audio'?'audio/*':'image/*,video/*',kind==='foreground');if(!files.length)return;
    pause();remember();for(const file of files){const actual=kind==='audio'?'audio':file.type.startsWith('video/')?'video':'image';
      const a=await loadAsset(file,{id:F.uid(),name:file.name,kind:actual,mime:file.type,size:file.size});
      if(kind==='audio'){if(S.project.audioId){S.project.assets=S.project.assets.filter(x=>x.id!==S.project.audioId);}S.project.audioId=a.id;S.project.jizura.audioName=a.name;}
      S.project.assets.push(a);if(kind!=='audio'){const l=F.layer(kind==='background'?'background':actual,a.name,{assetId:a.id,width:.36,outFrame:actual==='video'?Math.max(0,Math.floor(a.duration*fps())-1):null});
        if(kind==='background')S.project.layers.unshift(l);else S.project.layers.push(l);S.selected=l.id;}}
    replan();status('素材已导入；保存完整项目可将素材一起带走。');
  }catch(e){status(e.message,true);}}
  async function relink(){try{const files=await pick('image/*,video/*,audio/*',true);if(!files.length)return;for(const file of files){
    const metas=S.project.assets.filter(a=>a.name===file.name&&a.size===file.size);if(!metas.length){status('没有匹配素材：'+file.name,true);continue;}
    for(const a of metas)await loadAsset(file,a);}
    replan();status('素材重新关联完成。');}catch(e){status(e.message,true);}}
  async function openProject(){try{const files=await pick('.pvf,.zip,.json');if(!files.length)return;const file=files[0];let data,map;
    if(/\.(pvf|zip)$/i.test(file.name)){map=PVFZip.unpack(await file.arrayBuffer());data=JSON.parse(new TextDecoder().decode(map.get('project.json')));}
    else data=JSON.parse(await file.text());
    if(data.format!=='PV-Fusion'&&data.lyrics!=null){const old=Object.assign(J.defaultProject(),data);data=F.initial(old);data.fps=old.fps;data.title=old.title||'JIZURA 导入项目';}
    const p=F.validate(data,J.defaultProject());pause();
    if(map)for(const a of p.assets){const bytes=map.get(a.packagePath);if(!bytes)throw new Error('缺少包内素材：'+a.name);await loadAsset(new File([bytes],a.name,{type:a.mime}),a);}
    remember();S.project=p;S.frame=0;S.selected=lyricId();S.selectedIds=[S.selected];S.keySelection=[];S.pending=null;S.baseline=null;syncControls();replan();
    status(p.assets.some(a=>!PVFAssets.has(a.id))?'项目已打开；JSON 不包含素材，请点击“重新关联素材”。':'完整项目已打开。');
  }catch(e){status('打开失败：'+e.message,true);}}
  async function runExport(type){if(S.busy)return;pause();S.busy=true;window.PVFExporting=true;
    const control=new AbortController();$('progressDialog').showModal();$('progressTitle').textContent={mp4:'导出 MP4',png:'导出 PNG 序列',ae:'生成 AE 工程包',project:'保存完整项目',wav:'导出 WAV',json:'导出项目 JSON'}[type];
    $('progressBar').value=0;$('progressText').textContent='正在准备…';$('cancelExport').disabled=false;$('cancelExport').onclick=()=>{control.abort();$('progressText').textContent='正在取消…';};
    const progress=(v,msg)=>{$('progressBar').value=v;$('progressText').textContent=msg;};
    const name=PVFExports.safeName(S.project.title);let blob,ext,warning='';
    try{
      // Give the progress dialog a paint before synchronous work.
      await new Promise(r=>requestAnimationFrame(r));
      const audio=PVFAssets.get(S.project.audioId)?.analysis;
      if(type==='mp4'||type==='png'||type==='ae')for(const l of S.project.layers)if(l.visible&&l.assetId&&!PVFAssets.has(l.assetId))throw new Error('缺少素材，请先重新关联：'+l.name);
      if(S.project.audioId&&!audio&&['mp4','ae','wav'].includes(type))throw new Error('音频尚未关联，请重新选择同名音乐');
      if(type==='mp4'){
        if(audio&&!await J.pickAudioCodec(48000,Math.min(2,audio.buffer.numberOfChannels)))throw new Error('当前浏览器没有可用的音频编码器；请导出 PNG 和 WAV，或更换 Chrome / Edge。');
        const out=await J.exportMP4({plan:S.plan,project:S.project.jizura,audio,onProgress:progress,signal:control.signal});blob=out.blob;ext='.mp4';
      }else if(type==='png'){blob=await J.exportPNGZip({plan:S.plan,project:S.project.jizura,transparent:$('alpha').checked,onProgress:progress,signal:control.signal});ext='-PNG.zip';}
      else if(type==='ae'){$('cancelExport').disabled=true;progress(.15,'正在采样关键帧并打包 AE 构建器…');blob=await PVFExports.aePackage(S.project,S.plan);ext='-AE.zip';warning='（真实 AE 尚未验证；特效和字体可能存在差异）';}
      else if(type==='project'){$('cancelExport').disabled=true;blob=await PVFExports.projectPackage(S.project,S.plan);ext='.pvf';}
      else if(type==='wav'){if(!audio)throw new Error('请先导入音乐');blob=J.audioWav(audio.buffer,S.plan.duration);ext='.wav';}
      else{blob=new Blob([JSON.stringify(S.project,null,2)],{type:'application/json'});ext='.json';warning='（JSON 不包含原始素材）';}
      if(control.signal.aborted)throw new Error('已取消');progress(1,'完成');await J.saveFile(name+ext,blob);
      status('已导出 '+name+ext+warning);if(type==='project')$('saveState').textContent='完整项目已下载';
    }catch(e){status(e.message,true);}finally{S.busy=false;window.PVFExporting=false;$('progressDialog').close();S.dirty=true;}
  }
  function modeChanged(){S.pending=null;S.baseline=null;const m=$('mode').value;
    const hint={select:'点击选中，空白拖动框选；Shift 多选，Alt 点击选择下层。拖动角点缩放、上方圆点旋转。双击或长按进入独立编辑。',box:'在画面任意位置按住拖动框选；Shift 追加。可在铺满画面的背景媒体上框选。按 V 回到点选和移动。',move:'单击画面写入当前帧的位置键。Shift 显示 3× 放大镜。',single:'每次点击写入位置键，并按采样间隔自动前进。',two:'依次点目标的两个参考点：点 1 控制位置，点 2 控制缩放旋转。完成一对后前进；Esc 取消。',path:'按住鼠标绘制路径：从当前帧开始，在设定的持续帧数内完成；终点停留到片尾。'}[m];
    $('modeHint').textContent=hint;$('trackModeLabel').textContent=$('mode').selectedOptions[0].textContent;S.dirty=true;
    $('overlay').style.cursor=m==='select'?'default':m==='box'?'cell':'crosshair';
    $('canvasSelect').classList.toggle('active-tool',m==='select');$('canvasMarquee').classList.toggle('active-tool',m==='box');
  }
  function pickRecipe(){const id=$('presetChoice').value,catalog=PVFPresets.catalog;
    const pool=id==='random'?catalog.filter(r=>r.id!==S.project.backgroundRecipe?.id):catalog.filter(r=>r.id===id);
    return pool[Math.floor(Math.random()*pool.length)]||catalog[0];}
  function generateLook(whole=true){
    if($('presetChoice').value==='jizura'){
      pause();change(()=>{const p=S.project,j=p.jizura;
        if(whole){j.lyrics=$('lyrics').value;p.captionMode='lines';PVFTemplates.generate(p,Math.floor(Math.random()*1e9));}
        else{p.layers=PVFPresets.retainedLayers(p);p.templateBackground=true;j.seed=Math.floor(Math.random()*1e9);const before=S.plan;const next=J.plan(j,audioLike());
          before.lines.forEach((line,i)=>{const cuts=J.lineSnapshot(before,i);if(!cuts)return;cuts.forEach(c=>{const n=next.cuts.find(n=>n.line===i);if(n){c.bg=n.bg;c.bgP=n.bgP;}});j.overrides[i]={...j.overrides[i],lock:true,lockedCuts:cuts};});
        }
        S.selected=lyricId();S.selectedIds=[S.selected];S.keySelection=[];syncControls();status('已按当前歌曲分类生成 JIZURA 完整风格，独立元素和人工轨迹保留。');
      },true);return;
    }
    const recipe=pickRecipe(),seed=Math.floor(Math.random()*1e9);pause();
    change(()=>{const p=S.project,j=p.jizura;if(whole){j.lyrics=$('lyrics').value;p.captionMode='lines';PVFPresets.look(p,recipe,seed);}
      else{const sc=J.STYLES[recipe.style].schemes.find(s=>s.bg.toLowerCase()===recipe.bg)||J.STYLES[recipe.style].schemes[0];
        j.colors={enabled:true,allSchemes:true,bg:recipe.bg,fg:sc.fg,sub:sc.sub,accentOn:true,accent:recipe.colors[0],accent2:recipe.colors[1]};j.fx.bgSwitch=0;}
      const duration=whole?J.plan(j,audioLike()).duration:S.plan._baseDuration;
      const result=PVFPresets.replaceBackground(p,recipe,seed,duration,+j.timing.bpm||108);
      S.selected=result.added?p.layers.find(l=>l.generatedGroup==='recipe-'+seed).id:lyricId();S.selectedIds=[S.selected];
      S.keySelection=[];syncControls();$('mode').value='select';modeChanged();
      status('已生成“'+recipe.name+'”：'+result.added+' 个独立背景元素'+(result.retained?'；保留 '+result.retained+' 个已编辑或锁定元素':'')+'。点选或框选后即可改关键帧。');
    },true);
  }
  function selectRefs(refs,append=false){const map=new Map((append?S.keySelection:[]).map(ref=>[keyToken(ref),ref]));for(const ref of refs)map.set(keyToken(ref),ref);S.keySelection=[...map.values()];S.dirty=true;$('keySelectionCount').textContent=S.keySelection.length+' 个键';}
  function copyKeys(){const refs=S.keySelection.map(ref=>({ref,item:F.keyRef(S.project,ref)})).filter(v=>v.item?.key);
    if(!refs.length){status('先在时间轴选择关键帧。');return;}const start=Math.min(...refs.map(v=>v.item.key.frame));
    S.keyClipboard=refs.map(({ref,item})=>({layerId:ref.layerId,source:ref.source,sample:F.clone(item.key),offset:item.key.frame-start}));
    status('已复制 '+S.keyClipboard.length+' 个关键帧；粘贴起点为当前帧。');}
  function pasteKeys(){if(!S.keyClipboard.length||!selected())return;
    const single=new Set(S.keyClipboard.map(k=>k.layerId)).size===1;
    const copies=S.keyClipboard.map(k=>({...k,layerId:single?S.selected:k.layerId}));
    for(const c of copies){const l=S.project.layers.find(l=>l.id===c.layerId);if(!l||l.editLocked){status('粘贴目标不存在或已锁定。',true);return;}
      if(l[c.source].some(k=>k.frame===S.frame+c.offset&&k.locked)){status('粘贴目标包含锁定键，请先解锁。',true);return;}}
    change(()=>{const refs=[],raw=new Set();for(const c of copies){const l=S.project.layers.find(l=>l.id===c.layerId),key=F.clone(c.sample);key.frame=S.frame+c.offset;key.locked=false;
        if(c.source==='rawSamples'){F.insert(l,key);raw.add(l);}else{const a=l.processedSamples.filter(k=>k.frame!==key.frame);a.push(key);l.processedSamples=a.sort((a,b)=>a.frame-b.frame);}
        F.touch(l);refs.push({layerId:l.id,source:c.source,frame:key.frame});}
      raw.forEach(l=>l.processedSamples=[]);S.keySelection=refs;status('已粘贴 '+refs.length+' 个关键帧。');});}
  function deleteKeys(){const items=S.keySelection.map(ref=>({ref,...F.keyRef(S.project,ref)})).filter(v=>v.key&&!v.key.locked&&!v.l.editLocked);
    if(!items.length){status('没有可删除的未锁定关键帧。');return;}
    change(()=>{const raw=new Set();for(const {ref,l} of items){l[ref.source]=l[ref.source].filter(s=>s.frame!==ref.frame);if(ref.source==='rawSamples')raw.add(l);F.touch(l);}raw.forEach(l=>l.processedSamples=[]);
      S.keySelection=S.keySelection.filter(ref=>!items.some(v=>keyToken(v.ref)===keyToken(ref)));status('已删除 '+items.length+' 个键；锁定键保留。');});}
  function toggleKeysLock(){const items=S.keySelection.map(ref=>({ref,...F.keyRef(S.project,ref)})).filter(v=>v.key&&!v.l.editLocked);if(!items.length)return;
    const lock=items.some(v=>!v.key.locked);change(()=>{for(const v of items)F.setKeyLock(v.l,v.ref.source,v.ref.frame,lock);status(lock?'所选键已锁定。':'所选键已解锁。');});}
  function persistTiming(){S.project.lyricTimingDraft={rows:F.clone(S.timingRows),cursor:S.timingCursor};saveDraft();refreshTiming();}
  function rememberTiming(){S.timingHistory.push({rows:F.clone(S.timingRows),cursor:S.timingCursor});if(S.timingHistory.length>200)S.timingHistory.shift();}
  function refreshTiming(){
    $('timingList').innerHTML=S.timingRows.map((r,i)=>`<div class="timing-row ${i===S.timingCursor?'active':''}" data-timing="${i}"><span>${r.start==null?'未打轴':r.start.toFixed(2)+'s'}</span><span>${esc(r.text)}</span></div>`).join('');
    const next=S.timingRows[S.timingCursor];$('timingNext').textContent=next?'下一句 '+(S.timingCursor+1)+' / '+S.timingRows.length+' · '+next.text:S.timingRows.length?'全部已记录，可以应用到字幕':'先准备歌词';
    if(document.activeElement!==$('timingStart'))$('timingStart').value=next?.start??'';
  }
  function prepareTiming(clear=false){
    const rows=PVFLyrics.parse($('lyrics').value);if(!rows.length){status('请先输入歌词。',true);return;}
    S.timingRows=rows;S.timingCursor=clear?0:Math.max(0,rows.findIndex(r=>r.start==null));S.timingHistory=[];S.timingActive=true;
    if(clear)S.timingRows.forEach(r=>{r.start=null;r.end=null;});$('timingPanel').open=true;persistTiming();status('播放音乐，在每句开头按 T；也可点“记录下一句”。');
  }
  function tapTiming(){
    if(S.busy)return;if(!S.timingRows.length)prepareTiming(false);if(!S.timingRows[S.timingCursor]){status('全部已打轴，点选某句可重打。');return;}
    let t=source&&ac?ac.currentTime-startAudio:S.frame/fps();t=Math.max(0,t);
    if($('timingSnap').checked)t=PVFLyrics.snap(t,S.plan.beats);t=Math.round(t*fps())/fps();
    const snapshot={rows:F.clone(S.timingRows),cursor:S.timingCursor};
    try{PVFLyrics.setStart(S.timingRows,S.timingCursor,t);S.timingHistory.push(snapshot);S.timingCursor++;persistTiming();}
    catch(e){status(e.message,true);}
  }
  function applyTiming(){
    if(!S.timingRows.length||S.timingRows.some(r=>r.start==null)){status('请先完成所有歌词行的时间；未打轴行不能自动对齐。',true);return;}
    change(()=>{S.project.jizura.lyrics=PVFLyrics.serialize(S.timingRows);S.project.jizura.timing.lineTimes={};$('lyrics').value=S.project.jizura.lyrics;status('逐句时间已应用，字幕按这些时间生成；内部排版保持当前方案。');},true);
  }
  function bindTiming(){
    $('timingPrepare').onclick=()=>prepareTiming(false);$('timingClear').onclick=()=>prepareTiming(true);$('timingTap').onclick=tapTiming;
    $('timingBack').onclick=()=>{const old=S.timingHistory.pop();if(old){S.timingRows=old.rows;S.timingCursor=old.cursor;persistTiming();}};
    $('timingList').onclick=e=>{const row=e.target.closest('[data-timing]');if(!row)return;S.timingCursor=+row.dataset.timing;const t=S.timingRows[S.timingCursor].start;
      if(t!=null){pause();seek(t*fps());}persistTiming();};
    $('timingStart').onchange=()=>{const t=+$('timingStart').value;try{if($('timingStart').value==='')return;rememberTiming();PVFLyrics.setStart(S.timingRows,S.timingCursor,t);persistTiming();}catch(e){S.timingHistory.pop();status(e.message,true);}};
    $('timingShift').onclick=()=>{const dt=+$('timingOffset').value;if(!Number.isFinite(dt)||!dt||!S.timingRows.length)return;
      if(S.timingRows.some(r=>r.start!=null&&r.start+dt<0)){status('偏移后会出现负时间，请减小偏移。',true);return;}
      rememberTiming();S.timingRows.forEach(r=>{if(r.start!=null)r.start+=dt;if(r.end!=null)r.end+=dt;});$('timingOffset').value=0;persistTiming();};
    $('timingFinish').onclick=()=>{const r=S.timingRows.at(-1),t=S.frame/fps();if(!r||r.start==null||t<=r.start){status('末句结束必须晚于它的起点。',true);return;}rememberTiming();r.end=t;persistTiming();status('末句结束时间已记录。');};
    $('timingApply').onclick=applyTiming;
    $('lrcExport').onclick=async()=>{const rows=S.timingRows.length?S.timingRows:PVFLyrics.parse($('lyrics').value);if(!rows.length||rows.some(r=>r.start==null)){status('请完成打轴后导出 LRC。',true);return;}
      try{await J.saveFile(PVFExports.safeName(S.project.title)+'.lrc',new Blob([PVFLyrics.serialize(rows,true)],{type:'text/plain;charset=utf-8'}));status('LRC 已导出。');}catch(e){status(e.message,true);}};
  }
  function bind(){
    $('play').onclick=play;$('prevFrame').onclick=()=>{pause();seek(S.frame-1);};$('nextFrame').onclick=()=>{pause();seek(S.frame+1);};$('frameInput').onchange=()=>{pause();seek(+$('frameInput').value);};
    $('scrub').oninput=()=>{pause();seek(+$('scrub').value/10000*maxFrame());};$('loop').onclick=()=>{S.loop=!S.loop;$('loop').textContent='循环：'+(S.loop?'开':'关');};$('guides').onchange=()=>S.dirty=true;
    $('undo').onclick=()=>{if(!S.undo.length||S.busy)return;pause();S.redo.push(F.clone(S.project));S.project=S.undo.pop();syncControls();replan();};
    $('redo').onclick=()=>{if(!S.redo.length||S.busy)return;pause();S.undo.push(F.clone(S.project));S.project=S.redo.pop();syncControls();replan();};
    $('projectTitle').onchange=()=>change(()=>S.project.title=$('projectTitle').value,true);
    $('lyrics').onchange=()=>change(()=>S.project.jizura.lyrics=$('lyrics').value,true);
    $('generate').onclick=()=>change(()=>{const j=S.project.jizura;j.lyrics=$('lyrics').value;const style=j.style;
      const colors=F.clone(j.colors),roll=J.rollSongProfile(j)||J.omakase(j);Object.assign(j,roll);j.style=style;j.colors=colors;j.fps=fps();syncControls();},true);
    $('oneClick').onclick=()=>generateLook(true);$('backgroundGenerate').onclick=()=>generateLook(false);
    $('captionMode').onchange=()=>change(()=>{
      S.project.captionMode=$('captionMode').checked?'lines':'group';
      if(S.project.captionMode==='group'){S.selected=lyricId();S.selectedIds=[S.selected];}
      status(S.project.captionMode==='lines'?'已开启逐句字幕控制；每句可独立移动、跟随或写入关键帧。':'已切换整组控制；逐句轨迹保留，重新开启即可恢复。');
    },true);
    $('selectCaption').onclick=()=>{
      if(S.project.captionMode!=='lines'&&!change(()=>S.project.captionMode='lines',true))return;
      const l=PVFCaptions.owner(S.plan,S.frame/fps());select(l.id);focusEditor();
    };
    $('cleanCaptions').onclick=()=>change(()=>{const refs=new Set(S.project.layers.map(l=>l.followId).filter(Boolean)),before=S.project.layers.length;
      S.project.layers=S.project.layers.filter(l=>l.type!=='caption'||l.captionLine!=null||PVFCaptions.modified(l,S.project)||refs.has(l.id));
      status('已清理 '+(before-S.project.layers.length)+' 句未修改的失联字幕；手工轨迹和跟随目标保留。');});
    $('clearGenerated').onclick=()=>change(()=>{const before=S.project.layers.length;S.project.layers=PVFPresets.retainedLayers(S.project);S.keySelection=[];status('已清除 '+(before-S.project.layers.length)+' 个未修改的生成元素；修改或锁定的元素保留。');});
    $('profile').onchange=()=>change(()=>{J.applySongProfile(S.project.jizura,$('profile').value);PVFTemplates.resetPool(S.project.jizura);syncControls();},true);
    for(const id of ['style','aspect','resolution','bpm','motion','decor'])$(id).onchange=()=>change(()=>{
      const j=S.project.jizura,v=$(id).value;if(id==='resolution')j.res=+v;else if(id==='bpm')j.timing.bpm=+v;else if(['motion','decor'].includes(id))j.fx[id]=+v;else j[id]=v;if(id==='style'){j.colors.enabled=false;j.colors.accentOn=false;}},true);
    $('fps').onchange=()=>change(()=>{const old=fps(),next=+$('fps').value;for(const l of S.project.layers){
      for(const k of ['rawSamples','processedSamples']){const map=new Map();for(const s of l[k]){s.frame=Math.round(s.frame*next/old);map.set(s.frame,s);}l[k]=Array.from(map.values()).sort((a,b)=>a.frame-b.frame);}
      l.inFrame=Math.round(l.inFrame*next/old);if(l.outFrame!=null)l.outFrame=Math.round(l.outFrame*next/old);}
      for(const l of S.project.layers)if(l.captionBinding)l.captionBinding.frameStart=Math.round(l.captionBinding.frameStart*next/old);
      S.frame=Math.round(S.frame*next/old);S.project.fps=next;S.keySelection=[];},true);
    $('beatReact').onchange=()=>change(()=>S.project.beatReact=+$('beatReact').value);
    for(const id of ['templateBg','staticInterludes','centerFree','flash'])$(id).onchange=()=>change(()=>{const v=$(id).checked;
      if(id==='centerFree'){S.project.jizura.centerFree=v;if(v){const l=PVFSpace.ensure(S.project);l.visible=true;S.selected=l.id;S.selectedIds=[l.id];}return;}
      if(id==='templateBg')S.project.templateBackground=v;else if(id==='flash')S.project.jizura.fx.flash=v;else S.project.jizura[id]=v;},true);
    bindLibraryAndSpace();
    $('applyLayout').onclick=()=>change(()=>{const o=S.project.jizura.overrides[S.line]||{};o.layout=$('layoutOverride').value;delete o.lockedCuts;o.lock=false;S.project.jizura.overrides[S.line]=o;},true);
    $('lineList').onclick=e=>{const lock=e.target.closest('[data-lock]'),row=e.target.closest('[data-line]');if(lock){const i=+lock.dataset.lock;change(()=>{const o=S.project.jizura.overrides[i]||{};o.lock=!o.lock;if(o.lock)o.lockedCuts=J.lineSnapshot(S.plan,i);else delete o.lockedCuts;S.project.jizura.overrides[i]=o;},true);return;}
      if(row){pause();S.line=+row.dataset.line;seek(S.plan.lines[S.line].start*fps()+Math.min(.5,S.plan.lines[S.line].end-S.plan.lines[S.line].start)*fps());const caption=S.plan._captionByLine.get(S.line);select(S.project.captionMode==='lines'&&caption?caption.id:lyricId());}};
    $('layerList').onclick=e=>{const l=e.target.closest('[data-layer]');if(l)selectLayerAt(l.dataset.layer,e.shiftKey||e.ctrlKey||e.metaKey);};
    $('layerList').onkeydown=e=>{if(e.key==='Enter'){const l=e.target.closest('[data-layer]');if(l)selectLayerAt(l.dataset.layer);}};
    $('addText').onclick=()=>change(()=>{const l=F.layer('text','自由文字 '+S.project.layers.length,{text:'由你掌控',size:96});S.project.layers.push(l);S.selected=l.id;});
    $('addReticle').onclick=()=>change(()=>{const l=F.layer('reticle','追踪框 '+S.project.layers.length);S.project.layers.push(l);S.selected=l.id;});
    $('addShape').onclick=()=>change(()=>{const l=F.layer('shape','自由几何 '+S.project.layers.length,{width:.2,height:.2,color:'#cbb092'});S.project.layers.push(l);S.selected=l.id;$('mode').value='select';modeChanged();});
    $('layerLock').onclick=()=>{if(!selected())return;change(()=>{const lock=!selected().editLocked;chosen().forEach(l=>{l.editLocked=lock;F.touch(l);});});};
    $('duplicateLayer').onclick=()=>{const list=chosen().filter(l=>!['lyrics','caption','space'].includes(l.type));if(!list.length){status('可复制自由元素；自动字幕每句保留一个控制图层。');return;}
      change(()=>{const map=new Map(list.map(l=>[l.id,F.uid()])),copies=list.map(l=>({...F.clone(l),id:map.get(l.id),name:l.name+' · 副本',editLocked:false,generatedGroup:null,generatedEdited:false,followId:map.get(l.followId)||l.followId}));S.project.layers.push(...copies);S.selectedIds=copies.map(l=>l.id);S.selected=S.selectedIds.at(-1);});};
    $('deleteLayer').onclick=()=>{const ids=new Set(chosen().filter(l=>l.type!=='lyrics'&&(l.type!=='caption'||l.captionLine==null)&&!l.editLocked).map(l=>l.id));
      for(const l of S.project.layers)if(l.followId&&ids.has(l.followId)&&!ids.has(l.id))ids.delete(l.followId);
      if(!ids.size){status('自动字幕请用“显示 / 隐藏”；失联字幕可移除。锁定元素或被跟随的目标先解锁、解除跟随。');return;}
      change(()=>{if(chosen().some(l=>l.type==='space'&&ids.has(l.id))){S.project.jizura.centerFree=false;$('centerFree').checked=false;}S.project.layers=S.project.layers.filter(l=>!ids.has(l.id));setSelection([],null);status('已移除 '+ids.size+' 个元素。');});};
    $('layerVisible').onclick=()=>{if(!selected())return;change(()=>{const visible=!selected().visible;chosen().filter(l=>!l.editLocked).forEach(l=>{l.visible=visible;F.touch(l);});});};
    for(const [id,d]of [['layerDown',-1],['layerUp',1]])$(id).onclick=()=>{if(!selected()||selected().editLocked)return;change(()=>{const a=S.project.layers,indices=a.map((l,i)=>PVFScene.isBack(l)===PVFScene.isBack(selected())?i:-1).filter(i=>i>=0),n=indices.findIndex(i=>a[i].id===S.selected),i=indices[n],j=indices[F.clamp(n+d,0,indices.length-1)];[a[i],a[j]]=[a[j],a[i]];F.touch(a[j]);});};
    for(const [id,k]of Object.entries({layerName:'name',layerText:'text',fontSize:'size',layerColor:'color',inFrame:'inFrame',outFrame:'outFrame',scopeLine:'scopeLine',layerWidth:'width',layerHeight:'height',shapeType:'shape',shapeStroke:'stroke',layerRole:'role'}))$(id).onchange=()=>{if(!selected()||selected().editLocked)return;change(()=>{
      if(selected().type==='caption'&&['text','size','color','inFrame','outFrame','scopeLine','width','role'].includes(k))throw new Error('独立字幕的时间、文字和字效请使用专用字幕控件。');
      let v=$(id).value;if(['size','inFrame','outFrame','scopeLine','width','height','stroke'].includes(k))v=v===''?null:+v;if(k==='width'||k==='height')v=F.clamp(v/100,.001,5);
      if(k==='size')v=F.clamp(v,8,600);if(k==='inFrame'||k==='outFrame')v=v==null?null:Math.max(0,Math.round(v));
      if(k==='outFrame'&&v!=null&&v<selected().inFrame)throw new Error('出帧必须不早于入帧');
      selected()[k]=v;if(k==='name'&&selected().type==='caption')selected().captionNameCustom=true;F.touch(selected());});};
    $('captionTextApply').onclick=()=>{const l=selected();if(!l||l.type!=='caption'||l.editLocked)return;change(()=>{PVFCaptions.editText(S.project,l,$('captionText').value,S.plan);$('lyrics').value=S.project.jizura.lyrics;status('本句文案已更新，字幕时间和人工轨迹保留。');},true);};
    $('captionReset').onclick=()=>{const l=selected();if(!l||l.type!=='caption'||l.editLocked)return;change(()=>{
      if(F.hasLocked(l))throw new Error('本句含锁定关键帧，请先解锁后重置人工运动');
      l.base={x:.5,y:.5,scale:100,rotation:0,opacity:100};l.rawSamples=[];l.processedSamples=[];l.followId=lyricId();l.captionTimingHeld=false;F.touch(l);status('本句人工运动已重置，模板内部字效保留。');
    });};
    $('captionRelink').onclick=()=>{const l=selected();if(!l||l.type!=='caption'||l.editLocked)return;change(()=>{
      PVFCaptions.rebind(S.project,l,+$('captionTarget').value,S.plan);status('已重新关联，原有运动轨迹保留。');
    },true);};
    $('shapeFill').onchange=()=>{if(!selected()||selected().editLocked)return;change(()=>{selected().fill=$('shapeFill').checked;F.touch(selected());});};
    $('followLayer').onchange=()=>{const l=selected(),id=$('followLayer').value;if(!l||l.editLocked)return;
      change(()=>{if(id&&!F.canFollow(S.project,l.id,id))throw new Error('跟随不能形成循环');
        if(l.followId&&!id){if(maxFrame()>99999)throw new Error('超过 10 万帧的跟随，请先缩短项目后解除');const raw=[];
          for(let f=0;f<=maxFrame();f++){const q=F.world(l,f,S.project,S.plan.W,S.plan.H);raw.push({frame:f,position:{x:q.x,y:q.y},...q,interpolation:'linear',locked:false});}
          l.base=F.world(l,0,S.project,S.plan.W,S.plan.H);l.rawSamples=raw;l.processedSamples=[];
        }
        l.followId=id||null;F.touch(l);status(id?'已跟随目标；位置关键帧现在表示相对目标的偏移。':'已解除跟随，画面中的运动保留为逐帧关键帧。');});};
    for(const id of ['posX','posY','scale','rotation','opacity'])$(id).onchange=()=>{if(!selected()||selected().editLocked)return;change(()=>{
      const l=selected(),q=F.at(l,S.frame),position=F.localPosition(l,{x:+$('posX').value/S.plan.W,y:+$('posY').value/S.plan.H},S.frame,S.project,S.plan.W,S.plan.H);
      const next={...q,...position,scale:Math.max(.01,+$('scale').value),rotation:+$('rotation').value,opacity:F.clamp(+$('opacity').value,0,100)};
      if(Object.values(next).some(v=>!Number.isFinite(v)))throw new Error('变换值必须是有效数字');
      if($('canvasEditMode').value==='key')record(+$('posX').value/S.plan.W,+$('posY').value/S.plan.H,next);
      else{if(F.hasLocked(l))throw new Error('含锁定关键帧；整体修改前请解锁，或改用当前帧关键帧模式');
        const dx=next.x-q.x,dy=next.y-q.y,s=next.scale/q.scale,r=next.rotation-q.rotation,o=next.opacity-q.opacity;
        F.offset(l,dx,dy);l.base.scale*=s;l.base.rotation+=r;l.base.opacity=F.clamp(l.base.opacity+o,0,100);
        for(const a of [l.rawSamples,l.processedSamples])for(const k of a){k.scale*=s;k.rotation+=r;k.opacity=F.clamp(k.opacity+o,0,100);}}
      F.touch(l);
    });};
    $('addKey').onclick=()=>{if(!selected())return;change(()=>{const primary=S.selected;try{for(const l of chosen().filter(l=>!l.editLocked&&!F.samples(l).some(k=>k.frame===S.frame&&k.locked))){S.selected=l.id;const q=F.world(l,S.frame,S.project,S.plan.W,S.plan.H);record(q.x,q.y);}}finally{S.selected=primary;}});};
    $('lockKey').onclick=()=>{const l=selected();if(!l||l.editLocked)return;change(()=>{let source=activeSource(l),s=l[source].find(s=>s.frame===S.frame);if(!s){const q=F.at(l,S.frame);s=F.insert(l,{frame:S.frame,position:{x:q.x,y:q.y},...q});source='rawSamples';}F.setKeyLock(l,source,S.frame,!s.locked);});};
    $('smooth').onclick=()=>{if(!selected()||selected().editLocked)return;change(()=>{selected().processedSamples=F.smooth(selected());F.touch(selected());status('已平滑；原始点和锁定点保留。');});};
    $('retime').onclick=()=>{if(!selected()||selected().editLocked)return;change(()=>{selected().processedSamples=F.retime(selected());F.touch(selected());status('已应用整体速度，终点和锁定时刻保留。');});};
    $('resetRaw').onclick=()=>{if(!selected()||selected().editLocked)return;change(()=>{selected().processedSamples=[];F.touch(selected());});};
    $('simplify').onclick=()=>{if(!selected()||selected().editLocked)return;change(()=>{const l=selected();if(F.samples(l).length<3)return;const before=F.samples(l).length;l.processedSamples=F.simplify(l,2,S.plan.W,S.plan.H);F.touch(l);status('关键帧压缩：'+before+' → '+l.processedSamples.length+'，设计坐标位置误差 ≤ 2px。');});};
    $('resetSpeed').onclick=()=>{if(!selected()||selected().editLocked)return;change(()=>{selected().speedCurve=F.naturalSpeed();F.touch(selected());S.speedSelected=null;});};$('uniformSpeed').onclick=()=>{if(!selected()||selected().editLocked)return;change(()=>{selected().speedCurve=[{time:0,speed:1},{time:1,speed:1}];F.touch(selected());S.speedSelected=null;});};
    $('mode').onchange=modeChanged;
    $('audioImport').onclick=()=>importMedia('audio');$('bgImport').onclick=()=>importMedia('background');$('fgImport').onclick=()=>importMedia('foreground');$('assetRelink').onclick=relink;
    $('openProject').onclick=openProject;$('saveProject').onclick=()=>runExport('project');
    for(const [id,t]of [['mp4Export','mp4'],['pngExport','png'],['aeExport','ae'],['wavExport','wav'],['jsonExport','json']])$(id).onclick=()=>runExport(t);
    $('referenceEditor').onclick=()=>window.open('JIZURA-complete.html','_blank');
    $('subtitleImport').onclick=async()=>{try{const a=await pick('.lrc,.srt');if(a[0]){const text=J.importSubtitles(await a[0].text(),a[0].name);change(()=>{S.project.jizura.lyrics=text;syncControls();},true);}}catch(e){status(e.message,true);}};
    $('importTracker').onclick=async()=>{if(!selected()||selected().editLocked)return;try{const a=await pick('.json');if(a[0]){const data=JSON.parse(await a[0].text()),v=F.importManual(data,fps(),S.frame);change(()=>{Object.assign(selected(),v);F.touch(selected());});status('PR 轨迹已导入，首个样本对齐当前帧。');}}catch(e){status(e.message,true);}};
    $('demo').onclick=()=>{pause();change(()=>{S.project=demoProject();S.frame=26;S.selected='lyrics';syncControls();},true);status('演示已载入；修改图层轨迹或导入自己的素材。');};
    $('selectionFilter').onchange=()=>S.dirty=true;$('selectAllLayers').onclick=()=>setSelection(S.project.layers.filter(eligible).map(l=>l.id));$('selectNone').onclick=()=>setSelection([]);
    $('canvasSelect').onclick=()=>{$('mode').value='select';modeChanged();};$('canvasMarquee').onclick=()=>{$('mode').value='box';modeChanged();};
    $('keySource').onchange=()=>{S.keySelection=[];refresh();};$('copyKeys').onclick=copyKeys;$('pasteKeys').onclick=pasteKeys;$('deleteKeys').onclick=deleteKeys;$('toggleKeysLock').onclick=toggleKeysLock;
    bindCanvas();bindSpeed();bindTimeline();bindTiming();
    document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||S.busy)return;
      if(e.ctrlKey&&e.key.toLowerCase()==='z'){e.preventDefault();$(e.shiftKey?'redo':'undo').click();}
      else if(e.code==='Space'){e.preventDefault();play();}else if(e.key==='Escape'){S.cancelCanvas?.();S.cancelTimeline?.();S.pending=null;S.path=null;S.canvasBox=null;S.timelineBox=null;S.dirty=true;}
      else if(!e.ctrlKey&&!e.metaKey&&e.key.toLowerCase()==='t'&&S.timingActive){e.preventDefault();tapTiming();}
      else if(!e.ctrlKey&&!e.metaKey&&e.key.toLowerCase()==='v'){e.preventDefault();$('mode').value='select';modeChanged();}
      else if(!e.ctrlKey&&!e.metaKey&&e.key.toLowerCase()==='b'){e.preventDefault();$('mode').value='box';modeChanged();}
      else if(!e.ctrlKey&&!e.metaKey&&e.key.toLowerCase()==='k'){e.preventDefault();$('addKey').click();}
      else if(e.key==='ArrowRight'){e.preventDefault();pause();seek(S.frame+1);}else if(e.key==='ArrowLeft'){e.preventDefault();pause();seek(S.frame-1);}
    });
    window.addEventListener('resize',fitStage);new ResizeObserver(fitStage).observe($('stage').parentElement);
  }
  function bindCanvas(){
    const cv=$('overlay');let gesture=null,pressTimer=null;
    const distance=(a,b)=>Math.hypot((a.x-b.x)*cv.getBoundingClientRect().width,(a.y-b.y)*cv.getBoundingClientRect().height);
    function clearPress(){clearTimeout(pressTimer);pressTimer=null;}
    function handleAt(p){const l=selected();if(!l||S.selectedIds.length!==1||l.editLocked||!PVFVisible(l,S.plan,S.frame/fps()))return null;
      const b=elementBounds(l),r=cv.getBoundingClientRect(),norm=v=>({x:v.x/S.plan.W,y:v.y/S.plan.H});
      for(const corner of b.corners)if(distance(p,norm(corner))<9)return {kind:l.type==='space'?'resize':'scale',bounds:b};
      const top={x:(b.corners[0].x+b.corners[1].x)/2,y:(b.corners[0].y+b.corners[1].y)/2},angle=b.q.rotation*Math.PI/180;
      const handle={x:top.x+Math.sin(angle)*24*S.plan.W/cv.width,y:top.y-Math.cos(angle)*24*S.plan.W/cv.width};
      return distance(p,norm(handle))<10?{kind:'rotate',bounds:b}:null;
    }
    function cancel(){clearPress();if(gesture?.changed){S.project=S.undo.pop();syncControls();replan();}
      gesture=null;S.path=null;S.canvasBox=null;S.dirty=true;}
    S.cancelCanvas=cancel;
    function movableIds(mode){
      const candidates=chosen().filter(l=>!l.editLocked&&!(mode==='offset'&&F.hasLocked(l))&&!(mode==='key'&&F.samples(l).some(s=>s.frame===S.frame&&s.locked))),ids=new Set(candidates.map(l=>l.id));
      return candidates.filter(l=>{
        let p=S.project.layers.find(a=>a.id===l.followId),seen=new Set();
        while(p&&!seen.has(p.id)){if(ids.has(p.id))return false;seen.add(p.id);p=S.project.layers.find(a=>a.id===p.followId);}return true;
      }).map(l=>l.id);
    }
    function beginDrag(kind,p){const mode=$('canvasEditMode').value,ids=movableIds(mode);
      gesture={kind,start:p,ids,mode,frame:S.frame,original:new Map(ids.map(id=>[id,F.clone(S.project.layers.find(l=>l.id===id))])),changed:false};
      if(kind!=='move'){const b=elementBounds(selected());gesture.center={x:b.q.x,y:b.q.y};
        const dx=(p.x-b.q.x)*S.plan.W,dy=(p.y-b.q.y)*S.plan.H;gesture.radius=Math.max(1,Math.hypot(dx,dy));gesture.angle=Math.atan2(dy,dx)*180/Math.PI;}
      if(!ids.length)status('所选元素或关键帧已锁定；请先解锁，或改用当前帧关键帧模式。');
    }
    cv.addEventListener('pointerdown',e=>{
      if(S.busy||e.button!==0)return;pause();cv.focus();const p=point(e),m=$('mode').value;
      if(m==='select'||m==='box'){
        const handle=m==='select'?handleAt(p):null,hits=m==='select'?hitObjects(p):[];cv.setPointerCapture(e.pointerId);
        if(handle){beginDrag(handle.kind,p);return;}
        let hit=hits[0];if(e.altKey&&hits.length){const i=hits.findIndex(l=>l.id===S.selected);hit=hits[(i+1)%hits.length];}
        if(hit){if(e.shiftKey||e.ctrlKey||e.metaKey){select(hit.id,true);if(!S.selectedIds.includes(hit.id))return;}
          else if(!S.selectedIds.includes(hit.id))select(hit.id);else {S.selected=hit.id;refresh();}
          beginDrag('move',p);pressTimer=setTimeout(()=>{if(gesture&&!gesture.changed){focusEditor();gesture.longPress=true;}},450);
        }else{
          gesture={kind:'box',start:p,end:p,previous:e.shiftKey?S.selectedIds.slice():[],changed:false};
          S.canvasBox={start:p,end:p};if(!e.shiftKey)setSelection([]);
        }
        S.dirty=true;return;
      }
      const l=selected();if(!l||l.editLocked){status('先选择一个未锁定元素，再使用追踪模式。',true);return;}
      if(m==='path'){S.path=[p];S.pathStart=S.frame;cv.setPointerCapture(e.pointerId);S.dirty=true;return;}
      if(m==='two'){
        if(!S.pending){S.pending=p;S.dirty=true;status('已记录点 1，请点同一目标的点 2。');return;}
        const first=S.pending,dx=p.x-first.x,dy=(p.y-first.y)*S.plan.H/S.plan.W,dist=Math.hypot(dx,dy),angle=Math.atan2(dy,dx)*180/Math.PI;
        if(dist<.002){status('两个参考点距离太近。',true);return;}const q=F.at(l,S.frame);
        if(!S.baseline)S.baseline={dist,angle,scale:q.scale,rotation:q.rotation};let rot=S.baseline.rotation+angle-S.baseline.angle;
        while(rot-q.rotation>180)rot-=360;while(rot-q.rotation<-180)rot+=360;
        if(change(()=>record(first.x,first.y,{scale:S.baseline.scale*dist/S.baseline.dist,rotation:rot}))){S.pending=null;seek(S.frame+Math.max(1,+$('interval').value));}
        return;
      }
      if(change(()=>record(p.x,p.y))&&m==='single')seek(S.frame+Math.max(1,+$('interval').value));
    });
    cv.addEventListener('pointermove',e=>{
      const p=point(e);
      if(gesture){if(distance(gesture.start,p)>3)clearPress();
        if(gesture.kind==='box'){
          gesture.end=p;S.canvasBox={start:gesture.start,end:p};
          if(distance(gesture.start,p)>3){const loX=Math.min(p.x,gesture.start.x)*S.plan.W,hiX=Math.max(p.x,gesture.start.x)*S.plan.W,loY=Math.min(p.y,gesture.start.y)*S.plan.H,hiY=Math.max(p.y,gesture.start.y)*S.plan.H;
            const ids=S.project.layers.filter(l=>{if(!eligible(l))return false;const b=elementBounds(l);return b.maxX>=loX&&b.minX<=hiX&&b.maxY>=loY&&b.minY<=hiY;}).map(l=>l.id);
            S.selectedIds=[...new Set([...gesture.previous,...ids])];S.selected=S.selectedIds.at(-1)||null;
          }
          S.dirty=true;return;
        }
        if(!gesture.ids.length||(!gesture.changed&&distance(gesture.start,p)<3))return;
        if(!gesture.changed){remember();gesture.changed=true;}
        const dx=p.x-gesture.start.x,dy=p.y-gesture.start.y;
        for(const id of gesture.ids){const l=S.project.layers.find(l=>l.id===id),origin=gesture.original.get(id);Object.assign(l,F.clone(origin));
          const q=F.at(origin,gesture.frame),w=F.world(l,gesture.frame,S.project,S.plan.W,S.plan.H);
          let factor=1,rotation=0;
          if(gesture.kind==='resize'&&l.type==='space'){
            const angle=-w.rotation*Math.PI/180,x=(p.x-w.x)*S.plan.W,y=(p.y-w.y)*S.plan.H;
            const width=F.clamp(2*Math.abs(x*Math.cos(angle)-y*Math.sin(angle))/S.plan.W/(w.scale/100),.01,2);
            const height=F.clamp(2*Math.abs(x*Math.sin(angle)+y*Math.cos(angle))/S.plan.H/(w.scale/100),.01,2);
            if(gesture.mode==='key')F.insert(l,{...q,frame:gesture.frame,position:{x:q.x,y:q.y},width,height,interpolation:$('interpolation').value});
            else{l.width=F.clamp(l.width*width/q.width,.01,2);l.height=F.clamp(l.height*height/q.height,.01,2);for(const a of [l.rawSamples,l.processedSamples])for(const key of a){key.width=F.clamp((key.width??origin.width)*width/q.width,.01,2);key.height=F.clamp((key.height??origin.height)*height/q.height,.01,2);}}
            continue;
          }
          if(gesture.kind==='scale')factor=Math.max(.005,Math.hypot((p.x-gesture.center.x)*S.plan.W,(p.y-gesture.center.y)*S.plan.H)/gesture.radius);
          if(gesture.kind==='rotate'){
            rotation=Math.atan2((p.y-gesture.center.y)*S.plan.H,(p.x-gesture.center.x)*S.plan.W)*180/Math.PI-gesture.angle;
            while(rotation>180)rotation-=360;while(rotation<-180)rotation+=360;if(e.shiftKey)rotation=Math.round(rotation/15)*15;
          }
          const target=gesture.kind==='move'?F.localPosition(l,{x:w.x+dx,y:w.y+dy},gesture.frame,S.project,S.plan.W,S.plan.H):{x:q.x,y:q.y};
          if(gesture.mode==='offset'){
            F.offset(l,target.x-q.x,target.y-q.y);l.base.scale*=factor;l.base.rotation+=rotation;
            for(const a of [l.rawSamples,l.processedSamples])for(const key of a){key.scale*=factor;key.rotation+=rotation;}
          }else F.insert(l,{...q,frame:gesture.frame,position:target,scale:q.scale*factor,rotation:q.rotation+rotation,opacity:q.opacity,interpolation:$('interpolation').value});
          F.touch(l);
        }
        syncInspector();S.dirty=true;return;
      }
      if(S.path){const last=S.path.at(-1);if(Math.hypot(p.x-last.x,p.y-last.y)>.002)S.path.push(p);S.dirty=true;}
      if($('mode').value==='select')cv.style.cursor=['scale','resize'].includes(handleAt(p)?.kind)?'nwse-resize':handleAt(p)?.kind==='rotate'?'grab':hitObjects(p).length?'move':'default';
      const mag=$('magnifier');if(e.shiftKey&&!S.path&&$('mode').value!=='select'){
        const v=$('preview'),x=mag.firstElementChild.getContext('2d');x.clearRect(0,0,180,180);x.drawImage(v,p.x*v.width-30,p.y*v.height-30,60,60,0,0,180,180);
        x.strokeStyle='#cbb092';x.beginPath();x.moveTo(90,70);x.lineTo(90,110);x.moveTo(70,90);x.lineTo(110,90);x.stroke();mag.style.display='block';mag.style.left=Math.min(innerWidth-186,e.clientX+14)+'px';mag.style.top=Math.min(innerHeight-186,e.clientY+14)+'px';
      }else mag.style.display='none';
    });
    cv.addEventListener('pointerup',()=>{
      clearPress();if(gesture){const edited=gesture.changed;gesture=null;S.canvasBox=null;refresh();if(edited)saveDraft();return;}
      if(!S.path)return;const path=S.path;S.path=null;if(path.length<2){S.dirty=true;return;}
      const l=selected();if(!l||l.editLocked)return;
      change(()=>{const n=Math.max(2,Math.min(3000,+$('pathDuration').value)),pts=MTCurve.resampleByArc(path,Math.min(n+1,100)),q=F.at(l,S.pathStart);let count=0;
        pts.forEach((p,i)=>{const frame=S.pathStart+Math.round(i*n/(pts.length-1));if(l.rawSamples.some(s=>s.frame===frame&&s.locked))return;
          const position=F.localPosition(l,p,frame,S.project,S.plan.W,S.plan.H);F.insert(l,{...q,frame,position,scale:q.scale,rotation:q.rotation,opacity:q.opacity});count++;});
        F.touch(l);status('已生成手绘路径 '+count+' 个键，已有锁定键保留。可重排速度调整运动节奏。');});
    });
    cv.addEventListener('pointercancel',cancel);cv.addEventListener('pointerleave',()=>$('magnifier').style.display='none');
    cv.addEventListener('dblclick',e=>{if($('mode').value!=='select')return;const hit=hitObjects(point(e))[0];if(hit){select(hit.id);focusEditor();}});
    cv.addEventListener('keydown',e=>{
      if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();$('deleteLayer').click();}
      else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){e.preventDefault();$('selectAllLayers').click();}
      else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();$('duplicateLayer').click();}
    });
  }
  function bindSpeed(){const cv=$('speedCanvas');let drag=false;
    const hit=e=>{const p=speedMap(e),r=cv.getBoundingClientRect();let best=null,d=12;selected().speedCurve.forEach((s,i)=>{const q=Math.hypot((p.time-s.time)*r.width*.88,(p.speed-s.speed)*r.height*.72/3);if(q<d){d=q;best=i;}});return best;};
    cv.addEventListener('pointerdown',e=>{if(S.busy||!selected()||selected().editLocked)return;cv.focus();S.speedSelected=hit(e);if(S.speedSelected!=null){remember();drag=true;cv.setPointerCapture(e.pointerId);}drawSpeed();});
    cv.addEventListener('pointermove',e=>{if(!drag)return;const p=speedMap(e),a=selected().speedCurve,i=S.speedSelected;a[i].speed=p.speed;if(i>0&&i<a.length-1)a[i].time=F.clamp(p.time,a[i-1].time+.015,a[i+1].time-.015);drawSpeed();});
    cv.addEventListener('pointerup',()=>{if(drag){drag=false;F.touch(selected());saveDraft();status('速度曲线已修改，点击“重排速度”应用。');}});
    cv.addEventListener('pointercancel',()=>drag=false);
    cv.addEventListener('dblclick',e=>{if(!selected()||selected().editLocked)return;const p=speedMap(e);if(selected().speedCurve.some(q=>Math.abs(q.time-p.time)<.025))return;
      change(()=>{selected().speedCurve.push(p);selected().speedCurve.sort((a,b)=>a.time-b.time);F.touch(selected());S.speedSelected=selected().speedCurve.indexOf(p);});});
    cv.addEventListener('keydown',e=>{if(selected()&&!selected().editLocked&&e.key==='Delete'&&S.speedSelected>0&&S.speedSelected<selected().speedCurve.length-1){e.preventDefault();change(()=>{selected().speedCurve.splice(S.speedSelected,1);F.touch(selected());S.speedSelected=null;});}});
  }
  function bindTimeline(){
    const cv=$('timeline');let gesture=null;
    function loc(e){const r=cv.getBoundingClientRect(),a=timelineLayout();return {x:e.clientX-r.left,y:e.clientY-r.top,a};}
    const frameOf=p=>Math.max(0,Math.round((p.x-p.a.left)/p.a.width*S.plan.duration*fps()));
    function keyAt(p){const i=Math.floor((p.y-p.a.top)/p.a.row),l=timelineRows()[i];if(!l||i<0||p.x<p.a.left)return null;
      let nearest=null,d=9;for(const key of activeKeys(l)){
        const x=p.a.left+p.a.width*key.frame/fps()/S.plan.duration,y=p.a.top+i*p.a.row+13,dist=Math.hypot(x-p.x,y-p.y);
        if(dist<d){nearest={layerId:l.id,source:activeSource(l),frame:key.frame};d=dist;}
      }return nearest;
    }
    function cancel(){if(gesture?.changed){S.project=S.undo.pop();syncControls();replan();}gesture=null;S.timelineBox=null;S.dirty=true;}
    S.cancelTimeline=cancel;
    cv.addEventListener('pointerdown',e=>{
      if(S.busy||e.button!==0)return;e.stopPropagation?.();pause();cv.focus();const p=loc(e);cv.setPointerCapture(e.pointerId);
      if(p.y<p.a.top){if(p.x>=p.a.left){seek(frameOf(p));gesture={kind:'scrub'};}return;}
      const l=timelineRows()[Math.floor((p.y-p.a.top)/p.a.row)];
      if(p.x<p.a.left){if(l)selectLayerAt(l.id,e.shiftKey||e.ctrlKey||e.metaKey);return;}
      const ref=keyAt(p);
      if(ref){const add=e.shiftKey||e.ctrlKey||e.metaKey;
        if(add){if(keySelected(ref))S.keySelection=S.keySelection.filter(r=>keyToken(r)!==keyToken(ref));else selectRefs([ref],true);}
        else if(!keySelected(ref))selectRefs([ref]);
        setSelection([...new Set(S.keySelection.map(r=>r.layerId))],ref.layerId);seek(ref.frame);
        if(keySelected(ref))gesture={kind:'keys',start:p,refs:F.clone(S.keySelection),original:F.clone(S.project),T:S.plan.duration,frame:ref.frame,changed:false};
      }else{
        gesture={kind:'box',start:p,end:p,previous:e.shiftKey?F.clone(S.keySelection):[],rowId:l?.id,moved:false};
        S.timelineBox={start:p,end:p};if(!e.shiftKey)selectRefs([]);
      }
      S.dirty=true;
    });
    cv.addEventListener('pointermove',e=>{
      const p=loc(e);
      if(!gesture){const ref=keyAt(p),item=ref&&F.keyRef(S.project,ref);cv.style.cursor=item?.key&&!item.key.locked&&!item.l.editLocked?'ew-resize':'default';return;}
      if(gesture.kind==='scrub'){seek(frameOf(p));return;}
      if(gesture.kind==='box'){
        gesture.end=p;gesture.moved=Math.hypot(p.x-gesture.start.x,p.y-gesture.start.y)>3;S.timelineBox={start:gesture.start,end:p};
        if(gesture.moved){const x0=Math.min(p.x,gesture.start.x),x1=Math.max(p.x,gesture.start.x),y0=Math.min(p.y,gesture.start.y),y1=Math.max(p.y,gesture.start.y),refs=[];
          timelineRows().forEach((l,i)=>{const y=p.a.top+i*p.a.row+13;if(y<y0||y>y1)return;for(const s of activeKeys(l)){
            const x=p.a.left+p.a.width*s.frame/fps()/S.plan.duration;if(x>=x0&&x<=x1)refs.push({layerId:l.id,source:activeSource(l),frame:s.frame});}});
          S.keySelection=gesture.previous.slice();selectRefs(refs,true);
          const ids=[...new Set(S.keySelection.map(r=>r.layerId))];S.selectedIds=ids;S.selected=ids.at(-1)||null;
        }S.dirty=true;return;
      }
      if(!gesture.changed&&Math.abs(p.x-gesture.start.x)<3)return;
      const requested=Math.round((p.x-gesture.start.x)/p.a.width*gesture.T*fps()),candidate=F.clone(gesture.original);
      const result=F.shiftKeys(candidate,gesture.refs,requested);
      if(result.reason){status(result.reason,true);return;}
      if(!result.delta&&!gesture.changed)return;
      if(!gesture.changed){remember();gesture.changed=true;}
      S.project=candidate;S.plan.fusion=candidate;S.keySelection=result.refs;extendDuration();S.frame=F.clamp(gesture.frame+result.delta,0,maxFrame());syncInspector();S.dirty=true;cv.style.cursor='ew-resize';
    });
    cv.addEventListener('pointerup',e=>{
      if(!gesture)return;const current=gesture;gesture=null;S.timelineBox=null;
      if(current.kind==='box'&&!current.moved){if(current.rowId)select(current.rowId);seek(frameOf(loc(e)));}
      refresh();if(current.changed)saveDraft();cv.style.cursor='default';
    });
    cv.addEventListener('pointercancel',cancel);
    cv.addEventListener('dblclick',e=>{const ref=keyAt(loc(e)),item=ref&&F.keyRef(S.project,ref);if(!item?.key||item.l.editLocked)return;
      change(()=>F.setKeyLock(item.l,ref.source,ref.frame,!item.key.locked));});
    cv.addEventListener('keydown',e=>{
      if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteKeys();}
      else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='c'){e.preventDefault();copyKeys();}
      else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='v'){e.preventDefault();e.stopPropagation?.();pasteKeys();}
      else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){e.preventDefault();const refs=[];for(const l of timelineRows())for(const s of activeKeys(l))refs.push({layerId:l.id,source:activeSource(l),frame:s.frame});selectRefs(refs);}
    });
  }
  function bindLibraryAndSpace(){
    $('templateGroup').innerHTML=Object.entries(PVFTemplates.groups).map(([k,n])=>`<option value="${k}">${n}</option>`).join('');
    const update=()=>{const g=$('templateGroup').value||'layout',query=$('templateSearch').value.trim().toLowerCase();
      const list=PVFTemplates.options(g).filter(v=>(v.id+' '+v.name).toLowerCase().includes(query));
      $('templatePart').innerHTML=list.map(v=>`<option value="${esc(v.id)}">${esc(v.name)}</option>`).join('');$('applyTemplate').disabled=!list.length;
    };$('templateGroup').onchange=update;$('templateSearch').oninput=update;update();
    $('libraryStats').textContent=J.STYLE_ORDER.length+' 套视觉配色 · '+J.GROUP_KEYS.reduce((n,g)=>n+J.order(g).length,0)+' 项动效 / 排版';
    for(const [id,key]of Object.entries({packExtra:'extra',packWa:'wa',packTypo:'typo',packKinetic:'kinetic',packHorror:'horror'}))$(id).onchange=()=>change(()=>{S.project.jizura[key]=$(id).checked;PVFTemplates.resetPool(S.project.jizura);},true);
    $('applyTemplate').onclick=()=>change(()=>{if(!S.plan.lines[S.line])throw new Error('请先输入歌词');PVFTemplates.apply(S.project,S.line,$('templateGroup').value,$('templatePart').value);if($('templateGroup').value==='bg')S.project.templateBackground=true;syncControls();status('已应用到第 '+(S.line+1)+' 行；该行的手工运动轨迹保留。');},true);
    $('resetTemplate').onclick=()=>change(()=>{delete S.project.jizura.overrides[S.line];},true);
    $('selectSpace').onclick=()=>{pause();change(()=>{const l=PVFSpace.ensure(S.project);S.project.jizura.centerFree=true;l.visible=true;S.selected=l.id;S.selectedIds=[l.id];$('centerFree').checked=true;$('mode').value='select';modeChanged();QFUI.show('right','elements');},true);};
    $('centerSpace').onclick=()=>change(()=>{const l=PVFSpace.ensure(S.project);if(l.editLocked)throw new Error('留白区域已锁定');S.project.jizura.centerFree=true;l.visible=true;S.selected=l.id;S.selectedIds=[l.id];$('centerFree').checked=true;
      const q=F.at(l,S.frame);if($('canvasEditMode').value==='key')record(.5,.5);else if(!F.offset(l,.5-q.x,.5-q.y))throw new Error('轨迹有锁定点，请解锁或切换当前帧模式');
    },true);
    $('spaceDirection').onchange=()=>change(()=>{const l=PVFSpace.ensure(S.project);if(F.hasLocked(l))throw new Error('请先解锁留白区域及关键帧');l.spaceDirection=$('spaceDirection').value;S.project.jizura.centerDir=l.spaceDirection;},true);
    for(const [id,key]of [['spaceWidth','width'],['spaceHeight','height']])$(id).onchange=()=>{const l=selected();if(l?.type!=='space'||l.editLocked)return;change(()=>{
      const v=F.clamp(+$(id).value/100,.01,2);if(!Number.isFinite(v))throw new Error('请输入有效宽高');const q=F.at(l,S.frame);
      if($('canvasEditMode').value==='key'){const w=F.world(l,S.frame,S.project,S.plan.W,S.plan.H);record(w.x,w.y,{[key]:v});}
      else{if(F.hasLocked(l))throw new Error('含锁定关键帧，请解锁或使用当前帧模式');const factor=v/q[key],base=l[key];l[key]=F.clamp(base*factor,.01,2);for(const a of [l.rawSamples,l.processedSamples])for(const s of a)s[key]=F.clamp((s[key]??base)*factor,.01,2);}
    });};
  }
  function boot(){
    $('style').innerHTML=J.STYLE_ORDER.map(k=>`<option value="${esc(k)}">${esc(J.STYLES[k].name||k)}</option>`).join('');
    $('layoutOverride').innerHTML+=[...J.LAYOUT_ORDER].filter(k=>!J.LAYOUTS[k].special).map(k=>`<option value="${esc(k)}">${esc(J.LAYOUTS[k].name||k)}</option>`).join('');
    S.project=demoProject();S.project.jizura.extra=true;PVFTemplates.resetPool(S.project.jizura);try{const raw=localStorage.getItem('qfpvshow.draft.v1');if(raw)S.project=F.validate(JSON.parse(raw),J.defaultProject());}catch(e){}
    bind();QFUI.init();QFUI.onChange=()=>{S.dirty=true;drawSpeed();};syncControls();replan();S.frame=Math.round(.95*fps());modeChanged();
    if(S.project.assets.length)status('草稿已恢复；请重新关联素材，或打开已保存的完整项目包。');
    requestAnimationFrame(tick);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
