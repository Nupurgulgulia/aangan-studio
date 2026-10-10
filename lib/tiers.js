import { addWorkingHours } from './time.js';

const HOUR = 60 * 60 * 1000;

export const TIERS = {
  hot: { label: 'HOT', window: 'within 2 working hours' },
  priority: { label: 'PRIORITY', window: 'within 24 hours' },
  standard: { label: 'STANDARD', window: 'within 48 hours' },
};

const LARGE_RESIDENTIAL_SQFT = 2000;
const LARGE_OFFICE_SQFT = 2000;
const URGENT_START_WEEKS = 6;
const SOON_START_WEEKS = 13;

// Fixed rules, not model judgment. Inputs come from what the caller said.
export function scoreLead(lead) {
  const reasons = [];
  const sqft = Number(lead.size_sqft) || 0;
  const type = (lead.project_type || '').toLowerCase();
  const weeks = lead.start_within_weeks == null ? null : Number(lead.start_within_weeks);

  let hot = false;
  if (lead.previous_failed_contact) {
    hot = true;
    reasons.push('earlier enquiry was not followed up');
  }
  if (lead.reversed_decline) {
    hot = true;
    reasons.push('declined by mistake, reversed on review');
  }
  if (type.includes('villa') || type.includes('bungalow') || sqft >= LARGE_RESIDENTIAL_SQFT) {
    hot = true;
    reasons.push(`large project (${sqft || 'villa'} sq ft)`);
  }
  if (type.includes('office') && sqft >= LARGE_OFFICE_SQFT) {
    hot = true;
    reasons.push(`large office (${sqft} sq ft)`);
  }
  if (weeks != null && weeks <= URGENT_START_WEEKS && lead.full_scope) {
    hot = true;
    reasons.push(`wants to start within ${weeks} weeks`);
  }
  if (hot) return { tier: 'hot', reasons };

  let priority = false;
  if (lead.referral) {
    priority = true;
    reasons.push('referral');
  }
  if (weeks != null && weeks <= SOON_START_WEEKS) {
    priority = true;
    reasons.push(`starting within about ${weeks} weeks`);
  }
  if (priority) return { tier: 'priority', reasons };

  return { tier: 'standard', reasons: ['standard enquiry'] };
}

export function callByDeadline(now, tier) {
  if (tier === 'hot') return addWorkingHours(now, 2);
  if (tier === 'priority') return new Date(now.getTime() + 24 * HOUR);
  return new Date(now.getTime() + 48 * HOUR);
}
