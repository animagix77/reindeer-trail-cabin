(() => {
  const art = document.querySelector('.blueprint-art');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const print = matchMedia('print');
  const clamp = value => Math.max(0, Math.min(1, value));
  const between = (value, from, to) => clamp((value - from) / (to - from));
  let drawing;
  let frame = 0;
  let nearby = true;
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

  function render() {
    frame = 0;
    if (!drawing) return;
    const top = art.getBoundingClientRect().top;
    const screen = document.documentElement.clientHeight;
    const p = motion.matches || print.matches ? 1 : between(screen - top, screen * .04, screen * .66);
    if (p === lastProgress) return;
    lastProgress = p;
    const [survey, plan, studs] = drawing.lines;
    drawLines(survey, .45 + .55 * between(p, 0, .15), .8 * (1 - between(p, .58, .96)));
    drawLines(plan, .14 + .86 * between(p, 0, .29), 1 - between(p, .52, .81));
    drawLines(studs, between(p, .18, .59), 1 - between(p, .61, .92));
    const spans = {base: [.47, .65], walls: [.55, .81], roof: [.68, .89], details: [.76, 1]};
    for (const coat of drawing.coats) paint(coat, between(p, ...spans[coat.group.dataset.build]));
  }

  function schedule() {
    if (!frame && nearby && drawing) frame = requestAnimationFrame(render);
  }

  function loadArt() {
    let svg;
    try { svg = art.contentDocument?.documentElement; } catch { return; }
    // For file previews and unavailable SVG scripting the object keeps its static finish.
    if (svg?.localName !== 'svg' || !svg.querySelector('.frame') || svg === drawing?.svg) return;
    drawing = {...prepareDrawing(svg), svg};
    lastProgress = -1;
    render();
  }

  art.addEventListener('load', loadArt);
  loadArt();
  window.addEventListener('scroll', schedule, {passive: true});
  window.addEventListener('resize', schedule);
  window.addEventListener('pageshow', render);
  motion.addEventListener('change', render);
  print.addEventListener('change', render);
  if ('IntersectionObserver' in window) {
    const proximity = new IntersectionObserver(([entry]) => {
      nearby = entry.isIntersecting;
      if (nearby) schedule();
    }, {rootMargin: '120px 0px'});
    proximity.observe(art);
  }

  // Reveal each row once. The document is fully readable without scripting.
  if (!('IntersectionObserver' in window) || !Element.prototype.animate) return;
  const rows = document.querySelectorAll('.photo-layout, .cabin-details, .stay-options');
  const reveals = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      reveals.unobserve(entry.target);
      if (motion.matches || print.matches) continue;
      [...entry.target.children].forEach((item, i) => {
        const animation = item.animate([
          {opacity: .65, transform: 'translateY(10px)'},
          {opacity: 1, transform: 'translateY(0)'}
        ], {duration: 550, delay: i * 65, easing: 'cubic-bezier(.18,.65,.25,1)', fill: 'backwards'});
        const cancel = () => animation.cancel();
        motion.addEventListener('change', cancel, {once: true});
        animation.finished.catch(() => {}).finally(() => motion.removeEventListener('change', cancel));
      });
    }
  }, {threshold: .08});
  rows.forEach(row => reveals.observe(row));
})();
