// Dummy design drawings, generated as SVG: furnished floor plans, material boards and kitchen elevations.
// They look like the real thing at a glance and are made up from the project's type and size.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Floor plan templates in plan units. Each room is [label, x, y, w, h, kind].
const PLANS = {
  bhk1: { w: 70, h: 50, rooms: [['Living', 0, 0, 36, 28, 'living'], ['Kitchen', 36, 0, 34, 20, 'kitchen'], ['Bedroom', 0, 28, 36, 22, 'bedroom'], ['Bath', 36, 20, 16, 30, 'bath'], ['Balcony', 52, 20, 18, 30, 'balcony']] },
  bhk2: { w: 100, h: 70, rooms: [['Living', 0, 0, 48, 36, 'living'], ['Dining', 0, 36, 30, 34, 'dining'], ['Kitchen', 30, 50, 18, 20, 'kitchen'], ['Passage', 30, 36, 18, 14, 'other'],
    ['Master bedroom', 48, 0, 30, 30, 'bedroom'], ['Bath', 78, 0, 22, 18, 'bath'], ['Balcony', 78, 18, 22, 12, 'balcony'], ['Bedroom 2', 48, 30, 28, 40, 'bedroom'], ['Bath 2', 76, 30, 24, 20, 'bath'], ['Utility', 76, 50, 24, 20, 'other']] },
  bhk3: { w: 100, h: 80, rooms: [['Living', 0, 0, 44, 40, 'living'], ['Dining', 0, 40, 30, 40, 'dining'], ['Kitchen', 30, 56, 14, 24, 'kitchen'], ['Passage', 30, 40, 14, 16, 'other'],
    ['Master bedroom', 44, 0, 30, 34, 'bedroom'], ['Master bath', 74, 0, 26, 18, 'bath'], ['Dressing', 74, 18, 26, 16, 'other'], ['Bedroom 2', 44, 34, 28, 24, 'bedroom'],
    ['Bedroom 3', 44, 58, 28, 22, 'bedroom'], ['Bath 2', 72, 34, 28, 20, 'bath'], ['Study', 72, 54, 28, 26, 'study']] },
  bhk4: { w: 100, h: 90, rooms: [['Living', 0, 0, 42, 44, 'living'], ['Dining', 0, 44, 28, 46, 'dining'], ['Kitchen', 28, 66, 14, 24, 'kitchen'], ['Passage', 28, 44, 14, 22, 'other'],
    ['Master bedroom', 42, 0, 32, 36, 'bedroom'], ['Master bath', 74, 0, 26, 20, 'bath'], ['Walk-in wardrobe', 74, 20, 26, 16, 'other'], ['Bedroom 2', 42, 36, 28, 26, 'bedroom'],
    ['Bedroom 3', 42, 62, 28, 28, 'bedroom'], ['Bath 2', 70, 36, 30, 18, 'bath'], ['Bedroom 4', 70, 54, 30, 36, 'bedroom']] },
  villa: { w: 110, h: 80, rooms: [['Living', 0, 0, 50, 40, 'living'], ['Dining', 50, 0, 34, 40, 'dining'], ['Kitchen', 84, 0, 26, 40, 'kitchen'], ['Guest bedroom', 0, 40, 34, 40, 'bedroom'],
    ['Bath', 34, 40, 16, 24, 'bath'], ['Staircase', 34, 64, 16, 16, 'other'], ['Home theatre', 50, 40, 24, 40, 'living'], ['Study', 74, 40, 36, 40, 'study']] },
  office: { w: 100, h: 60, rooms: [['Reception', 0, 0, 24, 24, 'living'], ['Workstations', 24, 0, 52, 40, 'work'], ['Cabin 1', 76, 0, 24, 20, 'study'], ['Cabin 2', 76, 20, 24, 20, 'study'],
    ['Meeting room', 0, 24, 24, 36, 'meeting'], ['Pantry', 24, 40, 28, 20, 'kitchen'], ['Store', 52, 40, 24, 20, 'other'], ['Breakout', 76, 40, 24, 20, 'living']] },
};

const FILL = { living: '#eaf2fb', dining: '#f1f6ea', kitchen: '#fdf1de', bedroom: '#f1ecf8', bath: '#e3f4f4', balcony: '#ecf6ec', study: '#f8efe6', work: '#eef1f6', meeting: '#f4eef0', other: '#f4f4f2' };

export function planKey(type) {
  const t = String(type).toLowerCase();
  if (t.includes('office')) return 'office';
  if (t.includes('villa')) return 'villa';
  if (t.includes('4bhk')) return 'bhk4';
  if (t.includes('3bhk')) return 'bhk3';
  if (t.includes('1bhk')) return 'bhk1';
  return 'bhk2';
}

function furniture(kind, x, y, w, h, rng) {
  const f = [];
  const r = (px, py, pw, ph, fill = '#c9b79c', rx = 1.5) => `<rect x="${(x + px * w).toFixed(1)}" y="${(y + py * h).toFixed(1)}" width="${(pw * w).toFixed(1)}" height="${(ph * h).toFixed(1)}" rx="${rx}" fill="${fill}" stroke="#7a6a52" stroke-width=".8"/>`;
  const c = (px, py, rad, fill = '#d9ccb4') => `<circle cx="${(x + px * w).toFixed(1)}" cy="${(y + py * h).toFixed(1)}" r="${rad}" fill="${fill}" stroke="#7a6a52" stroke-width=".8"/>`;
  if (kind === 'living') f.push(r(0.1, 0.62, 0.55, 0.22, '#b7c4d6'), r(0.1, 0.84, 0.15, 0.1, '#b7c4d6'), r(0.28, 0.4, 0.3, 0.14, '#d8c6a5'), r(0.72, 0.05, 0.22, 0.1, '#6b5a47'));
  if (kind === 'dining') f.push(r(0.25, 0.3, 0.5, 0.4, '#c9a97a'), c(0.2, 0.5, 5), c(0.8, 0.5, 5), c(0.4, 0.22, 5), c(0.6, 0.22, 5), c(0.4, 0.78, 5), c(0.6, 0.78, 5));
  if (kind === 'bedroom') f.push(r(0.25, 0.3, 0.5, 0.5, '#d7c9e6'), r(0.05, 0.16, 0.9, 0.1, '#9a8566'), r(0.15, 0.3, 0.1, 0.12, '#bdb0cc'), r(0.75, 0.3, 0.1, 0.12, '#bdb0cc'));
  if (kind === 'kitchen') f.push(r(0.04, 0.2, 0.92, 0.2, '#b9b5ad'), r(0.04, 0.4, 0.2, 0.55, '#b9b5ad'), r(0.4, 0.2, 0.14, 0.2, '#e6d9c3'));
  if (kind === 'bath') f.push(r(0.1, 0.08, 0.35, 0.3, '#ffffff'), c(0.72, 0.25, 6, '#ffffff'), r(0.1, 0.62, 0.8, 0.3, '#cfe4e6'));
  if (kind === 'study') f.push(r(0.1, 0.08, 0.6, 0.22, '#9a8566'), r(0.15, 0.4, 0.2, 0.18, '#c4b79c'));
  if (kind === 'meeting') f.push(r(0.2, 0.2, 0.6, 0.6, '#b7a38c'));
  if (kind === 'work') {
    const cols = 5; const rows = 3;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) f.push(r(0.06 + i * 0.19, 0.08 + j * 0.3, 0.15, 0.18, '#aab4c3', 1));
  }
  if (kind === 'balcony') f.push(c(0.3, 0.5, 5, '#a9cfa4'), c(0.65, 0.5, 5, '#a9cfa4'));
  return f.join('');
}

export function floorPlanSvg({ title, subtitle, type, sizeSqft, version, rng }) {
  const plan = PLANS[planKey(type)];
  const scale = 760 / plan.w, ox = 40, oy = 86;
  const flip = rng() > 0.5; // mirror half of the plans so neighbours do not look identical
  const rooms = plan.rooms.map(([label, x, y, w, h, kind]) => {
    const X = (flip ? plan.w - x - w : x) * scale + ox, Y = y * scale + oy, W = w * scale, H = h * scale;
    return `<g><rect x="${X.toFixed(1)}" y="${Y.toFixed(1)}" width="${W.toFixed(1)}" height="${H.toFixed(1)}" fill="${FILL[kind]}" stroke="#3b3b3b" stroke-width="3"/>${furniture(kind, X, Y, W, H, rng)}<text x="${(X + 8).toFixed(1)}" y="${(Y + 18).toFixed(1)}" font-size="13" font-weight="600" fill="#2a2a2a" stroke="#fff" stroke-width="3" paint-order="stroke">${esc(label)}</text></g>`;
  }).join('');
  const W = plan.w * scale + ox * 2, H = plan.h * scale + oy + 54;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" font-family="Helvetica,Arial,sans-serif">
<rect width="100%" height="100%" fill="#ffffff"/>
<text x="${ox}" y="34" font-size="20" font-weight="700" fill="#1b2a41">${esc(title)}</text>
<text x="${ox}" y="56" font-size="13" fill="#5c6b7a">${esc(subtitle)} · about ${esc(sizeSqft)} sq ft · Version ${version}</text>
${rooms}
<g transform="translate(${ox},${(plan.h * scale + oy + 22).toFixed(0)})"><line x1="0" y1="0" x2="100" y2="0" stroke="#333" stroke-width="2"/><line x1="0" y1="-5" x2="0" y2="5" stroke="#333"/><line x1="100" y1="-5" x2="100" y2="5" stroke="#333"/><text x="110" y="4" font-size="11" fill="#333">scale bar (not to scale)</text></g>
<g transform="translate(${(W - 60).toFixed(0)},${(plan.h * scale + oy + 24).toFixed(0)})"><path d="M0 0 L8 -22 L16 0 L8 -6 Z" fill="#333"/><text x="5" y="14" font-size="11" fill="#333">N</text></g>
<text x="${W - ox}" y="34" font-size="11" fill="#8a97a6" text-anchor="end">Aangan Studio · concept layout, not for construction</text>
</svg>`;
}

const FLOORS = [['Natural oak engineered wood', '#c9a36b'], ['Statuario-look vitrified tile, 800 x 1600', '#e8e4dc'], ['Wood-finish porcelain plank', '#b98d5e'], ['Kota stone, honed', '#8b8f8a'], ['Beige travertine-look tile', '#d9ccb4']];
const WALLS = [['Ivory matte emulsion', '#f4efe6'], ['Sage green accent wall', '#b9c4a8'], ['Terracotta feature wall', '#c0714a'], ['Soft grey, eggshell', '#d5d7d9'], ['Powder blue bedroom wall', '#c7d8e6']];
const SHUTTERS = [['Walnut veneer, matte', '#6b4a33'], ['Light ash laminate', '#d9c8aa'], ['White high-gloss acrylic', '#f5f5f3'], ['Fluted oak panel', '#b48a56'], ['Charcoal matte laminate', '#40444a']];
const COUNTERS = [['Black granite, polished', '#2b2b2c'], ['White-grey quartz', '#d6d6d2'], ['Calacatta-look quartz', '#e9e6e0']];
const ACCENTS = [['Brushed brass handles', '#b08d57'], ['Matte black fittings', '#262626'], ['Antique copper details', '#a45d3d']];
const FABRICS = [['Indigo textured upholstery', '#3b4a7a'], ['Mustard velvet', '#cf9c2a'], ['Olive linen', '#7d8450'], ['Oatmeal boucle', '#d8cdb9']];
const STYLES = ['Warm neutral', 'Earthy and handcrafted', 'Modern monochrome', 'Soft coastal', 'Heritage wood'];

export function materialBoardSvg({ title, version, rng }) {
  const picks = [['Flooring', rng.pick(FLOORS)], ['Walls', rng.pick(WALLS)], ['Wardrobes and shutters', rng.pick(SHUTTERS)], ['Kitchen counter', rng.pick(COUNTERS)], ['Accents', rng.pick(ACCENTS)], ['Upholstery', rng.pick(FABRICS)]];
  const style = rng.pick(STYLES);
  const cells = picks.map(([label, [name, color]], i) => {
    const x = 40 + (i % 3) * 250, y = 90 + Math.floor(i / 3) * 230;
    return `<g><rect x="${x}" y="${y}" width="230" height="170" rx="6" fill="${color}" stroke="#cfcfcf"/><rect x="${x}" y="${y + 170}" width="230" height="40" fill="#fff" stroke="#cfcfcf"/><text x="${x + 10}" y="${y + 188}" font-size="12" font-weight="700" fill="#1b2a41">${esc(label)}</text><text x="${x + 10}" y="${y + 203}" font-size="11" fill="#5c6b7a">${esc(name)}</text></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 560" font-family="Helvetica,Arial,sans-serif"><rect width="100%" height="100%" fill="#fafaf8"/>
<text x="40" y="38" font-size="20" font-weight="700" fill="#1b2a41">${esc(title)}</text><text x="40" y="60" font-size="13" fill="#5c6b7a">Material board · ${esc(style)} · Version ${version}</text>${cells}
<text x="760" y="540" font-size="11" fill="#8a97a6" text-anchor="end">Aangan Studio · swatches are indicative; final shades are checked at the showroom</text></svg>`;
}

export function kitchenElevationSvg({ title, version, rng }) {
  const [shutterName, shutter] = rng.pick(SHUTTERS);
  const [, counter] = rng.pick(COUNTERS);
  const tall = rng.chance(0.5);
  const base = Array.from({ length: 5 }, (_, i) => `<rect x="${120 + i * 100}" y="250" width="96" height="96" fill="${shutter}" stroke="#222" stroke-width="1.5"/><circle cx="${120 + i * 100 + 80}" cy="290" r="3" fill="#b08d57"/>`).join('');
  const wall = Array.from({ length: 4 }, (_, i) => `<rect x="${220 + i * 100}" y="70" width="96" height="100" fill="${shutter}" stroke="#222" stroke-width="1.5"/><circle cx="${220 + i * 100 + 80}" cy="150" r="3" fill="#b08d57"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 440" font-family="Helvetica,Arial,sans-serif"><rect width="100%" height="100%" fill="#ffffff"/>
<text x="40" y="34" font-size="20" font-weight="700" fill="#1b2a41">${esc(title)}</text><text x="40" y="54" font-size="13" fill="#5c6b7a">Kitchen elevation · ${esc(shutterName)} · Version ${version}</text>
<rect x="100" y="64" width="580" height="290" fill="#f6f2ea" stroke="#999"/>
${tall ? `<rect x="120" y="70" width="90" height="276" fill="${shutter}" stroke="#222" stroke-width="1.5"/><rect x="128" y="190" width="74" height="60" fill="#444" stroke="#222"/><text x="165" y="224" font-size="10" fill="#fff" text-anchor="middle">oven</text>` : ''}
${wall}<rect x="120" y="240" width="560" height="10" fill="${counter}" stroke="#222"/>${base}
<rect x="300" y="168" width="120" height="70" fill="#e8e3da" stroke="#bbb"/><rect x="330" y="236" width="60" height="6" fill="#222"/>
<g stroke="#555" stroke-width="1"><line x1="100" y1="385" x2="680" y2="385"/><line x1="100" y1="379" x2="100" y2="391"/><line x1="680" y1="379" x2="680" y2="391"/></g><text x="390" y="404" font-size="11" fill="#555" text-anchor="middle">overall width about 11 ft 6 in (dimensions to be confirmed on site)</text>
</svg>`;
}
