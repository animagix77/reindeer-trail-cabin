import test from 'node:test';
import assert from 'node:assert/strict';
import {smallwoodSeason, watchSmallwoodSeason} from './smallwood-season.js';

const seasonAt = iso => smallwoodSeason(Date.parse(iso));

test('seasonal color and leaf fall follow the Smallwood calendar', () => {
  assert.deepEqual(seasonAt('2026-01-10T12:00Z'), {spring: 0, autumn: 0, winter: 1, leafFall: 0});
  assert.deepEqual(seasonAt('2026-07-10T12:00Z'), {spring: 0, autumn: 0, winter: 0, leafFall: 0});
  assert(seasonAt('2026-04-28T12:00Z').spring > .85);
  const october = seasonAt('2026-10-20T12:00Z');
  assert.equal(october.autumn, 1);
  assert.equal(october.leafFall, 1);
  const lateFall = seasonAt('2026-11-21T12:00Z');
  assert(lateFall.autumn > .9 && lateFall.leafFall > 0 && lateFall.leafFall < october.leafFall);
  assert.equal(seasonAt('2026-12-12T12:00Z').leafFall, 0);
  assert.deepEqual(seasonAt('2024-04-28T12:00Z'), seasonAt('2027-04-28T12:00Z'));
  for (let d = Date.UTC(2024, 0, 1, 12); d < Date.UTC(2025, 0, 1); d += 86400000) {
    const weights = smallwoodSeason(d);
    assert(Object.values(weights).every(value => value >= 0 && value <= 1));
    assert(weights.spring + weights.autumn + weights.winter <= 1.00000001);
  }
});

test('sampling across either Eastern midnight ignores the visitor’s time zone', () => {
  for (const [before, midnight] of [
    ['2026-10-10T03:59:59.999Z', '2026-10-10T04:00:00Z'],
    ['2026-11-21T04:59:59.999Z', '2026-11-21T05:00:00Z']
  ]) {
    const yesterdayNoon = smallwoodSeason(Date.parse(midnight) - 12 * 3600000);
    assert.deepEqual(seasonAt(before), yesterdayNoon);
    assert.notDeepEqual(seasonAt(midnight), yesterdayNoon);
  }
});

test('an open walk updates once per local date and catches up after a sleeping tab', t => {
  t.mock.timers.enable({apis: ['Date', 'setTimeout'], now: Date.parse('2026-11-21T04:59:59.900Z')});
  const doc = Object.assign(new EventTarget(), {hidden: false});
  const win = new EventTarget();
  globalThis.document = doc;
  globalThis.window = win;
  t.after(() => { delete globalThis.document; delete globalThis.window; });
  const seen = [];
  const stop = watchSmallwoodSeason(state => seen.push(state));
  assert.deepEqual(seen, [seasonAt('2026-11-20T17:00Z')]);
  t.mock.timers.tick(100);
  assert.equal(seen.length, 2);
  assert.deepEqual(seen[1], seasonAt('2026-11-21T17:00Z'));
  win.dispatchEvent(new Event('pageshow'));
  t.mock.timers.tick(3600000);
  assert.equal(seen.length, 2);

  doc.hidden = true;
  doc.dispatchEvent(new Event('visibilitychange'));
  t.mock.timers.tick(3 * 86400000);
  assert.equal(seen.length, 2);
  doc.hidden = false;
  doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(seen.length, 3);
  assert.deepEqual(seen.at(-1), seasonAt('2026-11-24T17:00Z'));
  stop();
  t.mock.timers.tick(2 * 86400000);
  win.dispatchEvent(new Event('pageshow'));
  assert.equal(seen.length, 3);
});
