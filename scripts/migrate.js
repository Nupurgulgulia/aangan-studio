import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Set DATABASE_URL first');
const sql = neon(url);
for (const file of ['db/schema.sql', 'db/seed.sql']) {
  const statements = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
  for (const s of statements) await sql.query(s);
  console.log('applied', file);
}
const rows = await sql.query('select count(*)::int as n from designers');
console.log('designers:', rows[0].n);
