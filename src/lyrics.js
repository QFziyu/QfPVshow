/* Lightweight line timing. No speech model, remote service or audio upload. */
(function(){
  'use strict';
  function parse(raw){
    const rows=[];for(const line of String(raw).replace(/^\uFEFF/,'').split(/\r?\n/)){
      if(/^\s*\[(ti|ar|al|by|offset|length|re|ve):/i.test(line))continue;
      const times=Array.from(line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g),m=>+m[1]*60+ +m[2]);
      const end=line.match(/\[end:(\d+(?:\.\d+)?)\]/),text=line.replace(/\[[^\]]*\]/g,'').replace(/<\d+:\d+(?:\.\d+)?>/g,'').trim();
      if(!text)continue;for(const start of times.length?times:[null])rows.push({text,start,end:end?+end[1]:null});
    }return rows;
  }
  const stamp=t=>'['+String(Math.floor(t/60)).padStart(2,'0')+':'+(t%60).toFixed(3).padStart(6,'0')+']';
  function serialize(rows,plainLrc=false){
    return rows.map((r,i)=>{
      if(r.start==null)return r.text;
      const next=rows[i+1]?.start,end=r.end!=null&&r.end>r.start?r.end:next!=null&&next>r.start?next:null;
      return stamp(r.start)+(!plainLrc&&end!=null?'[end:'+ +end.toFixed(3)+']':'')+r.text;
    }).join('\n');
  }
  function setStart(rows,index,t){
    if(!rows[index])throw new Error('没有待打轴的歌词行');
    if(!Number.isFinite(t)||t<0)throw new Error('起点时间无效');
    const previous=rows[index-1]?.start,next=rows[index+1]?.start;
    if(previous!=null&&t<=previous)throw new Error('起点必须晚于上一句；请跳转后重打');
    // Untapped later rows may contain old timestamps. Clear invalid ones instead of changing their text.
    rows[index].start=t;rows[index].end=null;
    for(let i=index+1;i<rows.length&&rows[i].start!=null&&rows[i].start<=t;i++){rows[i].start=null;rows[i].end=null;}
    if(index>0)rows[index-1].end=t;
    if(next!=null&&next>t)rows[index].end=next;
  }
  function snap(t,beats,windowSeconds=.12){
    if(!beats?.length)return t;let lo=0,hi=beats.length;while(lo<hi){const m=(lo+hi)>>1;if(beats[m]<t)lo=m+1;else hi=m;}
    const options=[beats[lo],beats[lo-1]].filter(Number.isFinite),best=options.sort((a,b)=>Math.abs(a-t)-Math.abs(b-t))[0];
    return best!=null&&Math.abs(best-t)<=windowSeconds?best:t;
  }
  window.PVFLyrics={parse,stamp,serialize,setStart,snap};
})();
