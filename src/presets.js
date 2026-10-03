/* Original recipes made from editable primitives; no PV Tool template code. */
(function(){
  'use strict';
  const F=PVF;
  const catalog=[
    {id:'collage',name:'纸片拼贴',style:'paper',profile:'cinematic',bg:'#ece9e3',colors:['#c2185b','#1b2350','#111111','#d5ccc0'],amount:.7},
    {id:'construct',name:'红黑构成',style:'crimson',profile:'rock',bg:'#150509',colors:['#ff3d6e','#f0ede7','#39f2c8','#8f1734'],amount:1},
    {id:'orbit',name:'几何律动',style:'mint',profile:'electronic',bg:'#081b1d',colors:['#6ef7c7','#f5da73','#b9c9ff','#234647'],amount:1},
    {id:'blueprint',name:'蓝图线构',style:'blueprint',profile:'cinematic',bg:'#0b1625',colors:['#a7d8ff','#d8f584','#477696','#1e3954'],amount:.45},
    {id:'pop',name:'轻快色块',style:'magenta',profile:'pop',bg:'#2b2bd9',colors:['#ff0a8c','#f9e993','#c9c9ff','#5448ee'],amount:.8}
  ];
  const rng=seed=>{let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};};
  function look(project,recipe,seed){
    const j=project.jizura,r=rng(seed);j.songProfile=project.jizura.songProfile||recipe.profile;
    Object.assign(j,J.rollSongProfile(j,r));j.style=recipe.style;j.seed=seed;
    // One fixed palette keeps the editable scene and auto text readable together.
    const style=J.STYLES[recipe.style],sc=style.schemes.find(s=>s.bg.toLowerCase()===recipe.bg)||style.schemes[0];
    j.colors={enabled:true,allSchemes:true,bg:recipe.bg,fg:sc.fg,sub:sc.sub,accent:recipe.colors[0],accent2:recipe.colors[1],accentOn:true};
    j.fx.bgSwitch=0;
    j.staticInterludes=false;project.templateBackground=false;project.background=recipe.bg;
  }
  function shapes(recipe,seed,fps,duration,bpm=108){
    const r=rng(seed),group='recipe-'+seed,list=[],frames=Math.max(2,Math.ceil(duration*fps)-1);
    const hop=Math.max(2,Math.round(fps*60/Math.max(30,bpm)*2),Math.ceil(frames/120));
    const add=(shape,name,x,y,w,h,rotation,color,stroke=0,fill=true,still=false)=>{
      const l=F.layer('shape',name,{shape,role:'background',width:w,height:h,color:recipe.colors[color%recipe.colors.length],stroke,fill,
        generatedGroup:group,base:{x,y,scale:100,rotation,opacity:100}});
      const ax=(.008+r()*.025)*recipe.amount,ay=(.006+r()*.025)*recipe.amount,dr=(2+r()*8)*recipe.amount;
      if(!still){for(let f=0,i=0;f<frames;f+=hop,i++){
        const phase=i%4,v=[0,1,0,-1][phase];F.insert(l,{frame:f,position:{x:x+ax*v,y:y+ay*(phase%2?1:-1)},
          scale:100+(phase%2?3:-1)*recipe.amount,rotation:rotation+dr*v,opacity:100});}
        F.insert(l,{frame:frames,position:{x,y},scale:100,rotation,opacity:100});}
      list.push(l);return l;
    };
    if(recipe.id==='collage'){
      add('rect','纸片 / 左上',.1,.15,.36,.23,-11,3);add('stripes','剪贴条纹',.09,.17,.25,.13,12,1);
      add('rect','纸片 / 右下',.91,.86,.38,.27,-8,3);add('rect','色纸 / 横条',.85,.85,.4,.052,9,0);
      add('ellipse','贴纸圆环',.85,.2,.12,.2,0,0,12,false);add('triangle','三角贴片',.16,.82,.11,.16,-20,1);
      add('line','引导短线',.21,.33,.2,.03,-22,0,7);add('rect','浮动便签',.94,.54,.08,.13,13,0);
    }else if(recipe.id==='construct'){
      add('rect','构成 / 红斜柱',.08,.48,.16,1.25,-22,0);add('rect','构成 / 白斜条',.87,.85,.55,.085,-25,1);
      add('ellipse','构成 / 空心圆',.86,.17,.17,.29,0,1,12,false);add('triangle','构成 / 三角',.17,.17,.17,.21,20,0);
      add('stripes','构成 / 节奏线',.88,.53,.13,.26,-16,3);add('rect','构成 / 小方片',.36,.91,.11,.09,12,2);
      add('line','构成 / 斜切线',.5,.13,.62,.02,-13,3,4);add('rect','构成 / 标尺',.25,.95,.34,.018,0,1);
    }else if(recipe.id==='orbit'){
      add('ellipse','几何 / 大轨道',.92,.82,.32,.56,0,0,8,false);add('ellipse','几何 / 小轨道',.1,.13,.15,.26,0,2,6,false);
      add('ellipse','几何 / 节拍点',.12,.85,.055,.098,0,1);add('triangle','几何 / 指向',.87,.16,.12,.18,23,1);
      add('stripes','几何 / 频率栅',.09,.52,.12,.22,-6,3);add('rect','几何 / 横条',.66,.95,.4,.026,0,0);
      add('line','几何 / 斜线',.2,.23,.18,.02,-34,0,5);add('ellipse','几何 / 游离点',.73,.09,.026,.046,0,0);
    }else if(recipe.id==='blueprint'){
      for(let i=0;i<3;i++)add('line','蓝图 / 水平线 '+(i+1),.5,.12+i*.38,.92,.01,0,3,2,true,true);
      for(let i=0;i<3;i++)add('line','蓝图 / 垂直线 '+(i+1),.08+i*.42,.5,.49,.01,90,3,2,true,true);
      add('ellipse','蓝图 / 定位圈',.87,.16,.14,.25,0,0,3,false);add('rect','蓝图 / 线框',.09,.84,.12,.15,0,0,3,false);
      add('stripes','蓝图 / 编码块',.83,.9,.23,.06,0,0);add('line','蓝图 / 活动尺',.14,.16,.18,.01,-14,1,3);
    }else{
      add('ellipse','色块 / 大圆',.02,.82,.34,.6,0,0);add('rect','色块 / 右侧纸片',.96,.2,.25,.43,18,3);
      add('triangle','色块 / 柠檬角',.86,.84,.2,.26,17,1);add('stripes','色块 / 小条纹',.16,.16,.21,.12,-10,2);
      add('ellipse','色块 / 留白圈',.9,.12,.13,.23,0,2,12,false);add('rect','色块 / 底部横条',.47,.94,.29,.035,-7,0);
      add('rect','色块 / 小贴片',.07,.49,.09,.12,-10,1);add('ellipse','色块 / 浮点',.68,.11,.035,.063,0,1);
    }
    return list;
  }
  function retainedLayers(project){
    const protectedIds=new Set(project.layers.filter(l=>!l.generatedGroup||l.generatedEdited||F.hasLocked(l)).map(l=>l.id));
    // A retained object's tracking target must also be retained.
    let more=true;while(more){more=false;for(const l of project.layers)if(protectedIds.has(l.id)&&l.followId&&!protectedIds.has(l.followId)){protectedIds.add(l.followId);more=true;}}
    return project.layers.filter(l=>!l.generatedGroup||protectedIds.has(l.id));
  }
  function replaceBackground(project,recipe,seed,duration,bpm){
    const kept=retainedLayers(project);
    const retained=kept.filter(l=>l.generatedGroup).length;
    const layers=shapes(recipe,seed,project.fps,duration,bpm);
    project.layers=[...kept.filter(l=>l.type==='background'),...layers,...kept.filter(l=>l.type!=='background')];
    project.backgroundRecipe={id:recipe.id,seed};project.templateBackground=false;project.background=recipe.bg;
    return {added:layers.length,retained};
  }
  window.PVFPresets={catalog,rng,look,shapes,replaceBackground,retainedLayers};
})();
