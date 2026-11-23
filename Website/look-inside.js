(() => {
  const dialog = document.querySelector('#cutaway');
  if (!dialog.showModal) return;

  const openButton = document.querySelector('#cutaway-open');
  const canvas = dialog.querySelector('canvas');
  const poster = dialog.querySelector('#cutaway-poster');
  const status = dialog.querySelector('#cutaway-status');
  const placeholder = dialog.querySelector('.cutaway-placeholder');
  const toolbar = dialog.querySelector('.cutaway-toolbar');
  const loft = dialog.querySelector('#cutaway-loft');
  const photos = dialog.querySelector('#cutaway-photos');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let viewer;
  let loading;

  function fallback() {
    const previous = viewer;
    viewer = null;
    loading = null;
    previous?.dispose();
    placeholder.classList.remove('is-opening');
    poster.src = './media/cabin-cutaway.webp';
    poster.alt = 'A three-quarter view into the cabin with its roof removed';
    placeholder.hidden = false;
    toolbar.hidden = true;
    canvas.tabIndex = -1;
    canvas.setAttribute('aria-busy', 'false');
    status.textContent = 'Interactive rotation is unavailable. Explore the interior in photos.';
    photos.hidden = false;
  }

  async function open() {
    dialog.showModal();
    if (!loading) {
      loft.setAttribute('aria-pressed', 'false');
      placeholder.classList.toggle('is-opening', !motion.matches);
      poster.src = motion.matches ? './media/cabin-cutaway.webp' : './media/cabin-blueprint.svg';
      poster.alt = motion.matches ? 'Furnished floor plan of the cabin' : 'Architectural drawing of the cabin exterior';
      status.textContent = 'Opening the interior…';
      canvas.setAttribute('aria-busy', 'true');
      photos.hidden = true;
      loading = import('./media/cabin-cutaway-viewer.js').then(({createCutaway}) =>
        createCutaway({canvas, modelUrl: './media/cabin-cutaway.glb', reducedMotion: motion, onError: fallback})
      );
    }
    try {
      viewer = await loading;
      canvas.setAttribute('aria-busy', 'false');
      viewer.setActive(dialog.open && !document.hidden);
      if (!dialog.open) return;
      canvas.tabIndex = 0;
      placeholder.hidden = true;
      toolbar.hidden = false;
      loft.hidden = !viewer.hasLoft;
    } catch {
      loading = null;
      fallback();
    }
  }

  openButton.hidden = false;
  openButton.addEventListener('click', open);
  dialog.querySelector('#cutaway-close').addEventListener('click', () => dialog.close());
  photos.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    viewer?.setActive(false);
    openButton.focus({preventScroll: true});
  });
  document.addEventListener('visibilitychange', () => viewer?.setActive(dialog.open && !document.hidden));
  for (const button of dialog.querySelectorAll('[data-turn]')) {
    button.addEventListener('click', () => viewer?.turn(Number(button.dataset.turn)));
  }
  dialog.querySelector('#cutaway-reset').addEventListener('click', () => viewer?.reset());
  loft.addEventListener('click', () => {
    const show = loft.getAttribute('aria-pressed') !== 'true';
    viewer?.setLoft(show);
    loft.setAttribute('aria-pressed', String(show));
  });
})();
