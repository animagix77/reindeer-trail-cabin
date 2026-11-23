(() => {
  const art = document.querySelector('.blueprint-art');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const print = matchMedia('print');
  const clamp = value => Math.max(0, Math.min(1, value));
  const between = (value, from, to) => clamp((value - from) / (to - from));
  const buildDuration = 5000;
  let drawing;
  let frame = 0;
  let startedAt;
  let lastProgress = -1;

  function prepareDrawing(svg) {
    const lines = ['survey', 'plan', 'frame'].map(name => {
      const group = svg.querySelector('.' + name);
      const paths = [...group.querySelectorAll('path')];
      for (const path of paths) path.style.strokeDasharray = '1 1';
      return {group, paths, previous: -1};
    });

    // Each material is painted from the footing up. Normalized clip coordinates
    // follow each layer's bounds, including the pitched roof and porch railings.
    const defs = svg.querySelector('defs');
    const coats = [...svg.querySelectorAll('.finish > [data-build]')].map(group => {
      const clip = svg.ownerDocument.createElementNS(svg.namespaceURI, 'clipPath');
      const edge = svg.ownerDocument.createElementNS(svg.namespaceURI, 'polygon');
      clip.id = 'build-reveal-' + group.dataset.build;
      clip.setAttribute('clipPathUnits', 'objectBoundingBox');
      edge.setAttribute('points', '-.1,0 1.1,-.12 1.1,1.3 -.1,1.3');
      clip.append(edge);
      defs.append(clip);
      return {group, edge, clip, previous: -1};
    });
    return {lines, coats};
  }

  function drawLines(layer, amount, opacity) {
    layer.group.style.opacity = opacity;
    if (amount === layer.previous) return;
    layer.previous = amount;
    layer.paths.forEach((path, index) => {
      const delay = .44 * index / Math.max(1, layer.paths.length - 1);
      const length = between(amount, delay, delay + .56);
      path.style.strokeDashoffset = 1 - length;
    });
  }

  function paint(coat, amount) {
    if (amount === coat.previous) return;
    coat.previous = amount;
    coat.group.style.opacity = Math.min(1, amount * 6);
    if (amount === 1) {
      coat.group.removeAttribute('clip-path');
    } else {
      coat.edge.setAttribute('transform', 'translate(0 ' + (1.2 - 1.26 * amount) + ')');
      coat.group.setAttribute('clip-path', 'url(#' + coat.clip.id + ')');
    }
  }

  function render(p) {
    if (p === lastProgress) return;
    lastProgress = p;
    const [survey, plan, studs] = drawing.lines;
    drawLines(survey, .45 + .55 * between(p, 0, .15), .8 * (1 - between(p, .58, .96)));
    drawLines(plan, .14 + .86 * between(p, 0, .29), 1 - between(p, .52, .81));
    drawLines(studs, between(p, .18, .59), 1 - between(p, .61, .92));
    const spans = {base: [.47, .65], walls: [.55, .81], roof: [.68, .89], details: [.76, 1]};
    for (const coat of drawing.coats) paint(coat, between(p, ...spans[coat.group.dataset.build]));
  }

  function animate(now) {
    const progress = clamp((now - startedAt) / buildDuration);
    render(progress);
    frame = progress < 1 ? requestAnimationFrame(animate) : 0;
  }

  // Let the visitor see most of the sheet before drawing its first line.
  const readingMargin = '0px 0px -' + Math.round(Math.min(150, innerHeight * .2)) + 'px 0px';
  const artThresholds = [.65, .45, .25, .05];
  const entryObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    if (startedAt !== undefined || lastProgress === 1) return;
    if (!entries.some(entry => {
      const available = (entry.rootBounds?.height ?? innerHeight) / Math.max(1, entry.boundingClientRect.height);
      const threshold = artThresholds.find(ratio => ratio <= available) ?? .05;
      return entry.isIntersecting && entry.intersectionRatio >= threshold;
    })) return;
    entryObserver.disconnect();
    startedAt = performance.now();
    frame = requestAnimationFrame(animate);
  }, {threshold: artThresholds, rootMargin: readingMargin}) : null;

  function finish() {
    if (!drawing) return;
    entryObserver?.disconnect();
    cancelAnimationFrame(frame);
    frame = 0;
    render(1);
  }

  function loadArt() {
    let svg;
    try { svg = art.contentDocument?.documentElement; } catch { return; }
    // For file previews and unavailable SVG scripting the object keeps its static finish.
    if (svg?.localName !== 'svg' || !svg.querySelector('.frame') || svg === drawing?.svg) return;
    drawing = {...prepareDrawing(svg), svg};
    const progress = Math.max(0, lastProgress);
    lastProgress = -1;
    if (motion.matches || print.matches || !entryObserver || progress === 1) {
      finish();
    } else {
      render(progress);
      if (startedAt === undefined) entryObserver.observe(art);
    }
  }

  art.addEventListener('load', loadArt);
  loadArt();
  motion.addEventListener('change', event => { if (event.matches) finish(); });
  print.addEventListener('change', event => { if (event.matches) finish(); });

  // The waiting state is applied only when we can actually play the reveal.
  if (!('IntersectionObserver' in window) || !Element.prototype.animate) return;

  const title = {from: {opacity: .1, transform: 'translateY(30px)'}, duration: 1350};
  const copy = {from: {opacity: .18, transform: 'translateY(16px)'}, duration: 1050};
  const ink = {from: {opacity: .24}, duration: 850};
  const backdrop = {from: {opacity: .48}, duration: 1450};
  // Individual scale composes with the gallery's existing hover transform.
  const photo = {from: {opacity: .2, scale: '1.06'}, duration: 1450};
  const thumbnail = {from: {opacity: .28, scale: '.97'}, duration: 900};
  const pending = new WeakMap();
  const playing = new Map();
  function reveal(entries, observer) {
    for (const entry of entries) {
      if (!entry.isIntersecting || entry.intersectionRatio < observer.thresholds[0]) continue;
      const item = entry.target;
      observer.unobserve(item);
      const effect = pending.get(item);
      pending.delete(item);
      item.style.removeProperty('--reveal-wait');
      item.removeAttribute('data-reveal-wait');
      if (!effect || motion.matches || print.matches || item.matches(':focus-within') || item.closest(':focus-visible')) continue;
      // An empty final keyframe restores the author's opacity and transform.
      const animation = item.animate([effect.from, {}], {
        duration: effect.duration, delay: effect.delay, easing: 'cubic-bezier(.3,.08,.24,1)', fill: 'backwards'
      });
      playing.set(item, animation);
      animation.onfinish = animation.oncancel = () => playing.delete(item);
    }
  }

  const readingArea = new IntersectionObserver(reveal, {threshold: .35, rootMargin: readingMargin});
  // Large backdrops can exceed a short landscape viewport. The inset alone
  // keeps their start in view. Footer and picker items can reach a scroll limit.
  const largeMedia = new IntersectionObserver(reveal, {threshold: .1, rootMargin: readingMargin});
  const scrollEnd = new IntersectionObserver(reveal, {threshold: .35});

  function watch(item, effect, delay) {
    const observer = item.closest('footer, #guest-message, #pick-grid') ? scrollEnd
      : item.matches('.hero-photo, .tour-panel > img, .photo-tile img') ? largeMedia : readingArea;
    item.setAttribute('data-reveal-wait', '');
    item.style.setProperty('--reveal-wait', effect.from.opacity);
    pending.set(item, {...effect, delay});
    observer.observe(item);
  }

  function watchAll(selector, effect, delay = 0) {
    document.querySelectorAll(selector).forEach(item => watch(item, effect, delay));
  }

  watchAll('.hero-photo, .tour-panel > img', backdrop);
  watchAll('.masthead .wordmark, .wide-nav a, .nav-stay, .mobile-nav summary, .mobile-nav a', ink);
  watchAll('.hero-location, .intro-aside > .eyebrow, .section-top .eyebrow, #reviews-heading, .tour-inner > .eyebrow', ink);
  watchAll('.heading-line:first-child, .section-top h2, .reviews-score, #review-stays-title, .contact-intro h2', title, 40);
  watchAll('.heading-line:last-child', title, 280);
  watchAll('.aside-byline, .intro-main > p, .cabin-details p, .reviews-credit, .tour-inner > p:not(.eyebrow), .stay-options p, .contact-intro p', copy, 85);
  watchAll('.cabin-details h3, .stay-options h3', copy);
  watchAll('.hero-cta, .blueprint-link, .all-photos, .reviews-source, .reviews-date, .tour-inner .pill, .stay-options .pill', ink, 115);
  document.querySelectorAll('.facts li').forEach((item, index) => watch(item, copy, Math.min(index, 3) * 45));
  watchAll('.photo-tile img', photo);
  watchAll('.photo-tile figcaption', copy, 65);
  // The viewport observer also respects the review lane's horizontal clip.
  watchAll('.review-lane time', ink);
  watchAll('.review-lane h4', copy, 35);
  watchAll('.review-lane p', copy, 75);
  watchAll('#guest-message label:not(.contact-trap), #guest-email, #guest-note, #message-hint, #message-submit, #open-host-inbox', ink, 45);
  watchAll('.footer-inner > *', ink);

  // Each category rebuilds these tiles. Their buttons and focus rings stay put.
  const picker = document.querySelector('#pick-grid');
  new MutationObserver(changes => {
    for (const change of changes) {
      for (const tile of change.removedNodes) {
        for (const item of tile.children) {
          pending.delete(item);
          scrollEnd.unobserve(item);
        }
      }
      for (const tile of change.addedNodes) {
        watch(tile.querySelector('img'), thumbnail, 0);
        watch(tile.querySelector('span'), ink, 55);
      }
    }
  }).observe(picker, {childList: true});

  function stopReveals() {
    for (const animation of playing.values()) animation.cancel();
  }
  motion.addEventListener('change', () => { if (motion.matches) stopReveals(); });
  print.addEventListener('change', () => { if (print.matches) stopReveals(); });
  window.addEventListener('beforeprint', stopReveals);
  document.addEventListener('focusin', ({target}) => {
    for (const [item, animation] of playing) {
      if (item.contains(target) || target.contains(item)) animation.cancel();
    }
  });
})();
