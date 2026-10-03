/* Qf-PV show V1 — navigation and quiet personal identity, by QFziyu.
   This shell does not alter projects, rendering or animation data. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const groups={left:[['material','tabMaterial','panelMaterial'],['style','tabStyle','panelStyle'],['composition','tabComposition','panelComposition']],
    right:[['elements','tabElements','panelElements'],['motion','tabMotion','panelMotion'],['export','tabExport','panelExport']]};
  const current={left:'material',right:'elements'};
  function show(group,key,focus=false){
    const items=groups[group];if(!items?.some(([value])=>value===key))return;
    for(const [value,button,panel]of items){const on=value===key;$(panel).hidden=!on;$(button).setAttribute('aria-selected',String(on));$(button).tabIndex=on?0:-1;if(on&&focus)$(button).focus();}
    current[group]=key;
    if(group==='right')$('editTitle').hidden=key==='export';
    QFUI.onChange?.(group,key);
  }
  function init(){
    for(const [group,items]of Object.entries(groups)){
      for(const [key,id]of items){
        $(id).onclick=()=>show(group,key);
        $(id).addEventListener('keydown',e=>{
          if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation?.();
          const index=items.findIndex(v=>v[0]===key),next=e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowRight'?1:-1)+items.length)%items.length;
          show(group,items[next][0],true);
        });
      }
      show(group,current[group]);
    }
    $('goStyle').onclick=()=>show('left','style',true);
    $('goComposition').onclick=()=>show('left','composition',true);
    $('goMotion').onclick=()=>show('right','motion',true);
    $('backElements').onclick=()=>show('right','elements',true);
    $('showExport').onclick=()=>show('right','export',true);
    $('showAbout').onclick=()=>{if(!$('aboutDialog').open)$('aboutDialog').showModal();};
    $('closeAbout').onclick=()=>{$('aboutDialog').close();$('showAbout').focus();};
    $('aboutDialog').addEventListener('close',()=>$('showAbout').focus());
  }
  window.QFUI={init,show,current,onChange:null};
})();
