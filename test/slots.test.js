import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSlots, pickDesigner } from '../lib/slots.js';
import { callByDeadline } from '../lib/tiers.js';
import { toIST, speakSlot } from '../lib/time.js';
import { NOW } from './helpers.js';

const designers = Array.from({ length: 14 }, (_, i) => ({ id: i + 1, name: `D${i}`, rr_order: i }));

test('slots fall on the half hour inside studio hours and skip Sunday', () => {
  const sat = new Date(Date.UTC(2026, 9, 10, 4, 0));
  const slots = generateSlots(sat, new Date(sat.getTime() + 3 * 24 * 3600e3));
  for (const s of slots) {
    const t = toIST(s);
    assert.notEqual(t.weekday, 0);
    assert.ok(t.minutes >= 600 && t.minutes + 30 <= 1140 && t.minutes % 30 === 0);
  }
});

test('first lead goes to the designer at the pointer, then rotation advances', () => {
  const dl = callByDeadline(NOW, 'standard');
  const a = pickDesigner({ designers, nextIndex: 0, now: NOW, deadline: dl, bookedByDesigner: new Map() });
  assert.equal(a.designer.id, 1);
  assert.equal(a.nextIndex, 1);
  const z = pickDesigner({ designers, nextIndex: 13, now: NOW, deadline: dl, bookedByDesigner: new Map() });
  assert.equal(z.designer.id, 14);
  assert.equal(z.nextIndex, 0);
});

test('a designer with no free slot in the window is skipped', () => {
  const dl = callByDeadline(NOW, 'hot');
  const all = new Set(generateSlots(NOW, dl).map((d) => d.getTime()));
  const booked = new Map([[1, all]]);
  const p = pickDesigner({ designers, nextIndex: 0, now: NOW, deadline: dl, bookedByDesigner: booked });
  assert.equal(p.designer.id, 2);
  assert.deepEqual(p.skipped, [1]);
  assert.equal(p.windowMissed, false);
});

test('if nobody is free in the window, the earliest slot is booked and flagged', () => {
  const dl = callByDeadline(NOW, 'hot');
  const all = new Set(generateSlots(NOW, dl).map((d) => d.getTime()));
  const booked = new Map(designers.map((d) => [d.id, all]));
  const p = pickDesigner({ designers, nextIndex: 0, now: NOW, deadline: dl, bookedByDesigner: booked });
  assert.equal(p.windowMissed, true);
  assert.ok(p.slot > dl);
});

test('the slot is never inside the 15 minute lead time', () => {
  const dl = callByDeadline(NOW, 'hot');
  const p = pickDesigner({ designers, nextIndex: 0, now: NOW, deadline: dl, bookedByDesigner: new Map() });
  assert.ok(p.slot - NOW >= 15 * 60e3);
});

test('speaking a slot', () => {
  assert.equal(speakSlot(new Date(Date.UTC(2026, 9, 7, 8, 0)), NOW), 'today at 1:30 PM');
  assert.equal(speakSlot(new Date(Date.UTC(2026, 9, 8, 6, 0)), NOW), 'tomorrow at 11:30 AM');
  assert.equal(speakSlot(new Date(Date.UTC(2026, 9, 9, 5, 30)), NOW), 'Friday at 11 AM');
});
