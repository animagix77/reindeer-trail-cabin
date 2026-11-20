export function activityControls(actions){
  const get=id=>document.getElementById(id);
  const panel=get('activity'), grill=get('cooking'), deer=get('feeding');
  const recipe=get('recipe'), produce=get('produce');
  let mode=null,grillState={},deerState={inventory:{}};
  function display(next){
    mode=next;
    panel.hidden=!mode;grill.hidden=mode!=='cook';deer.hidden=mode!=='deer';
    get('activity-title').textContent=mode==='cook'?'Deck grill':'Feed the deer';
    for(const [id,key] of [['use-grill','cook'],['feed-deer','deer']]){
      get(id).setAttribute('aria-expanded',String(key===mode));
    }
    if(mode){actions.closeScene();if(document.pointerLockElement)document.exitPointerLock();}
    actions.lid(mode==='cook');
    actions.schedule();
  }
  function setGrill(state){
    grillState=state;
    get('use-grill').hidden=!state.near;
    if(mode==='cook'&&!state.near)display(null);
    get('burners').textContent=state.lit?'Turn off':'Light grill';
    get('burners').setAttribute('aria-pressed',String(state.lit));
    recipe.disabled=state.busy;
    get('add-food').disabled=!state.lit || state.busy;
    get('flip-food').disabled=!state.busy || state.turning;
    get('serve-food').disabled=!state.ready || state.turning;
    get('grill-message').textContent=state.message;
  }
  function setDeer(state){
    deerState=state;get('feed-deer').hidden=!state.near;
    if(mode==='deer'&&!state.near)display(null);
    for(const o of produce.options)o.textContent=o.dataset.label+' · '+state.inventory[o.value];
    const held=state.holding===produce.value;
    get('hold-food').textContent=held?'Put back':'Hold out';
    get('hold-food').disabled=get('toss-food').disabled=!held && !state.inventory[produce.value];
    get('deer-message').textContent=state.message;
  }
  const bind=(id,fn)=>get(id).addEventListener('click',()=>{fn();actions.schedule();});
  bind('use-grill',()=>{if(mode==='cook')display(null);else if(actions.view()!=='cook')actions.choose('cook');else display('cook');});
  bind('feed-deer',()=>display(mode==='deer'?null:'deer'));
  bind('activity-close',()=>{const trigger=mode==='cook'?'use-grill':'feed-deer';display(null);get(trigger).focus();});
  get('scene-toggle').addEventListener('click',()=>{if(mode)display(null);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape' && mode && !e.defaultPrevented)get('activity-close').click();});
  bind('burners',()=>actions.grill()?.light());bind('add-food',()=>actions.grill()?.add(recipe.value));
  bind('flip-food',()=>actions.grill()?.flip());bind('serve-food',()=>actions.grill()?.serve());
  bind('hold-food',()=>actions.herd()?.hold(produce.value));bind('toss-food',()=>actions.herd()?.toss(produce.value));
  bind('refill-basket',()=>actions.herd()?.refill());
  produce.addEventListener('change',()=>setDeer(deerState));
  return {setGrill,setDeer,destination(view){display(view==='cook'&&grillState.near?'cook':view==='deer'&&deerState.near?'deer':null);}};
}
