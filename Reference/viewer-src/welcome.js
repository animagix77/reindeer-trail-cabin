export function installWelcome({pause, resume, enter}) {
  const dialog = document.getElementById('welcome');
  const revisit = document.getElementById('welcome-again');
  const start = document.getElementById('welcome-start');
  const title = document.getElementById('welcome-title');
  let loadState = 'loading';
  let firstVisit = false;
  let accepted = false;

  function updateButton() {
    start.disabled = loadState !== 'ready';
    let label = firstVisit ? 'Start exploring' : 'Return to the cabin';
    if (loadState === 'loading') label = 'Loading…';
    if (loadState === 'error') label = 'Cabin unavailable';
    start.firstElementChild.textContent = label;
  }

  function open(first) {
    firstVisit = first;
    accepted = false;
    updateButton();
    if (document.pointerLockElement) document.exitPointerLock();
    pause();
    dialog.showModal();
    (start.disabled ? title : start).focus({preventScroll:true});
  }

  start.addEventListener('click', () => { accepted = true; dialog.close(); });
  document.getElementById('welcome-close').addEventListener('click', () => dialog.close());
  revisit.addEventListener('click', () => open(false));
  dialog.addEventListener('keydown', event => event.stopPropagation());
  dialog.addEventListener('close', () => {
    try { sessionStorage.setItem('reindeer-welcome-seen','1'); } catch {}
    if (accepted && firstVisit) enter();
    else if (!firstVisit) revisit.focus({preventScroll:true});
    else document.getElementById('view').focus({preventScroll:true});
    resume();
  });
  window.addEventListener('hashchange', () => { if (dialog.open) dialog.close(); });

  let seen = false;
  try { seen = sessionStorage.getItem('reindeer-welcome-seen')==='1'; } catch {}
  // Shared locations and invitation URLs retain their own entry point.
  if (!seen && !location.hash && !location.search) open(true);
  return {
    get open(){return dialog.open;},
    setLoadState(state) {
      loadState = state;
      updateButton();
      if (!start.disabled && dialog.open && document.activeElement === title) start.focus({preventScroll:true});
    }
  };
}
