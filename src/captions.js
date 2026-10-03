/* Sentence controls wrap the native foreground. Native glyph effects and joins stay intact.
   A cross-sentence transition belongs to its incoming sentence; glyphs are not split. */
(function(root){
  'use strict';
  const F=root.PVF;
  const isText=l=>l&&l.text&&!l.interlude;
  const master=p=>p.layers.find(l=>l.type==='lyrics');
  function cutAt(p,t){
    const step=J.stepDur(p.fx,p.fps),q=Math.floor(t/step+1e-6)*step;
    return J.cutAt(p,q);
  }
  function firstFrame(t,p){
    const step=J.stepDur(p.fx,p.fps);
    return Math.max(0,Math.ceil(Math.ceil(t/step-1e-6)*step*p.fps-1e-6));
  }
  function ranges(p){
    const map=new Map(),last=Math.ceil(p.duration*p.fps)-1;
    for(const [i,c]of p.cuts.entries()){
      const a=firstFrame(c.start,p),b=Math.min(last,firstFrame(Math.min(c.end,p.cuts[i+1]?.start??c.end),p)-1);
      if(a>b)continue;
      const out=map.get(c.line)||[],prev=out.at(-1);
      if(prev&&a<=prev[1]+1)prev[1]=Math.max(prev[1],b);else out.push([a,b]);
      map.set(c.line,out);
    }return map;
  }
  function modified(l,p){
    return !!(l.captionEdited||F.hasLocked(l)||F.samples(l).length||l.rawSamples.length||
      l.followId!==master(p)?.id||!l.visible||l.base.x!==.5||l.base.y!==.5||l.base.scale!==100||l.base.rotation!==0||l.base.opacity!==100);
  }
  function bind(l,e,p){
    const start=e.range[0]?.[0]??firstFrame(e.row.start,p),end=e.range.at(-1)?.[1]??start;
    const old=l.captionBinding,delta=old?start-Math.round(old.frameStart??old.start*p.fps):0;
    if(delta)l.captionTimingHeld=!!(F.hasLocked(l)&&F.samples(l).length);
    else if(!F.hasLocked(l))l.captionTimingHeld=false;
    if(delta&&!F.hasLocked(l))for(const name of ['rawSamples','processedSamples']){
      const map=new Map();for(const s of l[name]){s.frame=Math.max(0,s.frame+delta);map.set(s.frame,s);}
      l[name]=[...map.values()].sort((a,b)=>a.frame-b.frame);
    }
    l.captionLine=e.index;l.captionBinding={text:e.row.text,start:e.row.start,end:e.row.end,line:e.index,src:e.row.src,frameStart:start};
    l.text=e.row.text;l.inFrame=start;l.outFrame=end;l.scopeLine=null;
    if(!l.captionNameCustom)l.name='字幕 '+(e.index+1)+' · '+e.row.text.slice(0,20);
  }
  function sync(project,p){
    const all=project.layers.filter(l=>l.type==='caption'),windows=ranges(p),entries=p.lines.flatMap((row,index)=>isText(row)?[{row,index,range:windows.get(index)||[]}]:[]);
    const free=new Set(all),todo=new Set(entries),pairs=[];
    function pair(l,e){pairs.push([l,e]);free.delete(l);todo.delete(e);}
    // Exact times anchor repeated choruses when a line is inserted or removed.
    for(const e of entries){const l=[...free].find(l=>l.captionBinding?.text===e.row.text&&Math.abs(l.captionBinding.start-e.row.start)<1e-6);if(l)pair(l,e);}
    // Otherwise unchanged text keeps identity, in occurrence order. Do not guess by array index.
    for(const e of [...todo]){
      const l=[...free].filter(l=>l.captionBinding?.text===e.row.text).sort((a,b)=>(a.captionBinding.line-b.captionBinding.line))[0];
      if(l)pair(l,e);
    }
    const count=project.layers.length+(project.captionMode==='lines'?todo.size:0);
    if(count>200)throw new Error('逐句字幕会超过 200 个图层；请先清理失联字幕或减少独立元素。原有轨迹已保留。');
    for(const l of free){l.captionLine=null;l.captionTimingHeld=false;}
    for(const [l,e]of pairs)bind(l,e,p);
    const added=[];
    if(project.captionMode==='lines')for(const e of todo){
      const l=F.layer('caption','字幕',{followId:master(project).id,captionEdited:false});bind(l,e,p);added.push(l);
    }
    project.layers.splice(project.layers.indexOf(master(project))+1,0,...added);
    p._captionByLine=new Map(project.layers.filter(l=>l.type==='caption'&&l.captionLine!=null).map(l=>[l.captionLine,l]));
    p._captionRanges=windows;
    return project.layers.filter(l=>l.type==='caption');
  }
  function owner(p,t){
    if(p.fusion.captionMode!=='lines')return master(p.fusion);
    const c=cutAt(p,t),row=c&&p.lines[c.line];
    return isText(row)?(p._captionByLine?.get(c.line)||master(p.fusion)):master(p.fusion);
  }
  function owns(l,p,t){return owner(p,t)?.id===l.id;}
  function gate(l,p,t){return !!l?.visible&&t*p.fps+1e-6>=l.inFrame&&(l.outFrame==null||t*p.fps<l.outFrame+1-1e-6)&&
    (l.scopeLine==null||cutAt(p,t)?.line===l.scopeLine);}
  function visible(l,p,t){
    if(!gate(l,p,t))return false;
    if(l.type!=='caption')return true;
    return p.fusion.captionMode==='lines'&&l.captionLine!=null&&owns(l,p,t)&&gate(master(p.fusion),p,t);
  }
  // Half-open intervals in seconds, evaluated on the same output frame clock as preview.
  function windows(l,p){
    const out=[],N=Math.ceil(p.duration*p.fps);let begin=null;
    const m=master(p.fusion);
    for(let f=0;f<N;f++){
      const t=f/p.fps,c=cutAt(p,t),inside=owns(l,p,t)&&f>=l.inFrame&&(l.outFrame==null||f<=l.outFrame)&&
        (l.scopeLine==null||c?.line===l.scopeLine)&&
        (l.type!=='caption'||(f>=m.inFrame&&(m.outFrame==null||f<=m.outFrame)&&(m.scopeLine==null||c?.line===m.scopeLine)));
      if(inside&&begin==null)begin=f;
      if(begin!=null&&(!inside||f===N-1)){out.push([begin/p.fps,(inside?f+1:f)/p.fps]);begin=null;}
    }return out;
  }
  function rebind(project,l,index,p){
    if(l.type!=='caption'||l.captionLine!=null)throw new Error('只有失联字幕需要重新关联；正常字幕可直接编辑。');
    const row=p.lines[index];if(!isText(row))throw new Error('请选择一条有文字的歌词行');
    const target=project.layers.find(a=>a.type==='caption'&&a.captionLine===index);
    if(target&&(modified(target,project)||project.layers.some(a=>a.followId===target.id)))throw new Error('目标句已有手工修改或跟随元素，请先选择其他句。');
    if(target)project.layers=project.layers.filter(a=>a.id!==target.id);
    project.captionMode='lines';bind(l,{row,index,range:ranges(p).get(index)||[]},p);
  }
  function editText(project,l,value,p){
    const text=String(value).trim(),parsed=J.parseLyrics(text).lines;
    if(text.includes('\n')||parsed.length!==1||!isText(parsed[0])||parsed[0].lrc!=null||parsed[0].subtitleEnd!=null)throw new Error('每句文案不能为空，且不能在这里输入时间标签或多行。可用 / 拆镜头。');
    const row=p.lines[l.captionLine];if(!row)throw new Error('此字幕已失联，请先重新关联');
    const lines=String(project.jizura.lyrics).replace(/\r/g,'').split('\n'),original=lines[row.src],tags=original.trim().match(/^(?:\[\d+:\d+(?:[.:]\d+)?\])+/)?.[0]||'';
    const timeTags=tags.match(/\[\d+:\d+(?:[.:]\d+)?\]/g)||[],payload=original.trim().slice(tags.length);
    const end=payload.match(/^\[end:\d+(?:\.\d+)?\]/)?.[0]||'[end:'+row.end+']';
    const note=payload.includes('|')&&!text.includes('|')?payload.slice(payload.indexOf('|')):'';
    if(timeTags.length>1){
      // A repeated timestamp source row becomes separate rows so only this occurrence changes.
      const source=J.parseLyrics(project.jizura.lyrics).lines[l.captionLine];
      const tagIndex=timeTags.findIndex(tag=>Math.abs(J.parseLyrics(tag+'x').lines[0].lrc-source.lrc)<1e-6);
      if(tagIndex<0)throw new Error('无法识别重复时间标签，请在左侧歌词中拆成独立行再编辑');
      lines.splice(row.src,1,...timeTags.map((tag,i)=>tag+(i===tagIndex?end+text+note:payload)));
    }else lines[row.src]=tags+end+text+note;
    project.jizura.lyrics=lines.join('\n');l.captionBinding.text=parsed[0].text;l.captionEdited=true;
    project.jizura.timing.lineTimes=Object.fromEntries(p.lines.map((a,i)=>[i,a.start]));
    // Recompile the edited sentence; stale locked cut text cannot be kept after a rewrite.
    const ov=project.jizura.overrides[l.captionLine];if(ov){delete ov.lockedCuts;ov.lock=false;}
  }
  root.PVFCaptions={cutAt,firstFrame,ranges,sync,owner,owns,visible,windows,modified,rebind,editText};
  if(typeof module!=='undefined')module.exports=root.PVFCaptions;
})(typeof window!=='undefined'?window:globalThis);
