// Vertical page travel moves the stories until a visitor takes over the rail.
(() => {
  const section = document.querySelector('#guest-reviews');
  const lane = section.querySelector('#review-lane');
  const controls = section.querySelector('.reviews-controls');
  const [previous, next] = controls.querySelectorAll('button');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let manual = false;
  let visible = false;
  let frame = 0;
  let lastAutomaticPosition = lane.scrollLeft;

  function updateControls() {
    const end = lane.scrollWidth - lane.clientWidth;
    controls.hidden = end < 2;
    previous.disabled = lane.scrollLeft < 1;
    next.disabled = lane.scrollLeft >= end - 1;
  }

  function update() {
    frame = 0;
    if (visible && !manual && !reducedMotion.matches) {
      const rect = section.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, (window.innerHeight - rect.top) / (window.innerHeight + rect.height)));
      lane.scrollLeft = progress * (lane.scrollWidth - lane.clientWidth);
      lastAutomaticPosition = lane.scrollLeft;
    }
    updateControls();
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  for (const button of [previous, next]) {
    button.addEventListener('click', () => {
      manual = true;
      const direction = Number(button.dataset.reviewStep);
      // Page scrolling may have left a card half visible. Land manual steps
      // on the beginning of a story, regardless of the starting offset.
      const position = lane.scrollLeft;
      const left = lane.getBoundingClientRect().left;
      const stops = [...lane.children].map(card => card.getBoundingClientRect().left - left + position);
      const target = direction > 0
        ? (stops.find(stop => stop > position + 2) ?? lane.scrollWidth)
        : (stops.reverse().find(stop => stop < position - 2) ?? 0);
      lane.scrollTo({left: target, behavior: reducedMotion.matches ? 'instant' : 'smooth'});
    });
  }
  lane.addEventListener('scroll', () => {
    if (Math.abs(lane.scrollLeft - lastAutomaticPosition) > 1) manual = true;
    updateControls();
  }, {passive: true});
  lane.addEventListener('keydown', () => { manual = true; });

  const observe = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) schedule();
    else manual = false;
  });
  observe.observe(section);
  new ResizeObserver(schedule).observe(lane);
  window.addEventListener('scroll', () => { if (visible) schedule(); }, {passive: true});
  window.addEventListener('resize', schedule);
  reducedMotion.addEventListener('change', schedule);
  updateControls();
})();
