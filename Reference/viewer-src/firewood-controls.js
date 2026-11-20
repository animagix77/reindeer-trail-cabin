// The wood controls follow what the walker can actually reach and carry, including on touch.
const singular={twigs:'handful of twigs',sticks:'stick',logs:'split log'};
const plural={twigs:'Twigs',sticks:'Sticks',logs:'Split logs'};
export function installFirewoodControls({pickUp,toss,putBack,stopMovement,render}){
  const get=id=>document.getElementById(id);
  const panel=get('firewood-hud'),title=get('firewood-title'),guide=get('firewood-guide');
  const choices=get('firewood-choice'),primary=get('firewood-action'),label=get('firewood-label');
  const key=get('firewood-key'),back=get('firewood-back'),canvas=get('view');
  let state=null,view='',action='',displayKey='';
  function paint(){
    if(!state)return;
    const {counts,held,nearby,nearPit,nearStockpile,inFlight,canToss,message}=state;
    const woods=nearby.filter(k=>Object.hasOwn(singular,k)&&counts[k]>0);
    const show=view!=='property' && (held||inFlight||woods.length||nearStockpile||nearPit);
    panel.hidden=!show;
    if(!show){displayKey='';action='';return;}
    const signature=JSON.stringify([woods,counts,held,nearPit,nearStockpile,inFlight,canToss,message]);
    if(displayKey===signature)return;
    displayKey=signature;
    panel.toggleAttribute('data-carrying',Boolean(held));
    const previous=choices.value;
    choices.replaceChildren(...woods.map(k=>new Option(plural[k]+' ('+counts[k]+')',k)));
    if(woods.includes(previous))choices.value=previous;
    choices.hidden=!!held||!!inFlight||woods.length<2;
    back.hidden=!held||!!inFlight||!nearby.includes(held);
    primary.disabled=false;primary.hidden=false;
    title.textContent=held?'Carrying a '+singular[held]:inFlight?'Wood in flight':'Campfire wood';
    if(inFlight){
      action='';primary.hidden=true;
      guide.textContent='Watch the wood land in the fire ring.';
    }else if(held){
      action='toss';label.textContent='Toss into fire pit';key.textContent='T';
      primary.disabled=!canToss;
      guide.textContent=canToss?'The stone fire ring is within reach.':nearPit?'Turn toward the stone fire ring and step closer.':'Carry the wood to the stone fire ring.';
    }else if(woods.length){
      action='pick';label.textContent=woods.length===1?'Pick up a '+singular[woods[0]]:'Pick up';key.textContent='G';
      guide.textContent=message||'Carry a piece to the fire ring.';
    }else if(!Object.keys(singular).some(k=>counts[k]>0)){
      action='';primary.hidden=true;
      guide.textContent=message||'The woodpile is empty.';
    }else{
      action='';primary.hidden=true;
      guide.textContent=nearStockpile?'Walk closer to the loose wood to pick it up.':'Gather wood at the pile behind the hanging chairs.';
    }
    key.hidden=!key.textContent;
    if(action==='pick'||action==='toss')primary.setAttribute('aria-keyshortcuts',key.textContent);
    else primary.removeAttribute('aria-keyshortcuts');
  }
  function invoke(){
    if(!state || panel.hidden || primary.hidden || primary.disabled)return;
    stopMovement();
    if(action==='pick')pickUp(choices.value);
    else if(action==='toss')toss();
    canvas.focus({preventScroll:true});render();
  }
  primary.addEventListener('click',invoke);
  back.addEventListener('click',()=>{stopMovement();putBack();canvas.focus({preventScroll:true});render();});
  // Leave the chat, settings, station activities and dialog keyboard controls alone.
  document.addEventListener('keydown',e=>{
    if(e.defaultPrevented||e.repeat||e.metaKey||e.ctrlKey||e.altKey||e.shiftKey||
       (e.target!==canvas && e.target!==document.body)||panel.hidden||
       !get('activity').hidden||document.querySelector('dialog[open]'))return;
    if((action==='pick' && e.code==='KeyG') || (action==='toss' && e.code==='KeyT')){
      if(primary.disabled)return;
      e.preventDefault();invoke();
    }
  });
  return {
    set(next){state=next;paint();},
    destination(next){view=next;displayKey='';paint();}
  };
}
