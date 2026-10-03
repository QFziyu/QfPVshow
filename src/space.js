/* Animated negative space shares Fusion's layer/keyframe model, not a painted rectangle. */
(function(){
  'use strict';
  const F=PVF;
  const layer=p=>p.layers.find(l=>l.type==='space');
  function ensure(p){
    let l=layer(p);if(l)return l;
    if(p.layers.length>=200)throw new Error('图层已达 200 个，请先移除不用的图层');
    const tall=p.jizura.aspect==='9:16',horizontal=tall&&p.jizura.centerDir!=='lr';
    l=F.layer('space','留白区域',{width:horizontal?1:.28,height:horizontal?.34:1,color:'#8ce9dd',spaceDirection:horizontal?'tb':'lr'});
    p.layers.push(l);return l;
  }
  function active(p,t){const l=layer(p.fusion);return p.fusion.jizura.centerFree&&l&&PVFCaptions.visible(l,p,t)?l:null;}
  function corners(l,p,frame){return PVFScene.bounds(l,p,frame,null).corners;}
  function path(ctx,p,t){const l=active(p,t);if(!l)return false;const a=corners(l,p,t*p.fps);ctx.moveTo(a[0].x,a[0].y);for(const v of a.slice(1))ctx.lineTo(v.x,v.y);ctx.closePath();return true;}
  function clipOutside(ctx,p,t){if(!active(p,t))return;ctx.beginPath();ctx.rect(-p.W*10,-p.H*10,p.W*21,p.H*21);path(ctx,p,t);ctx.clip('evenodd');}
  function clipInside(ctx,p,t){ctx.beginPath();if(path(ctx,p,t))ctx.clip();}
  // Reserve the rotated rectangle's bounding box when reflowing side bands. The precise
  // rotated boundary is used for exclusion, so manual transforms cannot refill the space.
  J.fusionZone=(p,z,t)=>{
    if(!p.fusion)return z;const l=active(p,t);if(!l)return z;
    const a=corners(l,p,t*p.fps),left=F.clamp(Math.min(...a.map(v=>v.x)),0,p.W),right=F.clamp(Math.max(...a.map(v=>v.x)),0,p.W),top=F.clamp(Math.min(...a.map(v=>v.y)),0,p.H),bottom=F.clamp(Math.max(...a.map(v=>v.y)),0,p.H);
    const i=['right','bottom'].includes(z.side)?1:0;
    if(l.spaceDirection==='tb')return i?{x:0,y:bottom,w:p.W,h:Math.max(.01,p.H-bottom)}:{x:0,y:0,w:p.W,h:Math.max(.01,top)};
    return i?{x:right,y:0,w:Math.max(.01,p.W-right),h:p.H}:{x:0,y:0,w:Math.max(.01,left),h:p.H};
  };
  window.PVFSpace={layer,ensure,active,corners,clipOutside,clipInside};
})();
