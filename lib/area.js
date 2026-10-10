// From services.md. Areas not on either list are "unknown" and should be forwarded with a flag, never declined.
const IN_AREA = [
  'kothrud', 'baner', 'aundh', 'wakad', 'koregaon park', 'kalyani nagar', 'viman nagar', 'hadapsar',
  'magarpatta', 'nibm', 'kondhwa', 'undri', 'shivane', 'warje', 'erandwane', 'deccan',
  'pimpri', 'chinchwad', 'pimple saudagar', 'pimple nilakh', 'ravet', 'hinjewadi', 'pune', 'pcmc',
  'pimpri chinchwad', 'pimpri-chinchwad',
];

const OUT_OF_AREA = ['talegaon', 'lonavala', 'lonavla', 'nashik', 'nasik', 'mumbai', 'bombay', 'navi mumbai', 'thane', 'satara', 'kolhapur', 'nagpur', 'bangalore', 'bengaluru', 'delhi', 'hyderabad'];

function normalise(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mentions(text, name) {
  return new RegExp(`(^|\\s)${name.replace(/[-\s]/g, '[-\\s]?')}(\\s|$)`).test(text);
}

export function checkArea(areaText) {
  const text = normalise(areaText);
  if (!text) return { status: 'unknown', reason: 'no area given' };

  const out = OUT_OF_AREA.find((n) => mentions(text, n));
  const inside = IN_AREA.filter((n) => n !== 'pune' && n !== 'pcmc').find((n) => mentions(text, n));

  if (out && !inside) return { status: 'out', matched: out };
  if (inside) return { status: 'in', matched: inside };
  if (mentions(text, 'pune') || mentions(text, 'pcmc')) {
    return { status: 'unknown', reason: 'Pune named but area not on the list; forward with a flag' };
  }
  return { status: 'unknown', reason: 'area not on the list; forward with a flag' };
}
