const easternDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', month: 'numeric', day: 'numeric'
});
const hourMs = 60 * 60 * 1000;

// A leap-year calendar keeps cues tied to month and day in every year.
function calendarDay(month, day) {
  return Date.UTC(2000, month - 1, day) / (24 * hourMs);
}

function localDay(instant) {
  const parts = Object.fromEntries(easternDate.formatToParts(instant).map(({type, value}) => [type, value]));
  return calendarDay(Number(parts.month), Number(parts.day));
}

function transition(day, startMonth, startDay, endMonth, endDay) {
  const start = calendarDay(startMonth, startDay);
  const end = calendarDay(endMonth, endDay);
  const t = Math.max(0, Math.min(1, (day - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

// These are art-directed seasonal transitions for the cabin's trees.
// In late November the crowns retain gold while fewer leaves are airborne.
function seasonOn(day) {
  const leafOut = transition(day, 3, 24, 5, 5);
  const leafOff = transition(day, 11, 19, 12, 16);
  return {
    spring: leafOut * (1 - transition(day, 5, 10, 6, 10)),
    autumn: transition(day, 9, 5, 10, 16) * (1 - leafOff),
    winter: 1 - leafOut + leafOff,
    leafFall: transition(day, 9, 15, 10, 16) * (1 - transition(day, 11, 10, 12, 10))
  };
}

export function smallwoodSeason(instant = Date.now()) {
  return seasonOn(localDay(instant));
}

export function watchSmallwoodSeason(onChange) {
  let lastDay, timer;
  function refresh() {
    clearTimeout(timer);
    const now = Date.now();
    const day = localDay(now);
    if (day !== lastDay) {
      lastDay = day;
      onChange(seasonOn(day));
    }
    // Eastern midnight always coincides with a UTC hour boundary, including
    // DST changes. Sleeping tabs catch up as soon as the walk is visible.
    if (!document.hidden) timer = setTimeout(refresh, hourMs - now % hourMs);
  }
  refresh();
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('pageshow', refresh);
  return () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', refresh);
    window.removeEventListener('pageshow', refresh);
  };
}
