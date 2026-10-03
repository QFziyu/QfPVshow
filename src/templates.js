/* All registered JIZURA parts are available in the Fusion inspector. */
(function(){
  'use strict';
  const names={noir:'黑白色差',crimson:'深红信号',caution:'警示黄',magenta:'流行洋红',paper:'纸张墨迹',hud:'暗色 HUD',mint:'薄荷终端',specimen:'字体标本',transit:'交通指示',blueprint:'蓝图',rouge:'胭脂渐变',mono:'单色 RGB',sakura:'樱花',ocean:'深海',sunset:'夕阳渐变',forest:'森林手帖',vapor:'蒸汽波',newsprint:'新闻纸',synth80:'80 年代合成器',kraft:'牛皮纸',candy:'糖果',acid:'酸性绿',sumi:'水墨朱砂',gold:'金色夜晚'};
  for(const [k,n]of Object.entries(names))if(J.STYLES[k])J.STYLES[k].name=n;
  const groups={layout:'排版',enter:'入场',exit:'退场',hold:'停留',decor:'装饰',treat:'文字处理',bg:'模板背景',cam:'镜头',trans:'转场'};
  function options(group){return J.order(group).filter(k=>!J.registry(group)[k].special).map(k=>({id:k,name:J.registry(group)[k].name||k}));}
  function resetPool(j){j.enabled=J.songEnabled(j);}
  function generate(p,seed){
    const j=p.jizura,style=j.style,colors=PVF.clone(j.colors),extra={};
    for(const k of ['extra','wa','horror','typo','kinetic'])extra[k]=j[k];
    Object.assign(j,J.rollSongProfile(j,PVFPresets.rng(seed))||J.omakase(j));
    Object.assign(j,extra);j.style=style;j.colors=colors;j.seed=seed;
    p.layers=PVFPresets.retainedLayers(p);p.templateBackground=true;p.backgroundRecipe=null;
  }
  function apply(p,line,group,key){
    if(!groups[group]||!J.registry(group)[key]||J.registry(group)[key].special)throw new Error('请选择有效模板');
    const j=p.jizura,o=j.overrides[line]||{};
    delete o.lockedCuts;delete o.cutTech;delete o.cutLayouts;o.lock=false;
    // The planner accepts an array for a manual decoration override.
    o[group]=group==='decor'?[key]:key;j.overrides[line]=o;
  }
  window.PVFTemplates={groups,options,resetPool,generate,apply};
})();
