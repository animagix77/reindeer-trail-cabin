export function installWelcome({pause, resume, enter}) {
  const dialog = document.getElementById('welcome');
  const revisit = document.getElementById('welcome-again');
  const start = document.getElementById('welcome-start');
  let firstVisit = false;
  let accepted = false;

  function open(first) {
    firstVisit = first;
    accepted = false;
    start.firstElementChild.textContent = first ? 'Start exploring' : 'Return to the cabin';
    if (document.pointerLockElement) document.exitPointerLock();
    pause();
    dialog.showModal();
    start.focus({preventScroll:true});
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
  return {get open(){return dialog.open;}};
}
