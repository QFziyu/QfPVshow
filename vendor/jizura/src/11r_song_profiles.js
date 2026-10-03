/* Song categories constrain automatic choices; explicit line picks remain editable. */
(() => {
'use strict';
const pool = (layout, enter, exit, hold, decor, treat, bg, cam, fx, trans) => ({layout,enter,exit,hold,decor,treat,bg,cam,fx,trans});
const common = {treat:['none'],bg:['none'],cam:['push'],fx:[],trans:[]};
J.SONG_PROFILES = {
 ballad: {name:'慢歌抒情',desc:'柔和出现与消散，轻微呼吸，少装饰、少切镜；适合慢歌、钢琴和抒情人声。',mood:'calm',styles:['paper','specimen','noir'],maxCuts:2,maxDecor:1,speed:1.45,
  fx:{motion:0.25,glitch:0,chroma:0,decor:0.12,density:0.18,texture:0.25,bgSwitch:0,flash:false,hud:'off',koma:0,onTwos:false},
  pools:{...common,layout:['center','gloss','vcols','stack'],enter:['blur','wipe'],exit:['blur','drift','wipe'],hold:['still','breathe','drift'],decor:['leaders','waveform']}},
 minimal: {name:'极简叙事',desc:'一句歌词一个镜头，以文字阅读为主；无装饰、闪屏或色差，适合民谣、独白和安静叙事。',mood:'editorial',styles:['specimen','paper','noir'],maxCuts:1,maxDecor:0,speed:1.3,
  fx:{motion:0.12,glitch:0,chroma:0,decor:0,density:0.08,texture:0.12,bgSwitch:0,flash:false,hud:'off',koma:0,onTwos:false},
  pools:{...common,layout:['center','gloss','vcols'],enter:['blur','wipe'],exit:['blur','wipe'],hold:['still'],decor:[]}},
 pop: {name:'流行轻快',desc:'弹出、轻旋转与波浪排版，搭配少量图形；适合轻快流行、可爱和青春歌曲。',mood:'pop',styles:['magenta','caution'],maxCuts:5,maxDecor:2,speed:1,
  fx:{motion:0.65,glitch:0,chroma:0.15,decor:0.4,density:0.5,texture:0.2,bgSwitch:0.3,flash:false,hud:'off',koma:0,onTwos:false},
  pools:pool(['center','wave','mixed','pill','circle','huge'],['pop','drop','spin','zoom','wipe'],['shrink','blur','wipe','scatter'],['still','wave','breathe'],['dots','sparks','shapes','leaders'],['none'],['none'],['push'],['zoom'],['irisOpen','pushSlide'])},
 rock: {name:'摇滚燃曲',desc:'大字、快速集合、伸缩与爆散，突出强拍；适合摇滚、燃曲和高能副歌。',mood:'emotional',styles:['noir','crimson','caution'],maxCuts:8,maxDecor:2,speed:0.85,
  fx:{motion:0.85,glitch:0.3,chroma:0.45,decor:0.35,density:0.7,texture:0.5,bgSwitch:0.35,flash:true,hud:'off',koma:0,onTwos:false},
  pools:pool(['huge','condensed','stack','mixed','diag','center'],['assemble','stretch','zoom','slice','wipe'],['explode','scatter','stretch','slice','blur'],['still','jitter','drift'],['slash','bars','rings','sparks'],['none'],['none'],['push'],['chroma','shake','zoom','flash'],['zoomThrough','sliceShift'])},
 electronic: {name:'电子舞曲',desc:'切片、故障与几何排列，切镜更密、节拍更强；适合电子、舞曲和合成器音乐。',mood:'glitch',styles:['mint','crimson','noir'],maxCuts:10,maxDecor:3,speed:0.9,
  fx:{motion:0.75,glitch:0.7,chroma:0.6,decor:0.5,density:0.8,texture:0.3,bgSwitch:0.5,flash:true,hud:'auto',koma:0,onTwos:false},
  pools:pool(['tile','labels','marquee','diag','condensed','center'],['slice','scramble','stretch','zoom','assemble'],['glitch','slice','stretch','shrink'],['still','glitchtick','jitter'],['grid','barcode','rings','arrows','bars'],['none'],['none'],['push'],['chroma','slice','block','zoom','flash'],['blockDissolve','sliceShift','pixelate'])},
 cinematic: {name:'电影感',desc:'留白、大字和缓慢集合，以柔和消散收尾；适合叙事歌曲、氛围音乐和电影配乐。',mood:'emotional',styles:['noir','paper','specimen'],maxCuts:3,maxDecor:1,speed:1.35,
  fx:{motion:0.4,glitch:0,chroma:0.08,decor:0.15,density:0.3,texture:0.4,bgSwitch:0.1,flash:false,hud:'off',koma:0,onTwos:false},
  pools:{...common,layout:['center','huge','vcols','gloss','stack'],enter:['blur','assemble','wipe'],exit:['blur','drift','wipe'],hold:['still','drift','breathe'],decor:['rings','leaders'],trans:['irisOpen','uncover']}}
};
// Optional expansion-pack parts are still subject to the existing pack switches.
const extras = {
 ballad: {cam:['floatNoise']},
 pop: {bg:['paperCut'],cam:['jelly','pendulumSway']},
 rock: {bg:['filmStrip'],cam:['earthquake','snapPan']},
 electronic: {bg:['hexGrid','squareTunnel'],cam:['snapPan','spiralIn']},
 cinematic: {bg:['godRays','nightMoon'],cam:['floatNoise','focusIn','tiltDown']}
};
for (const [key, groups] of Object.entries(extras)) for (const [g, keys] of Object.entries(groups)) {
  J.SONG_PROFILES[key].pools[g] = [...J.SONG_PROFILES[key].pools[g], ...keys];
}
J.songProfile = p => J.SONG_PROFILES[p && p.songProfile] || null;
J.songAllows = (p,g,k) => {const s=J.songProfile(p);return !s || !s.pools[g] || s.pools[g].includes(k);};
J.songEnabled = p => {
 const s=J.songProfile(p), out={};
 for(const g of J.GROUP_KEYS) out[g]=Object.fromEntries(J.order(g).map(k=>[k,(!s || J.songAllows(p,g,k)) && (!J.randomOk || J.randomOk(p,g,k))]));
 return out;
};
J.songSettings = p => {
 const s=J.songProfile(p);if(!s)return p;
 const fx={...p.fx}, enabled={};
 // Caps prevent a full randomisation or a saved high intensity from defeating the category.
 for(const [k,v] of Object.entries(s.fx)) if(typeof v==='number' && k!=='koma') fx[k]=Math.min(Number.isFinite(+fx[k])?+fx[k]:v,v);
 if(!s.fx.flash)fx.flash=false;if(s.fx.hud==='off')fx.hud='off';
 for(const g of J.GROUP_KEYS) enabled[g]=Object.fromEntries(J.order(g).map(k=>[k,J.songAllows(p,g,k) && (!p.enabled?.[g] || p.enabled[g][k]!==false)]));
 return {...p,fx,enabled};
};
J.rollSongProfile = (p,rnd=Math.random) => {
 const s=J.songProfile(p);if(!s)return null;
 const styles=s.styles.filter(k=>J.STYLES[k] && (!J.randomOk || J.randomOk(p,'style',k)));
 const style=styles[Math.floor(rnd()*styles.length)] || s.styles[0];
 const fx={...p.fx,...s.fx};
 for(const k of ['motion','decor','density','texture'])fx[k]=+(fx[k]*(0.85+0.15*rnd())).toFixed(3);
 const overrides={};for(const [i,o] of Object.entries(p.overrides||{}))if(o.lock)overrides[i]=o;
 return {songProfile:p.songProfile,mood:s.mood,style,fx,enabled:J.songEnabled(p),fonts:{},colors:{...p.colors,enabled:false,accentOn:false},overrides,seed:Math.floor(rnd()*1e9)};
};
J.applySongProfile = (p,key) => {
 p.songProfile=key;
 if(J.songProfile(p))Object.assign(p,J.rollSongProfile(p));
};
})();
