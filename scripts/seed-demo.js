// Fills the database with believable demo data, or removes it again.
//   node scripts/seed-demo.js            (re)create the demo data, dated from today
//   node scripts/seed-demo.js --remove   delete only the rows this script created
// Needs DATABASE_URL. Drawings are written to public/designs.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { seedDemo, removeDemo } from '../lib/demo/seed.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Set DATABASE_URL first');
const sql = neon(url.replace(/^(["'])(.*)\1$/, '$2'));
const db = { query: (text, params = []) => sql.query(text, params) };

if (process.argv.includes('--remove')) {
  console.log('removed', await removeDemo(db), 'demo calls (and their projects, bookings and messages)');
} else {
  const designsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'designs');
  console.log(await seedDemo(db, { designsDir }));
}
