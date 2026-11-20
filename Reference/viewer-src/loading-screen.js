// Give the browser an opportunity to paint each real setup milestone before
// starting CPU/GPU work. Loading can also finish when the tab is in the background.
export function afterPaint(){
  if(document.hidden)return Promise.resolve();
  return new Promise(resolve=>{
    const frame=requestAnimationFrame(()=>{clearTimeout(fallback);setTimeout(resolve,0);});
    const fallback=setTimeout(()=>{cancelAnimationFrame(frame);resolve();},80);
  });
}

function transferTime(seconds){
  if(seconds==null)return 'Estimating time…';
  if(seconds<60){
    const value=seconds<15?Math.ceil(seconds):Math.round(seconds/5)*5;
    return 'About '+value+(value===1?' second':' seconds')+' left';
  }
  const minutes=Math.round(seconds/60);
  return 'About '+minutes+(minutes===1?' minute':' minutes')+' left';
}

export function installLoadingScreen(){
  const full=document.getElementById('status'),compact=document.getElementById('welcome-loading');
  const dialog=document.getElementById('welcome'),canvas=document.getElementById('view');
  const views=[full,compact].map(host=>{
    const find=name=>host.querySelector('[data-load-'+name+']');
    const retry=find('retry');
    retry.addEventListener('click',()=>location.reload());
    return {host,retry,bar:find('bar'),stage:find('stage'),detail:find('detail'),percent:find('percent'),eta:find('eta')};
  });
  const quotes=JSON.parse(document.getElementById('loading-quotes').textContent);
  const captions=[full.querySelector('[data-load-quote]'),dialog.querySelector('[data-load-quote]')];
  let currentQuote=quotes.indexOf(captions[0].textContent);
  captions[1].textContent=quotes[currentQuote];
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const quoteTimer=setInterval(()=>{
    if(document.hidden || reducedMotion.matches)return;
    currentQuote=(currentQuote+1)%quotes.length;
    for(const caption of captions)caption.textContent=quotes[currentQuote];
  },8000);
  function endQuotes(){
    clearInterval(quoteTimer);
    for(const caption of captions)caption.hidden=true;
  }
  canvas.inert=true;
  canvas.setAttribute('aria-busy','true');
  let finished=false,failed=false;
  dialog.addEventListener('close',()=>{
    if(finished)compact.hidden=true;
    if(failed)views[0].retry.focus({preventScroll:true});
  });
  function put(node,text){
    if(node.textContent!==text)node.textContent=text;
    node.hidden=!text;
  }
  function display(state,stage,detail,eta='',value=null){
    for(const v of views){
      v.host.dataset.state=state;
      put(v.stage,stage);put(v.detail,detail);put(v.eta,eta);
      put(v.percent,value===null || state==='ready'?'':value+'%');
      v.bar.hidden=state==='error';
      if(value===null)v.bar.removeAttribute('value');
      else v.bar.value=value;
      v.bar.setAttribute('aria-label',stage);
      v.retry.hidden=state!=='error';
    }
  }
  return {
    transfer({source,loaded,total,remainingSeconds,stalled}){
      const download=source==='download';
      const mb=bytes=>(bytes/1000000).toFixed(1);
      const eta=stalled?'Waiting for more data…':download && loaded<total?transferTime(remainingSeconds):'';
      display(download?'download':'embedded',download?'Downloading the cabin':'Reading the saved cabin',
        mb(loaded)+' of '+mb(total)+' MB',eta,Math.floor(loaded/total*100));
    },
    async preparing(step,detail){
      display('preparing','Preparing the cabin',detail,'Step '+step+' of 3');
      await afterPaint();
    },
    ready(){
      endQuotes();
      finished=true;canvas.inert=false;canvas.setAttribute('aria-busy','false');
      display('ready','Ready to explore','','',100);
      full.hidden=true;compact.hidden=!dialog.open;
      if(!dialog.open && document.activeElement===document.body)canvas.focus({preventScroll:true});
    },
    failed(message){
      endQuotes();
      failed=true;canvas.setAttribute('aria-busy','false');
      full.hidden=false;compact.hidden=false;
      display('error','The cabin couldn’t open',message);
      document.getElementById('welcome-start').disabled=true;
      views[dialog.open?1:0].retry.focus({preventScroll:true});
    }
  };
}
