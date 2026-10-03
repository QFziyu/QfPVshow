/* Drawing, bounds and picking share the same local geometry and world transform. */
(function(){
  'use strict';
  const F=PVF;
  const isBack=l=>l.role==='background'||l.type==='background';
  const order=p=>[...p.layers.filter(isBack),...p.layers.filter(l=>!isBack(l))];
  function pose(l,p,frame){
    const q=F.world(l,frame,p.fusion,p.W,p.H),b=p.fusion.beatReact||0,t=frame/p.fps,beats=p.beats||[];
    if(l.type!=='space'&&b&&beats.length){let lo=0,hi=beats.length;while(lo<hi){const m=(lo+hi)>>1;if(beats[m]<=t)lo=m+1;else hi=m;}
      if(lo)q.scale*=1+b*.07*Math.exp(-(t-beats[lo-1])*16);}
    return q;
  }
  function geometry(l,p,ctx,lyricBounds){
    let w=p.W*l.width,h=p.H*l.height,cx=0,cy=0;
    if(l.type==='lyrics'||l.type==='caption'){
      if(!lyricBounds)return {cx:0,cy:0,w:p.W*.65,h:p.H*.35};
      return {...lyricBounds};
    }
    if(l.type==='text'){
      ctx.save();ctx.font=`700 ${l.size}px "Microsoft YaHei", "PingFang SC", sans-serif`;
      const lines=String(l.text).split('\n');w=Math.max(12,...lines.map(s=>ctx.measureText(s).width));h=l.size*(1.15*(lines.length-1)+1);ctx.restore();
    }else if(l.type==='reticle'){h=w;}
    else if(['image','video','background'].includes(l.type)){
      const a=p.fusion.assets.find(a=>a.id===l.assetId),ratio=(a?.width||16)/(a?.height||9);
      w=l.type==='background'?Math.max(p.W,p.H*ratio):w;h=w/ratio;
    }
    if(l.type==='shape'&&l.shape==='line')h=Math.max(12,l.stroke);
    return {cx,cy,w:Math.max(1,w),h:Math.max(1,h)};
  }
  function worldPoint(q,v,p){const r=q.rotation*Math.PI/180,s=q.scale/100;
    return {x:q.x*p.W+s*(v.x*Math.cos(r)-v.y*Math.sin(r)),y:q.y*p.H+s*(v.x*Math.sin(r)+v.y*Math.cos(r))};}
  function bounds(l,p,frame,ctx,lyricBounds){
    const q=pose(l,p,frame),g=l.type==='space'?{cx:0,cy:0,w:p.W*F.at(l,frame).width,h:p.H*F.at(l,frame).height}:geometry(l,p,ctx,lyricBounds);
    const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>worldPoint(q,{x:g.cx+x*g.w/2,y:g.cy+y*g.h/2},p));
    return {q,g,corners,minX:Math.min(...corners.map(v=>v.x)),maxX:Math.max(...corners.map(v=>v.x)),
      minY:Math.min(...corners.map(v=>v.y)),maxY:Math.max(...corners.map(v=>v.y))};
  }
  function contains(l,p,frame,pt,ctx,lyricBounds,tolerance=6){
    const {q,g}=bounds(l,p,frame,ctx,lyricBounds),r=-q.rotation*Math.PI/180,s=q.scale/100;
    if(s<=0||q.opacity<1)return false;
    const dx=pt.x-q.x*p.W,dy=pt.y-q.y*p.H,x=(dx*Math.cos(r)-dy*Math.sin(r))/s-g.cx,y=(dx*Math.sin(r)+dy*Math.cos(r))/s-g.cy;
    const tol=tolerance/s;
    if(l.type==='shape'&&l.shape==='ellipse'){
      const rr=(x/(g.w/2+tol))**2+(y/(g.h/2+tol))**2;
      if(rr>1)return false;
      if(!l.fill){const inner=(x/Math.max(1,g.w/2-l.stroke/2-tol))**2+(y/Math.max(1,g.h/2-l.stroke/2-tol))**2;return inner>=1;}
      return true;
    }
    if(l.type==='shape'&&l.shape==='triangle'){
      const yy=(y+g.h/2)/g.h;if(yy<0||yy>1)return false;return Math.abs(x)<g.w*yy/2+tol;
    }
    return Math.abs(x)<=g.w/2+tol&&Math.abs(y)<=g.h/2+tol;
  }
  function drawShape(ctx,l,p){
    const w=p.W*l.width,h=p.H*l.height;ctx.fillStyle=l.color;ctx.strokeStyle=l.color;ctx.lineWidth=Math.max(1,l.stroke);
    ctx.beginPath();
    if(l.shape==='ellipse')ctx.ellipse(0,0,w/2,h/2,0,0,Math.PI*2);
    else if(l.shape==='triangle'){ctx.moveTo(0,-h/2);ctx.lineTo(w/2,h/2);ctx.lineTo(-w/2,h/2);ctx.closePath();}
    else if(l.shape==='line'){ctx.moveTo(-w/2,0);ctx.lineTo(w/2,0);ctx.stroke();return;}
    else if(l.shape==='stripes'){
      const count=Math.max(2,Math.min(30,Math.round(l.stripeCount||9))),stripe=w/(count*2-1);
      for(let i=0;i<count;i++)ctx.rect(-w/2+i*2*stripe,-h/2,stripe,h);
    }else ctx.rect(-w/2,-h/2,w,h);
    if(l.fill!==false)ctx.fill();if(l.stroke>0)ctx.stroke();
  }
  window.PVFScene={isBack,order,pose,geometry,bounds,contains,worldPoint,drawShape};
})();
