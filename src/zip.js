/* Dependency-free ZIP STORE for portable projects and AE handoff packages. */
(function(root){
  'use strict';
  const te=new TextEncoder(),td=new TextDecoder();
  const table=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
  const crc=u=>{let c=0xffffffff;for(const b of u)c=table[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;};
  function pack(files){
    const local=[],central=[];let offset=0;
    for(const [name,value] of files){
      const n=te.encode(name),u=typeof value==='string'?te.encode(value):value;
      const h=new Uint8Array(30+n.length),v=new DataView(h.buffer),c=crc(u);
      v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);
      v.setUint32(14,c,true);v.setUint32(18,u.length,true);v.setUint32(22,u.length,true);v.setUint16(26,n.length,true);h.set(n,30);
      const ch=new Uint8Array(46+n.length),cv=new DataView(ch.buffer);
      cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);
      cv.setUint32(16,c,true);cv.setUint32(20,u.length,true);cv.setUint32(24,u.length,true);cv.setUint16(28,n.length,true);cv.setUint32(42,offset,true);ch.set(n,46);
      local.push(h,u);central.push(ch);offset+=h.length+u.length;
    }
    const cdSize=central.reduce((s,c)=>s+c.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);
    ev.setUint32(0,0x06054b50,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,cdSize,true);ev.setUint32(16,offset,true);
    return new Blob([...local,...central,end],{type:'application/zip'});
  }
  function unpack(buffer){
    const u=new Uint8Array(buffer),v=new DataView(buffer),map=new Map();let off=0;
    while(off+4<=u.length&&v.getUint32(off,true)===0x04034b50){
      if(off+30>u.length)throw new Error('项目包已截断');
      if(v.getUint16(off+8,true)!==0||v.getUint16(off+6,true)&9)throw new Error('只支持 PV Fusion 保存的未压缩项目包');
      const len=v.getUint32(off+18,true),nl=v.getUint16(off+26,true),extra=v.getUint16(off+28,true),start=off+30+nl+extra;
      if(start+len>u.length)throw new Error('项目素材已截断');
      const name=td.decode(u.slice(off+30,off+30+nl)),data=u.slice(start,start+len);
      if(name.includes('..')||name.startsWith('/')||name.includes('\\')||map.has(name))throw new Error('无效的包内路径');
      if(crc(data)!==v.getUint32(off+14,true))throw new Error('项目数据校验失败');
      map.set(name,data);off=start+len;
    }
    if(!map.has('project.json'))throw new Error('没有找到 project.json');return map;
  }
  root.PVFZip={pack,unpack};if(typeof module!=='undefined')module.exports=root.PVFZip;
})(typeof window!=='undefined'?window:globalThis);
