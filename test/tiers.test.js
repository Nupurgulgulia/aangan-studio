import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreLead, callByDeadline } from '../lib/tiers.js';
import { NOW } from './helpers.js';
import { toIST } from '../lib/time.js';

test('villa is hot (T12)', () => assert.equal(scoreLead({ project_type: 'villa', size_sqft: 5500 }).tier, 'hot'));
test('possession in six weeks with full scope is hot (T15)', () =>
  assert.equal(scoreLead({ project_type: '2BHK full home', size_sqft: 875, start_within_weeks: 6, full_scope: true }).tier, 'hot'));
test('large office is hot (F05)', () => assert.equal(scoreLead({ project_type: 'office', size_sqft: 2200 }).tier, 'hot'));
test('earlier failed contact is hot (T16)', () => assert.equal(scoreLead({ project_type: '3BHK', previous_failed_contact: true }).tier, 'hot'));
test('referral is priority (T01)', () => assert.equal(scoreLead({ project_type: '3BHK', size_sqft: 1400, referral: true, start_within_weeks: 26 }).tier, 'priority'));
test('plain enquiry is standard', () => assert.equal(scoreLead({ project_type: '2BHK', size_sqft: 900, start_within_weeks: 20 }).tier, 'standard'));

test('deadlines: standard 48h, priority 24h, hot 2 working hours', () => {
  assert.equal(callByDeadline(NOW, 'standard') - NOW, 48 * 3600e3);
  assert.equal(callByDeadline(NOW, 'priority') - NOW, 24 * 3600e3);
  assert.equal(callByDeadline(NOW, 'hot') - NOW, 2 * 3600e3);
});
test('hot deadline counts only working time: Saturday 6:30 PM rolls to Monday', () => {
  const sat630pm = new Date(Date.UTC(2026, 9, 10, 13, 0));
  const d = toIST(callByDeadline(sat630pm, 'hot'));
  assert.equal(d.weekday, 1);
  assert.equal(d.minutes, 11 * 60 + 30);
});
