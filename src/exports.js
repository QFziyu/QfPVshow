(function(){
  'use strict';
  const safeName=s=>String(s||'PV-Fusion').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,100);
  const pathOf=a=>'assets/'+a.id+'-'+safeName(a.name);
  async function assetFiles(project){
    const list=[];for(const a of project.assets){const r=PVFAssets.get(a.id);if(!r?.file)throw new Error('缺少素材“'+a.name+'”，请先重新关联');
      list.push([pathOf(a),new Uint8Array(await r.file.arrayBuffer())]);}return list;
  }
  async function projectPackage(project,plan){
    const p=PVF.clone(project);p.assets.forEach(a=>a.packagePath=pathOf(a));
    const fs=[['project.json',JSON.stringify(p,null,2)],['compiled-plan.json',JSON.stringify(J.planForAE(plan,project.jizura),null,2)],...await assetFiles(p)];
    return PVFZip.pack(fs);
  }
  function bake(l,p,windows){
    const base=PVFScene.pose(l,p,0),keys=[];if(!PVF.samples(l).length&&!l.followId&&!p.fusion.beatReact)return {base,keys};
    const frames=Math.ceil(p.duration*p.fps);
    const intervals=windows||(['lyrics','caption'].includes(l.type)?PVFCaptions.windows(l,p):null);
    const visibleFrames=intervals?intervals.flatMap(([a,b])=>Array.from({length:Math.max(0,Math.round((b-a)*p.fps))},(_,i)=>Math.round(a*p.fps)+i)):null;
    for(const f of visibleFrames||Array.from({length:frames},(_,i)=>i)){
      const t=f/p.fps,q=PVFScene.pose(l,p,f);
      keys.push({t,x:q.x,y:q.y,s:q.scale,r:q.rotation,o:q.opacity});
    }return{base,keys};
  }
  async function aePackage(project,plan){
    const clean=J.planForAE(plan,project.jizura);delete clean.fusion;
    const layers=PVFScene.order(project).map(l=>{const captionWindows=['lyrics','caption'].includes(l.type)?PVFCaptions.windows(l,plan):null;return {...PVF.clone(l),captionWindows,baked:bake(l,plan,captionWindows)};});
    const spaceTrack=project.jizura.centerFree&&PVFSpace.layer(project)?Array.from({length:Math.ceil(plan.duration*plan.fps)},(_,f)=>{
      const l=PVFSpace.active(plan,f/plan.fps);return {t:f/plan.fps,points:l?PVFSpace.corners(l,plan,f).map(v=>[v.x/plan.W,v.y/plan.H]):null};
    }):[];
    const payload={project:PVF.clone(project),plan:clean,layers,spaceTrack};payload.project.assets.forEach(a=>a.packagePath=pathOf(a));
    const script=('#target aftereffects\n'+PVF_AE_CORE+'\n('+buildAE.toString()+')('+JSON.stringify(payload)+');\n').replace(/[^\x00-\x7f]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
    const guide='Qf-PV show AE 工程包 · V1\n\n1. 解压整个文件夹，保留 assets 目录。\n2. 在 After Effects 中选择：文件 > 脚本 > 运行脚本文件，选择 build.jsx。\n3. 生成的文字、图片和运动关键帧可继续编辑，再另存为 .aep。\n\n此文件是生成工程的 JSX，不是浏览器直接生成的二进制 AEP。\n逐句模式会生成每句独立的控制预合成，按原始字幕的出现时段裁切，并采样最终运动。\n句内字效和跨句转场仍使用共享 JIZURA 字幕源；跨句转场归属于新一句。不是逐字拆层。\n自动歌词使用 JIZURA 的 AE 原生构建器；字体、部分特效、组背景和后期与 Canvas 实现可能有差异。\n两点缩放旋转、路径速度、自由图层位置均来自同一份已采样数据。\n需要保持浏览器画面时，使用 PNG 序列（透明可选）和 WAV 音轨导入 AE。\n动态留白输出为逐帧减去蒙版，背景媒体和人物素材保留；浏览器会随留白重分配两侧字幕，AE 原生字效仍保留原始分带位置，二者排版可能不同。保留浏览器画面请用 PNG 序列。此版本尚未在真实 AE 中验证。\n';
    return PVFZip.pack([['build.jsx',script],['README.txt',guide],['project.json',JSON.stringify(payload.project,null,2)],
      ['compatibility.json',JSON.stringify({browserVersion:'Qf-PV show V1',editionAuthor:'QFziyu',animatedNegativeSpace:!!spaceTrack.length,nativeAE:'not-tested-in-After-Effects',automaticText:'JIZURA native effect counterparts',editableShapes:true,independentSentenceControls:project.captionMode==='lines',tracking:'world transforms baked per visible output frame',
        caveats:['Fonts must be installed in AE','Template backgrounds may move with lyric group','Template background switch may differ','Canvas and AE post effects can differ','Follow links are baked to world keys, not live AE parenting','Sentence wrappers share the native subtitle source; cross-sentence transitions belong to the incoming sentence','Orphan sentence controls stay in project.json and are omitted from the AE scene','Animated exclusion masks are exported; native AE lyric bands retain original placement, unlike browser animated band reflow']},null,2)],...await assetFiles(project)]);
  }
  // This function is serialized verbatim into ExtendScript. Keep ES3 syntax.
  function buildAE(d){
    app.beginUndoGroup('Qf-PV show');
    try{
      if(!app.project)app.newProject();
      var p=d.plan,P=d.project,W=p.width,H=p.height,k=W/p.W,D=p.duration,fps=p.fps;
      var folder=app.project.items.addFolder('Qf-PV show '+P.title);
      var comp=app.project.items.addComp('Qf-PV show '+P.title,W,H,1,D,fps);comp.parentFolder=folder;
      var auto=$.global.JZ_CORE.build(p,{width:W,height:H});auto.parentFolder=folder;
      var media={},hasBg=false,master=null;
      for(var mi=0;mi<d.layers.length;mi++)if(d.layers[mi].type==='lyrics')master=d.layers[mi];
      for(var ai=0;ai<P.assets.length;ai++){
        var a=P.assets[ai],file=new File(new File($.fileName).parent.fsName+'/'+a.packagePath);
        if(!file.exists)throw new Error('Missing asset: '+a.name);
        var io=new ImportOptions(file),foot=app.project.importFile(io);foot.parentFolder=folder;media[a.id]=foot;
      }
      for(var hi=0;hi<d.layers.length;hi++)if(d.layers[hi].type==='background'||d.layers[hi].role==='background')hasBg=true;
      // The native JIZURA renderer uses opaque wrapper backgrounds. Remove these when media is behind it.
      if(hasBg||!P.templateBackground){
        function strip(c,seen){
          if(seen[c.id])return;seen[c.id]=true;
          for(var si=c.numLayers;si>=1;si--){var sl=c.layer(si);
            if(sl.name==='JZ Background'||sl.name==='JZ BG'||sl.name==='JZ Paper')sl.remove();
            else if(sl.source&&sl.source instanceof CompItem)strip(sl.source,seen);}
        }strip(auto,{});
      }
      var bg=P.background||'#0b1625';var col=[parseInt(bg.substr(1,2),16)/255,parseInt(bg.substr(3,2),16)/255,parseInt(bg.substr(5,2),16)/255];
      comp.layers.addSolid(col,'Qf-PV show 背景',W,H,1,D);
      for(var li=0;li<d.layers.length;li++){
        var l=d.layers[li],L=null,fit=100;
        if(l.type==='lyrics'||l.type==='caption'){
          var wins=l.captionWindows||[[0,D]];
          if(!wins.length||(l.type==='caption'&&P.captionMode!=='lines'))continue;
          if(l.type==='lyrics'&&P.captionMode!=='lines')L=comp.layers.add(auto);
          else{
            var sentence=app.project.items.addComp(l.name+' · 字幕源',W,H,1,D,fps);sentence.parentFolder=folder;
            for(var wi=0;wi<wins.length;wi++){var slice=sentence.layers.add(auto);slice.inPoint=wins[wi][0];slice.outPoint=wins[wi][1];slice.name='字幕时段 '+(wi+1);}
            L=comp.layers.add(sentence);
          }
        }
        else if(l.type==='text'){
          L=comp.layers.addText(l.text||'');var tp=L.property('ADBE Text Properties').property('ADBE Text Document'),doc=tp.value;
          doc.fontSize=l.size*k;doc.fillColor=[parseInt(l.color.substr(1,2),16)/255,parseInt(l.color.substr(3,2),16)/255,parseInt(l.color.substr(5,2),16)/255];
          doc.justification=ParagraphJustification.CENTER_JUSTIFY;tp.setValue(doc);
          var rr=L.sourceRectAtTime(0,false);L.property('ADBE Transform Group').property('ADBE Anchor Point').setValue([rr.left+rr.width/2,rr.top+rr.height/2]);
        }else if(l.type==='shape'){
          L=comp.layers.addShape();var sg=L.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group'),sv=sg.property('ADBE Vectors Group');
          var sw=W*l.width,sh=H*l.height,sp,vertices;
          if(l.shape==='ellipse'){
            sp=sv.addProperty('ADBE Vector Shape - Ellipse');sp.property('ADBE Vector Ellipse Size').setValue([sw,sh]);
          }else if(l.shape==='triangle'||l.shape==='line'){
            sp=sv.addProperty('ADBE Vector Shape - Group');var shape=new Shape();
            vertices=l.shape==='line'?[[-sw/2,0],[sw/2,0]]:[[0,-sh/2],[sw/2,sh/2],[-sw/2,sh/2]];
            shape.vertices=vertices;shape.inTangents=[];shape.outTangents=[];
            for(var vi=0;vi<vertices.length;vi++){shape.inTangents.push([0,0]);shape.outTangents.push([0,0]);}
            shape.closed=l.shape!=='line';sp.property('ADBE Vector Shape').setValue(shape);
          }else if(l.shape==='stripes'){
            var count=Math.max(2,Math.min(30,Math.round(l.stripeCount||9))),stripe=sw/(count*2-1);
            for(var ri=0;ri<count;ri++){
              sp=sv.addProperty('ADBE Vector Shape - Rect');sp.property('ADBE Vector Rect Size').setValue([stripe,sh]);
              sp.property('ADBE Vector Rect Position').setValue([-sw/2+ri*stripe*2+stripe/2,0]);
            }
          }else{sp=sv.addProperty('ADBE Vector Shape - Rect');sp.property('ADBE Vector Rect Size').setValue([sw,sh]);}
          var scol=[parseInt(l.color.substr(1,2),16)/255,parseInt(l.color.substr(3,2),16)/255,parseInt(l.color.substr(5,2),16)/255];
          if(l.fill!==false&&l.shape!=='line')sv.addProperty('ADBE Vector Graphic - Fill').property('ADBE Vector Fill Color').setValue(scol);
          if(l.stroke>0||l.shape==='line'){
            var ss=sv.addProperty('ADBE Vector Graphic - Stroke');ss.property('ADBE Vector Stroke Color').setValue(scol);ss.property('ADBE Vector Stroke Width').setValue(Math.max(1,l.stroke)*k);
          }
        }else if(l.type==='reticle'){
          L=comp.layers.addShape();var g=L.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group');
          var vg=g.property('ADBE Vectors Group'),rect=vg.addProperty('ADBE Vector Shape - Rect');
          rect.property('ADBE Vector Rect Size').setValue([W*l.width,W*l.width]);
          var stroke=vg.addProperty('ADBE Vector Graphic - Stroke');stroke.property('ADBE Vector Stroke Width').setValue(3*k);
          stroke.property('ADBE Vector Stroke Color').setValue([parseInt(l.color.substr(1,2),16)/255,parseInt(l.color.substr(3,2),16)/255,parseInt(l.color.substr(5,2),16)/255]);
        }else if(media[l.assetId]){
          var src=media[l.assetId];L=comp.layers.add(src);fit=l.type==='background'?Math.max(W/src.width,H/src.height)*100:W*l.width/src.width*100;
          L.startTime=l.inFrame/fps;try{L.audioEnabled=false;}catch(ignored){}
        }
        if(!L)continue;L.name=l.name;L.enabled=l.visible!==false&&(l.type!=='caption'||!master||master.visible!==false);
        L.inPoint=Math.max(0,l.inFrame/fps);L.outPoint=Math.min(D,l.outFrame==null?D:(l.outFrame+1)/fps);
        if(l.scopeLine!==null){var row=p.lines[l.scopeLine];if(row){L.inPoint=Math.max(L.inPoint,row.start);L.outPoint=Math.min(L.outPoint,row.visEnd||row.end);}}
        var xf=L.property('ADBE Transform Group'),pos=xf.property('ADBE Position'),scl=xf.property('ADBE Scale'),rot=xf.property('ADBE Rotate Z'),op=xf.property('ADBE Opacity');
        var b=l.baked.base;pos.setValue([b.x*W,b.y*H]);scl.setValue([b.scale*fit/100,b.scale*fit/100]);rot.setValue(b.rotation);op.setValue(b.opacity*(l.type==='background'?P.bgOpacity/100:1));
        for(var ki=0;ki<l.baked.keys.length;ki++){
          var v=l.baked.keys[ki];pos.setValueAtTime(v.t,[v.x*W,v.y*H]);scl.setValueAtTime(v.t,[v.s*fit/100,v.s*fit/100]);rot.setValueAtTime(v.t,v.r);op.setValueAtTime(v.t,v.o*(l.type==='background'?P.bgOpacity/100:1));
        }
        if(d.spaceTrack&&d.spaceTrack.length&&(l.type==='lyrics'||l.type==='caption'||l.type==='text'||l.type==='shape'||l.type==='reticle')){
          var mask=L.property('ADBE Mask Parade').addProperty('ADBE Mask Atom');mask.name='Qf-PV show 动态留白';mask.maskMode=MaskMode.SUBTRACT;
          var mp=mask.property('ADBE Mask Shape'),anchor=xf.property('ADBE Anchor Point').value||[0,0],bi=0;
          for(var zi=0;zi<d.spaceTrack.length;zi++){
            var z=d.spaceTrack[zi];if(z.t<L.inPoint-1/fps||z.t>L.outPoint)continue;
            while(bi+1<l.baked.keys.length&&l.baked.keys[bi+1].t<=z.t+0.000001)bi++;
            var bk=l.baked.keys.length?l.baked.keys[bi]:{x:b.x,y:b.y,s:b.scale,r:b.rotation};
            var rad=-bk.r*Math.PI/180,ss=Math.max(0.000001,bk.s*fit/10000),vtx=[];
            for(var zp=0;zp<4;zp++){
              var point=z.points?z.points[zp]:[bk.x,bk.y],dx=(point[0]-bk.x)*W,dy=(point[1]-bk.y)*H;
              vtx.push([anchor[0]+(dx*Math.cos(rad)-dy*Math.sin(rad))/ss,anchor[1]+(dx*Math.sin(rad)+dy*Math.cos(rad))/ss]);
            }
            var msh=new Shape();msh.vertices=vtx;msh.closed=true;msh.inTangents=[[0,0],[0,0],[0,0],[0,0]];msh.outTangents=[[0,0],[0,0],[0,0],[0,0]];mp.setValueAtTime(z.t,msh);
          }
          for(var mk=1;mk<=mp.numKeys;mk++)mp.setInterpolationTypeAtKey(mk,KeyframeInterpolationType.LINEAR,KeyframeInterpolationType.LINEAR);
        }
        var props=[pos,scl,rot,op];for(var pi=0;pi<props.length;pi++)for(var kk=1;kk<=props[pi].numKeys;kk++)props[pi].setInterpolationTypeAtKey(kk,KeyframeInterpolationType.LINEAR,KeyframeInterpolationType.LINEAR);
      }
      for(var au=0;au<P.assets.length;au++)if(P.assets[au].kind==='audio'&&media[P.assets[au].id]){var al=comp.layers.add(media[P.assets[au].id]);al.name='Qf-PV show 音轨';al.startTime=0;al.outPoint=Math.min(D,al.source.duration);}
      comp.openInViewer();alert('Qf-PV show 已生成。请另存为 AEP。\n自动字幕特效和字体可能与浏览器画面有差异。');
    }catch(e){alert('Qf-PV show: '+e.toString()+'\n'+(e.line||''));}finally{app.endUndoGroup();}
  }
  window.PVFExports={projectPackage,aePackage,bake,safeName};
})();
