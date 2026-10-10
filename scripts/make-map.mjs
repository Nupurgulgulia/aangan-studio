// Draws the components map of the system as built: docs/class-materials/Components_Map_Chayya.svg
//   node scripts/make-map.mjs
// Same layout as the class template: one lane per actor, columns Trigger, Input, Context, Processing, AI, Output.
import { writeFileSync } from 'node:fs';

const W = 1480, TOP = 92, HEAD = 40, LANE_X = 24, ACTOR_W = 196, LH = 118;
const COLS = ['Trigger', 'Input', 'Context', 'Processing', 'AI', 'Output'];
const COL_W = (W - LANE_X * 2 - ACTOR_W) / COLS.length;
const colX = (i) => LANE_X + ACTOR_W + COL_W * i;
const colCx = (i) => colX(i) + COL_W / 2;

const KIND = {
  human: { fill: '#eaf2fd', stroke: '#2f6fd6', label: 'Human' },
  system: { fill: '#fff3e6', stroke: '#e0852b', label: 'System / data' },
  context: { fill: '#eaf7ee', stroke: '#3a9a63', label: 'Context (studio files)' },
  ai: { fill: '#f1ecfc', stroke: '#7b55d6', label: 'AI' },
  output: { fill: '#e7f6f3', stroke: '#13897d', label: 'Output' },
};

// Lanes, top to bottom.
const LANES = [
  ['Caller', 'Prospective client', 'human'],
  ['Vaani', 'Voice agent "Chayya"', 'system'],
  ['Studio knowledge', 'services, qualified, pricing', 'context'],
  ['LLM', 'gpt-4o (Groq fallback)', 'ai'],
  ['Backend', 'Neon Postgres + function', 'system'],
  ['Resend', 'Email', 'output'],
  ['Designer dashboard', 'Vercel, 14 logins', 'output'],
  ['Needs attention', 'Shared review queue', 'human'],
  ['HubSpot', 'CRM, deals', 'output'],
];
const laneY = (i) => TOP + HEAD + LH * i;

// Steps: [id, lane, col, kind, title, body lines, badge]
const STEPS = [
  [1, 0, 0, 'human', 'Calls the studio phone', ['Any hour, day or night.', 'Often after Instagram or', 'a referral.']],
  [2, 1, 1, 'system', 'Answers in seconds', ['English by default; Hindi or', 'Marathi only if the caller', 'speaks it. Never repeats itself.']],
  [3, 2, 2, 'context', 'Loaded before each call', ['What we do and don’t, Pune +', 'PCMC only, 6-week minimum,', 'Nikhil’s 5 criteria.'], 'cut'],
  [4, 3, 4, 'ai', 'Asks, reads back, decides', ['One question at a time, a to g.', 'Never guesses, never quotes', 'a price. Book, decline, escalate.']],
  [5, 4, 3, 'system', 'Rules decide the details', ['Area check · tier Hot / Priority /', 'Standard · call-by deadline ·', 'next designer, free 30-min slot.']],
  [6, 5, 5, 'output', 'Brief emailed to designer', ['Tier, call-by time, every answer,', 'link to the call. Escalations:', 'senior called back in 15 min.']],
  [7, 6, 5, 'output', 'Designer works the lead', ['Call-by countdown, calendar,', 'accept → called → held →', 'proposal → won.'], 'check'],
  [8, 7, 5, 'human', 'Every decline is reviewed', ['Same day. "Looks right" or', 'reverse: booked as Hot with', 'the next designer.'], 'check'],
  [9, 8, 5, 'output', 'Every booking is a deal', ['Contact + deal with tier, source,', 'designer. Status moves the', 'deal stage. Value on won.']],
  [10, 0, 5, 'output', 'Hears who calls, when', ['"Aryan will call you Monday', 'at 10." WhatsApp confirmation', 'saved (not connected yet).']],
];
const BOX_W = COL_W - 22, BOX_H = 98;
const pos = {};
for (const [id, lane, col] of STEPS) pos[id] = { x: colCx(col) - BOX_W / 2, y: laneY(lane) + (LH - BOX_H) / 2, cx: colCx(col), cy: laneY(lane) + LH / 2 };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const out = [];
const H = laneY(LANES.length) + 210;
out.push('<?xml version="1.0" encoding="UTF-8"?>');
out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Inter, Segoe UI, Arial, sans-serif">`);
out.push(`<defs>
  <marker id="a-teal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#13897d"/></marker>
  <marker id="a-ink" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#1d2b44"/></marker>
  <marker id="a-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#c8323a"/></marker>
</defs>`);
out.push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`);
out.push(`<text x="${LANE_X}" y="44" font-size="30" font-weight="800" fill="#1d2b44">Aangan Studio – Phone Enquiry Handler: Components Map (as built)</text>`);
out.push(`<text x="${LANE_X}" y="72" font-size="16" font-style="italic" fill="#4a5873">How a call becomes a designer-ready brief, step by step – Vaani · Neon · Vercel · Resend · HubSpot</text>`);

// Header row.
out.push(`<rect x="${LANE_X}" y="${TOP}" width="${W - LANE_X * 2}" height="${HEAD}" rx="6" fill="#1d2b44"/>`);
out.push(`<text x="${LANE_X + ACTOR_W / 2}" y="${TOP + 26}" text-anchor="middle" font-size="15" font-weight="700" fill="#fff">Actor / Step</text>`);
COLS.forEach((c, i) => out.push(`<text x="${colCx(i)}" y="${TOP + 26}" text-anchor="middle" font-size="15" font-weight="700" fill="#fff">${c}</text>`));

// Lanes and grid.
LANES.forEach(([name, sub, kind], i) => {
  const y = laneY(i);
  out.push(`<rect x="${LANE_X}" y="${y}" width="${ACTOR_W}" height="${LH}" fill="${KIND[kind].fill}"/>`);
  out.push(`<text x="${LANE_X + 18}" y="${y + LH / 2 - 4}" font-size="15" font-weight="700" fill="#1d2b44">${esc(name)}</text>`);
  out.push(`<text x="${LANE_X + 18}" y="${y + LH / 2 + 16}" font-size="12" font-style="italic" fill="#4a5873">${esc(sub)}</text>`);
  out.push(`<line x1="${LANE_X}" y1="${y + LH}" x2="${W - LANE_X}" y2="${y + LH}" stroke="#e3e7ee"/>`);
});
COLS.forEach((_, i) => out.push(`<line x1="${colX(i)}" y1="${TOP + HEAD}" x2="${colX(i)}" y2="${laneY(LANES.length)}" stroke="#e3e7ee"/>`));

// Arrows: elbow from one box to another.
function arrow(from, to, color = 'ink', label = '') {
  const a = pos[from], b = pos[to];
  const stroke = { ink: '#1d2b44', teal: '#13897d', red: '#c8323a' }[color];
  let d, lx, ly;
  if (b.cx > a.cx + 5) {
    const sx = a.x + BOX_W, sy = a.cy;
    const ty = b.cy > a.cy ? b.y : b.y + BOX_H;
    if (Math.abs(b.cy - a.cy) < 5) d = `M${sx},${sy} H${b.x}`;
    else d = `M${sx},${sy} H${b.cx} V${ty}`;
    lx = (sx + b.cx) / 2; ly = sy - 6;
  } else if (b.cx < a.cx - 5) {
    const sy = b.cy > a.cy ? a.y + BOX_H : a.y;
    d = `M${a.cx},${sy} V${b.cy} H${b.x + BOX_W}`;
    lx = (a.cx + b.x + BOX_W) / 2; ly = b.cy - 6;
  } else {
    d = b.cy > a.cy ? `M${a.cx},${a.y + BOX_H} V${b.y}` : `M${a.cx},${a.y} V${b.y + BOX_H}`;
    lx = a.cx + 8; ly = (a.cy + b.cy) / 2;
  }
  out.push(`<path d="${d}" fill="none" stroke="${stroke}" stroke-width="2.2" marker-end="url(#a-${color})"/>`);
  if (label) out.push(`<text x="${lx}" y="${ly}" text-anchor="middle" font-size="11" font-weight="700" fill="${stroke}">${esc(label)}</text>`);
}

// Output fan from the backend: a trunk on the right of the Processing column feeds every output box.
function fan(from, targets) {
  const a = pos[from];
  const trunkX = colX(5) - 14;
  const ys = targets.map((t) => pos[t].cy);
  out.push(`<path d="M${a.x + BOX_W},${a.cy} H${trunkX}" fill="none" stroke="#13897d" stroke-width="2.2"/>`);
  out.push(`<line x1="${trunkX}" y1="${Math.min(a.cy, ...ys)}" x2="${trunkX}" y2="${Math.max(a.cy, ...ys)}" stroke="#13897d" stroke-width="2.2"/>`);
  for (const t of targets) out.push(`<path d="M${trunkX},${pos[t].cy} H${pos[t].x}" fill="none" stroke="#13897d" stroke-width="2.2" marker-end="url(#a-teal)"/>`);
  out.push(`<rect x="${trunkX - 104}" y="${a.cy + 6}" width="84" height="20" rx="10" fill="#fff" stroke="#13897d"/>`);
  out.push(`<text x="${trunkX - 62}" y="${a.cy + 20}" text-anchor="middle" font-size="11" font-weight="700" fill="#13897d">✓ Booked</text>`);
}

arrow(1, 2);
arrow(2, 4, 'ink', 'live conversation');
arrow(3, 4, 'ink', 'rules + facts');
arrow(4, 5, 'ink', 'tool calls (np_*)');
fan(5, [10, 6, 7, 9]);
// Declines and escalations go from the decision straight to the review queue.
{
  const a = pos[4], b = pos[8];
  const x = a.x + 34;
  out.push(`<path d="M${x},${a.y + BOX_H} V${b.cy + 18} H${b.x}" fill="none" stroke="#c8323a" stroke-width="2.2" marker-end="url(#a-red)"/>`);
  out.push(`<rect x="${x - 62}" y="${pos[6].cy - 10}" width="124" height="20" rx="10" fill="#fff" stroke="#c8323a"/>`);
  out.push(`<text x="${x}" y="${pos[6].cy + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#c8323a">Declined / escalated</text>`);
}
// Boxes on top of the arrows.
for (const [id, , , kind, title, lines, badge] of STEPS) {
  const p = pos[id], k = KIND[kind];
  out.push(`<rect x="${p.x}" y="${p.y}" width="${BOX_W}" height="${BOX_H}" rx="8" fill="#fff" stroke="${k.stroke}" stroke-width="2"/>`);
  out.push(`<circle cx="${p.x + 4}" cy="${p.y + 4}" r="12" fill="${k.stroke}"/>`);
  out.push(`<text x="${p.x + 4}" y="${p.y + 8.5}" text-anchor="middle" font-size="12" font-weight="800" fill="#fff">${id}</text>`);
  out.push(`<text x="${p.x + 14}" y="${p.y + 24}" font-size="13" font-weight="800" fill="#1d2b44">${esc(title)}</text>`);
  lines.forEach((l, j) => out.push(`<text x="${p.x + 14}" y="${p.y + 42 + j * 15}" font-size="11.2" fill="#3b4760">${esc(l)}</text>`));
  if (badge === 'cut') {
    out.push(`<rect x="${p.x + BOX_W - 74}" y="${p.y + BOX_H - 2}" width="64" height="18" rx="4" fill="#c8323a"/>`);
    out.push(`<text x="${p.x + BOX_W - 42}" y="${p.y + BOX_H + 11}" text-anchor="middle" font-size="10" font-weight="800" fill="#fff">THE CUT</text>`);
  }
  if (badge === 'check') {
    out.push(`<rect x="${p.x + BOX_W - 128}" y="${p.y + BOX_H - 2}" width="120" height="18" rx="4" fill="#2f6fd6"/>`);
    out.push(`<text x="${p.x + BOX_W - 68}" y="${p.y + BOX_H + 11}" text-anchor="middle" font-size="10" font-weight="800" fill="#fff">HUMAN CHECKPOINT</text>`);
  }
}

// Bottom panel: Nikhil's two views.
const by = laneY(LANES.length) + 26;
out.push(`<line x1="${LANE_X}" y1="${by - 12}" x2="${W - LANE_X}" y2="${by - 12}" stroke="#9aa6ba" stroke-dasharray="6 5"/>`);
out.push(`<rect x="${LANE_X}" y="${by}" width="${W - LANE_X * 2}" height="132" rx="10" fill="#fff" stroke="#1d2b44" stroke-width="2"/>`);
out.push(`<rect x="${LANE_X}" y="${by}" width="${ACTOR_W}" height="132" rx="10" fill="#1d2b44"/>`);
out.push(`<circle cx="${LANE_X + ACTOR_W}" cy="${by + 4}" r="14" fill="#1d2b44" stroke="#fff" stroke-width="2"/><text x="${LANE_X + ACTOR_W}" y="${by + 9}" text-anchor="middle" font-size="12" font-weight="800" fill="#fff">11</text>`);
out.push(`<text x="${LANE_X + 22}" y="${by + 60}" font-size="17" font-weight="800" fill="#fff">Nikhil</text>`);
out.push(`<text x="${LANE_X + 22}" y="${by + 80}" font-size="12" font-style="italic" fill="#cbd3e1">Founder · two views</text>`);
const px = LANE_X + ACTOR_W + 24, pw = (W - LANE_X * 2 - ACTOR_W - 72) / 2;
out.push(`<text x="${px}" y="${by + 26}" font-size="13" font-weight="700" fill="#1d2b44">Nikhil never pulls numbers by hand again. Two views, each doing one job:</text>`);
const panel = (x, title, color, lines) => {
  out.push(`<rect x="${x}" y="${by + 38}" width="${pw}" height="82" rx="8" fill="#f6f8fb"/>`);
  out.push(`<text x="${x + 14}" y="${by + 58}" font-size="12" font-weight="800" fill="${color}">${esc(title)}</text>`);
  lines.forEach((l, j) => out.push(`<text x="${x + 14}" y="${by + 78 + j * 16}" font-size="11.5" fill="#3b4760">${esc(l)}</text>`));
};
panel(px, 'HUBSPOT – EVERY DEAL, PIPELINE & REVENUE', '#d0611f', ['Deal per booking with tier, source, designer · stage moves with the designer ·', 'won value on close · dashboard: deals by stage, won vs lost, closed, created ·', 'saved view "Aangan leads" with tier / designer / source columns.']);
panel(px + pw + 24, 'FOUNDER VIEW IN THE APP (nikhil login) – SPEED & COST', '#13897d', ['Calls answered · qualified % · won and won value · hot leads booked late ·', 'pipeline by stage, tier, source, designer · won value by month ·', 'voice minutes, cost of the agent, cost per qualified lead.']);

// Legend.
const ly = H - 26;
let lx = LANE_X;
for (const k of ['human', 'system', 'context', 'ai', 'output']) {
  out.push(`<rect x="${lx}" y="${ly - 11}" width="14" height="14" rx="3" fill="#fff" stroke="${KIND[k].stroke}" stroke-width="2"/>`);
  out.push(`<text x="${lx + 20}" y="${ly}" font-size="12" fill="#3b4760">${KIND[k].label}</text>`);
  lx += 34 + KIND[k].label.length * 6.6;
}
out.push(`<text x="${lx}" y="${ly}" font-size="12" font-weight="800" fill="#c8323a">THE CUT</text><text x="${lx + 62}" y="${ly}" font-size="12" fill="#3b4760">= no price quotes (pricing.md is internal only)</text>`);
lx += 340;
out.push(`<text x="${lx}" y="${ly}" font-size="12" font-weight="800" fill="#2f6fd6">HUMAN CHECKPOINT</text><text x="${lx + 128}" y="${ly}" font-size="12" fill="#3b4760">= a person decides</text>`);
out.push(`<text x="${W - LANE_X}" y="${ly}" text-anchor="end" font-size="11" fill="#7a869c">Built in Claude Code · versioned on GitHub · aangan-studio-psi.vercel.app</text>`);

out.push('</svg>');
const file = new URL('../docs/class-materials/Components_Map_Chayya.svg', import.meta.url);
writeFileSync(file, out.join('\n'));
console.log('wrote', file.pathname);
