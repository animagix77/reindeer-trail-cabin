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
  if (!Array.isArray(photos) || !photos.length) return;

  const home = document.querySelector('#slide-home');
  const slides = home.querySelector('.cabin-slides');
  const image = slides.querySelector('#slide-image');
  const caption = slides.querySelector('#slide-caption');
  const counter = slides.querySelector('#slide-count');
  const play = slides.querySelector('[data-play]');
  const expand = document.querySelector('.expand-slides');
  const dialog = document.querySelector('#lightbox');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0;
  let playing = !reduced.matches && 'IntersectionObserver' in window;
  let visible = false;
  let timer;

  function show(next) {
    index = (next + photos.length) % photos.length;
    const photo = photos[index];
    image.alt = photo.alt;
    image.src = photo.src;
    caption.textContent = photo.title;
    if (photo.note) {
      const note = document.createElement('small');
      note.textContent = photo.note;
      caption.append(' ', note);
    }
    counter.textContent = (index + 1) + ' / ' + photos.length;
  }

  function schedule() {
    clearTimeout(timer);
    if (playing && !document.hidden && (visible || dialog.open) && image.complete) {
      timer = setTimeout(() => {
        show(index + 1);
        schedule();
      }, 6500);
    }
  }

  function setPlaying(value) {
    playing = value;
    play.textContent = value ? 'Pause slideshow' : 'Play slideshow';
    caption.setAttribute('aria-live', value ? 'off' : 'polite');
    schedule();
  }

  function step(direction) {
    setPlaying(false);
    show(index + direction);
  }

  slides.querySelector('[data-prev]').addEventListener('click', () => step(-1));
  slides.querySelector('[data-next]').addEventListener('click', () => step(1));
  play.addEventListener('click', () => setPlaying(!playing));
  function arrowKey(event) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      step(event.key === 'ArrowLeft' ? -1 : 1);
    }
  }
  home.addEventListener('keydown', arrowKey);
  slides.addEventListener('focusin', event => {
    if (event.target.matches(':focus-visible')) setPlaying(false);
  });

  let start;
  image.addEventListener('touchstart', event => {
    start = event.touches.length === 1 ? event.touches[0] : null;
  }, {passive:true});
  image.addEventListener('touchcancel', () => { start = null; });
  image.addEventListener('touchend', event => {
    if (!start) return;
    const dx = event.changedTouches[0].clientX - start.clientX;
    const dy = event.changedTouches[0].clientY - start.clientY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > 2 * Math.abs(dy)) step(dx < 0 ? 1 : -1);
    start = null;
  }, {passive:true});

  if (dialog.showModal) {
    expand.hidden = false;
    expand.addEventListener('click', () => {
      setPlaying(false);
      home.style.height = home.offsetHeight + 'px';
      dialog.querySelector('.viewer').append(slides);
      dialog.showModal();
      document.body.classList.add('viewing');
      dialog.querySelector('[data-close]').focus();
    });
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('keydown', arrowKey);
    dialog.addEventListener('close', () => {
      setPlaying(false);
      home.append(slides);
      home.style.removeProperty('height');
      document.body.classList.remove('viewing');
      expand.focus({preventScroll:true});
    });
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.intersectionRatio >= .35;
      schedule();
    }, {threshold: .35}).observe(home);
  } else {
    visible = true;
  }
  image.addEventListener('load', schedule);
  image.addEventListener('error', schedule);
  document.addEventListener('visibilitychange', schedule);
  reduced.addEventListener('change', () => { if (reduced.matches) setPlaying(false); });
  slides.querySelector('.slide-controls').hidden = false;
  show(0);
  setPlaying(playing);
})();
