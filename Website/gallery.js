(() => {
  const nav = document.querySelector('.mobile-nav');
  nav.addEventListener('click', event => {
    if (event.target.closest('a')) nav.open = false;
  });
  document.addEventListener('click', event => {
    if (nav.open && !nav.contains(event.target)) nav.open = false;
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.open) {
      nav.open = false;
      nav.querySelector('summary').focus();
    }
  });

  const photos = window.cabinPhotoGallery;
  const dialog = document.querySelector('#lightbox');
  if (!Array.isArray(photos) || !photos.length || !dialog.showModal) return;

  const picker = dialog.querySelector('#photo-picker');
  const grid = dialog.querySelector('#pick-grid');
  const category = dialog.querySelector('#pick-category');
  const single = dialog.querySelector('#photo-single');
  const screen = dialog.querySelector('#viewer-img');
  const caption = dialog.querySelector('#viewer-caption');
  const counter = dialog.querySelector('#viewer-count');
  const all = dialog.querySelector('[data-all]');
  let active = 0;
  let opener;
  let drawnCategory;

  for (const label of new Set(photos.map(photo => photo.category).filter(Boolean))) {
    category.add(new Option(label, label));
  }

  function showPhoto(index) {
    active = (index + photos.length) % photos.length;
    const photo = photos[active];
    picker.hidden = true;
    single.hidden = false;
    screen.alt = photo.alt;
    screen.src = photo.src;
    caption.textContent = [photo.title, photo.note].filter(Boolean).join(' · ');
    counter.textContent = (active + 1) + ' / ' + photos.length;
  }

  function showPicker() {
    picker.hidden = false;
    single.hidden = true;
    if (drawnCategory === category.value) return;
    drawnCategory = category.value;
    const items = document.createDocumentFragment();
    photos.forEach((photo, index) => {
      if (category.value && photo.category !== category.value) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.index = index;
      const image = document.createElement('img');
      image.loading = 'lazy';
      image.decoding = 'async';
      image.src = photo.src;
      image.alt = '';
      const label = document.createElement('span');
      label.textContent = photo.title;
      button.append(image, label);
      items.append(button);
    });
    grid.replaceChildren(items);
    grid.scrollTop = 0;
  }

  document.querySelectorAll('a[data-photo]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const index = photos.findIndex(photo => new URL(photo.src, document.baseURI).href === link.href);
      if (index < 0) return;
      event.preventDefault();
      opener = link;
      if (link.classList.contains('all-photos')) showPicker();
      else showPhoto(index);
      dialog.showModal();
      document.body.classList.add('viewing');
      dialog.querySelector('[data-close]').focus();
    });
  });
  category.addEventListener('change', showPicker);
  grid.addEventListener('click', event => {
    const tile = event.target.closest('button[data-index]');
    if (!tile) return;
    showPhoto(Number(tile.dataset.index));
    all.focus();
  });
  all.addEventListener('click', () => {
    showPicker();
    category.focus();
  });
  dialog.querySelector('[data-next]').addEventListener('click', () => showPhoto(active + 1));
  dialog.querySelector('[data-prev]').addEventListener('click', () => showPhoto(active - 1));
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('keydown', event => {
    if (single.hidden) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      showPhoto(active + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });
  let touch;
  screen.addEventListener('touchstart', event => {
    touch = event.touches.length === 1 ? event.touches[0] : null;
  }, {passive:true});
  screen.addEventListener('touchend', event => {
    if (!touch) return;
    const dx = event.changedTouches[0].clientX - touch.clientX;
    const dy = event.changedTouches[0].clientY - touch.clientY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) showPhoto(active + (dx < 0 ? 1 : -1));
    touch = null;
  }, {passive:true});
  dialog.addEventListener('close', () => {
    document.body.classList.remove('viewing');
    if (opener) opener.focus({preventScroll:true});
  });
})();
