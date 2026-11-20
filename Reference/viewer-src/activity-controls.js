export function activityControls(actions){
  const get=id=>document.getElementById(id);
  const panel=get('activity'), grill=get('cooking'), deer=get('feeding');
  const recipe=get('recipe'), produce=get('produce');
  const foodChoices=[...produce.querySelectorAll('input')];
  const selectedFood=()=>foodChoices.find(choice=>choice.checked).value;
  let mode=null,grillState={},deerState={inventory:{}};
  function display(next){
    mode=next;
    panel.hidden=!mode;grill.hidden=mode!=='cook';deer.hidden=mode!=='deer';
    get('activity-title').textContent=mode==='cook'?'Deck grill':'Deer meadow';
    for(const [id,key] of [['use-grill','cook'],['scene-deer','deer']]){
      get(id).setAttribute('aria-expanded',String(key===mode));
    }
    if(mode && document.pointerLockElement)document.exitPointerLock();
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
    deerState=state;
    if(mode==='deer'&&!state.near)display(null);
    for(const choice of foodChoices)choice.parentElement.querySelector('b').textContent=state.inventory[choice.value]??0;
    const food=selectedFood();
    const held=state.holding===food;
    get('hold-food').textContent=held?'Put back':'Hold out';
    get('hold-food').disabled=get('toss-food').disabled=!held && !state.inventory[food];
    get('deer-message').textContent=state.message;
  }
  const bind=(id,fn)=>get(id).addEventListener('click',()=>{fn();actions.schedule();});
  bind('use-grill',()=>{if(mode==='cook')display(null);else if(actions.view()!=='cook')actions.choose('cook');else display('cook');});
  bind('scene-deer',()=>{
    if(deerState.near)display(mode==='deer'?null:'deer');
    else actions.choose('deer');
  });
  bind('activity-close',()=>{const trigger=mode==='cook'?'use-grill':'scene-deer';display(null);get(trigger).focus();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape' && mode && !e.defaultPrevented)get('activity-close').click();});
  bind('burners',()=>actions.grill()?.light());bind('add-food',()=>actions.grill()?.add(recipe.value));
  bind('flip-food',()=>actions.grill()?.flip());bind('serve-food',()=>actions.grill()?.serve());
  bind('hold-food',()=>actions.herd()?.hold(selectedFood()));bind('toss-food',()=>actions.herd()?.toss(selectedFood()));
  bind('refill-basket',()=>actions.herd()?.refill());
  produce.addEventListener('change',()=>setDeer(deerState));
  return {setGrill,setDeer,get offeringFood(){return Boolean(deerState.holding);},destination(view){display(view==='cook'&&grillState.near?'cook':view==='deer'?'deer':null);}};
}
