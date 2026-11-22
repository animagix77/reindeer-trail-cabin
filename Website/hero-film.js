(() => {
  const film = document.querySelector('#hero-film');
  const toggle = document.querySelector('.film-toggle');
  if (!film.canPlayType('video/mp4')) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  let wantsPlayback = !reducedMotion.matches && !connection?.saveData;
  let inView = !('IntersectionObserver' in window);

  function updateControl() {
    const label = film.paused ? 'Play background video' : 'Pause background video';
    toggle.classList.toggle('is-playing', !film.paused);
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
  }

  function syncPlayback() {
    if (!wantsPlayback || !inView || document.hidden) {
      film.pause();
      return;
    }
    if (!film.hasAttribute('src')) {
      const portrait = matchMedia('(max-width: 52rem) and (orientation: portrait)').matches;
      film.src = portrait ? film.dataset.portraitSrc : film.dataset.src;
    }
    film.play().catch(error => {
      // An off-screen pause can cancel an in-flight play request.
      if (error.name === 'AbortError') return;
      wantsPlayback = false;
      updateControl();
    });
  }

  function honorPreference() {
    if (reducedMotion.matches || connection?.saveData) {
      wantsPlayback = false;
      syncPlayback();
    }
  }

  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    wantsPlayback = film.paused;
    syncPlayback();
  });
  film.addEventListener('play', updateControl);
  film.addEventListener('pause', updateControl);
  film.addEventListener('playing', () => film.classList.add('has-frame'));
  film.addEventListener('error', () => {
    wantsPlayback = false;
    film.classList.remove('has-frame');
    toggle.hidden = true;
  });
  reducedMotion.addEventListener('change', honorPreference);
  connection?.addEventListener('change', honorPreference);
  document.addEventListener('visibilitychange', syncPlayback);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      syncPlayback();
    }).observe(film.parentElement);
  } else {
    syncPlayback();
  }
})();
