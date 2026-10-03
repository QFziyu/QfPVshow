/* One compositor is used by preview, PNG and MP4. Adobe export consumes the same baked tracks. */
(function(){
  'use strict';
  const Native=J.Renderer,F=PVF;
  const assets=window.PVFAssets=new Map();
  const canvas=()=>document.createElement('canvas');
  const visible=(l,p,t)=>PVFCaptions.visible(l,p,t);
  function mediaTime(l,item,t,fps){return Math.max(0,Math.min(Math.max(0,item.element.duration-1/fps),t-l.inFrame/fps));}
  async function seekVideo(el,t,signal){
    if(signal?.aborted)throw new Error('已取消');
    if(!el.seeking&&Math.abs(el.currentTime-t)<.0001&&el.readyState>=2)return;
    await new Promise((resolve,reject)=>{
      let timer;
      const clean=()=>{clearTimeout(timer);el.removeEventListener('seeked',done);el.removeEventListener('error',bad);signal?.removeEventListener('abort',abort);};
      const done=()=>{if(el.readyState<2)return;clean();resolve();};
      const bad=()=>{clean();reject(new Error('视频帧解码失败'));};
      const abort=()=>{clean();reject(new Error('已取消'));};
      el.addEventListener('seeked',done);el.addEventListener('error',bad);signal?.addEventListener('abort',abort,{once:true});
      timer=setTimeout(()=>{clean();reject(new Error('等待视频帧超时，请换用常规 MP4/H.264 素材'));},10000);
      el.currentTime=t;
      if(!el.seeking&&el.readyState>=2)done();
    });
  }
  J.prepareFrame=async(p,t,signal)=>{
    if(!p.fusion)return;
    for(const l of p.fusion.layers){const a=assets.get(l.assetId);
      if(a?.kind==='video'&&visible(l,p,t))await seekVideo(a.element,mediaTime(l,a,t,p.fps),signal);}
  };
  function transform(ctx,l,p,t){
    const q=PVFScene.pose(l,p,t*p.fps);
    ctx.translate(q.x*p.W,q.y*p.H);ctx.rotate(q.rotation*Math.PI/180);ctx.scale(q.scale/100,q.scale/100);ctx.globalAlpha=q.opacity/100;
    return q;
  }
  class FusionRenderer{
    constructor(){this.back=new Native();this.front=new Native();this.post=new Native();this.a=canvas();this.b=canvas();this.lastFrame=null;this.boundsCache=null;this.safe=canvas();}
    ensure(c,w,h){if(c.width!==w||c.height!==h){c.width=w;c.height=h;}return c.getContext('2d');}
    frame(ctx,p,t,opt={}){
      if(!p.fusion){this.front.frame(ctx,p,t,opt);return;}
      const cw=ctx.canvas.width,ch=ctx.canvas.height,k=opt.scale||cw/p.W,pr=p.fusion;
      const cut=PVFCaptions.cutAt(p,t),sc=p.style.schemes[(cut?.scheme||0)%p.style.schemes.length];
      ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.filter='none';ctx.clearRect(0,0,cw,ch);ctx.scale(k,k);
      if(!opt.transparent){ctx.fillStyle=pr.templateBackground?sc.bg:pr.background;ctx.fillRect(0,0,p.W,p.H);}
      const backCtx=this.ensure(this.b,cw,ch),frontCtx=this.ensure(this.a,cw,ch);
      // Keep template background decorations independent of the movable lyric group.
      for(const l of pr.layers.filter(PVFScene.isBack))if(visible(l,p,t)&&!(opt.transparent&&['background','image','video'].includes(l.type)))this.drawLayer(ctx,l,p,t,opt);
      const staticCut=p.staticInterludes&&cut?.layout==='interlude';
      if(pr.templateBackground&&!staticCut){this.back.frame(backCtx,p,t,{...opt,transparent:true,layer:'back',noPost:true,noHud:true});
        ctx.save();PVFSpace.clipOutside(ctx,p,t);ctx.drawImage(this.b,0,0,p.W,p.H);ctx.restore();}
      if(!staticCut)this.front.frame(frontCtx,p,t,{...opt,transparent:true,layer:'front',noPost:true});
      else frontCtx.clearRect(0,0,cw,ch);
      this.lastFrame=t;this.boundsCache=null;
      for(const l of pr.layers){
        if(PVFScene.isBack(l)||!visible(l,p,t)||(['lyrics','caption'].includes(l.type)&&!PVFCaptions.owns(l,p,t)))continue;
        this.drawLayer(ctx,l,p,t,opt);
      }
      ctx.restore();
      const region=!opt.noPost&&!staticCut&&PVFSpace.active(p,t);
      if(region){const sx=this.ensure(this.safe,cw,ch);sx.clearRect(0,0,cw,ch);sx.drawImage(ctx.canvas,0,0);}
      if(!opt.noPost&&!staticCut){const step=Math.floor(t/(J.komaOf(p.fx)>0?J.stepDur(p.fx,p.fps):1/24));
        this.post.post(ctx,p,t,t,step,sc,k,opt,!opt.fast);}
      if(region){ctx.save();ctx.setTransform(k,0,0,k,0,0);PVFSpace.clipInside(ctx,p,t);ctx.globalCompositeOperation='copy';ctx.drawImage(this.safe,0,0,p.W,p.H);ctx.restore();}
    }
    drawLayer(ctx,l,p,t,opt){
        if(l.type==='space')return;
        ctx.save();if(['lyrics','caption','text','shape','reticle'].includes(l.type))PVFSpace.clipOutside(ctx,p,t);transform(ctx,l,p,t);
        if(l.type==='lyrics'||l.type==='caption')ctx.drawImage(this.a,-p.W/2,-p.H/2,p.W,p.H);
        else if(l.type==='text'){
          ctx.fillStyle=l.color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`700 ${l.size}px "Microsoft YaHei", "PingFang SC", sans-serif`;
          const lines=String(l.text).split('\n');lines.forEach((s,i)=>ctx.fillText(s,0,(i-(lines.length-1)/2)*l.size*1.15));
        }else if(l.type==='reticle'){
          const r=p.W*l.width/2;ctx.strokeStyle=l.color;ctx.lineWidth=3;ctx.strokeRect(-r,-r,r*2,r*2);
          ctx.beginPath();ctx.moveTo(-r*.4,0);ctx.lineTo(r*.4,0);ctx.moveTo(0,-r*.4);ctx.lineTo(0,r*.4);ctx.stroke();
          ctx.fillStyle=l.color;ctx.font='20px monospace';ctx.fillText(l.text||'TARGET',-r,-r-12);
        }else if(l.type==='shape')PVFScene.drawShape(ctx,l,p);
        else if(['image','video','background'].includes(l.type))this.drawMedia(ctx,l,p,t,opt,l.type==='background',true);
        ctx.restore();
    }
    // Compute only on demand for canvas selection; never called during movie export.
    lyricBounds(p){
      if(this.boundsCache)return this.boundsCache;
      const w=this.a.width,h=this.a.height,data=this.a.getContext('2d').getImageData(0,0,w,h).data;
      let left=w,right=0,top=h,bottom=0;
      for(let y=0;y<h;y+=3)for(let x=0;x<w;x+=3)if(data[(y*w+x)*4+3]>40){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
      this.boundsCache=left<right?{cx:(left+right)/2*p.W/w-p.W/2,cy:(top+bottom)/2*p.H/h-p.H/2,w:(right-left+6)*p.W/w,h:(bottom-top+6)*p.H/h}:
        {cx:0,cy:0,w:0,h:0};return this.boundsCache;
    }
    drawMedia(ctx,l,p,t,opt,bg,transformed=false){
      const a=assets.get(l.assetId);if(!a?.element)return;const el=a.element;
      if(a.kind==='video'&&!window.PVFExporting){
        const mt=mediaTime(l,a,t,p.fps);if(!el.seeking&&Math.abs(el.currentTime-mt)>1/p.fps/2){el.currentTime=mt;}
      }
      const w=el.videoWidth||el.naturalWidth,h=el.videoHeight||el.naturalHeight;if(!w||!h)return;
      if(a.kind==='video'&&el.readyState<2)return;
      ctx.save();
      if(!transformed)transform(ctx,l,p,t);
      const width=bg?Math.max(p.W,p.H*w/h):p.W*l.width,height=width*h/w;
      if(bg)ctx.globalAlpha*=p.fusion.bgOpacity/100;
      ctx.drawImage(el,-width/2,-height/2,width,height);ctx.restore();
    }
  }
  J.Renderer=FusionRenderer;
  window.PVFVisible=visible;
})();
