import test from 'node:test';
import assert from 'node:assert/strict';
import { checkArea } from '../lib/area.js';

test('areas from services.md are inside', () => {
  for (const a of ['Kothrud', 'Dahanukar Colony, Kothrud', 'Pimple Saudagar', 'Pimple Nilakh', 'Hinjewadi Phase 1', 'NIBM Road', 'koregaon park']) {
    assert.equal(checkArea(a).status, 'in', a);
  }
});
test('named cities outside Pune are out', () => {
  for (const a of ['Nashik', 'Talegaon Dabhade', 'Mumbai', 'lonavala']) assert.equal(checkArea(a).status, 'out', a);
});
test('areas not on the list are unknown, never out (forward with a flag)', () => {
  for (const a of ['Kharadi', 'Nanded City', 'Pune', 'somewhere near the airport', '']) assert.equal(checkArea(a).status, 'unknown', a);
});
test('an in-area word wins over a stray city mention', () => {
  assert.equal(checkArea('Baner, Pune').status, 'in');
});
