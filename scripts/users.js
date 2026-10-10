// Manage logins from the command line (needs DATABASE_URL).
//   node scripts/users.js create            make a login for every designer that does not have one
//   node scripts/users.js reset <username>  new one-time password for someone who forgot theirs
//   node scripts/users.js demo-password     class demo only: every login gets the weak shared password 1234567890
// One-time passwords are written to credentials.local.txt (not committed) and never printed.
import { appendFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { DEMO_PASSWORD, ensureUsers, resetPassword, setDemoPasswords } from '../lib/users.js';
import { writeFileSync } from 'node:fs';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Set DATABASE_URL first');
const sql = neon(url.replace(/^(["'])(.*)\1$/, '$2'));
const db = { query: (text, params = []) => sql.query(text, params) };
const file = new URL('../credentials.local.txt', import.meta.url);

const [cmd, who] = process.argv.slice(2);
if (cmd === 'create') {
  const created = await ensureUsers(db);
  if (created.length) appendFileSync(file, created.map((u) => `${u.username}\t${u.password}\t${u.role}`).join('\n') + '\n');
  console.log(created.length ? `Created ${created.length} logins. One-time passwords are in credentials.local.txt` : 'Everyone already has a login.');
} else if (cmd === 'reset' && who) {
  const r = await resetPassword(db, who);
  if (!r) console.log(`No user called ${who}`);
  else {
    appendFileSync(file, `${r.username}\t${r.password}\treset\n`);
    console.log(`New one-time password for ${r.username} is in credentials.local.txt`);
  }
} else if (cmd === 'demo-password') {
  const rows = await setDemoPasswords(db);
  const lines = ['# WEAK: class demo password, shared by every login. Replace before any real use.', ...rows.map((u) => `${u.username}\t${DEMO_PASSWORD}\t${u.role}`)];
  writeFileSync(file, lines.join('\n') + '\n');
  console.log(`Set the demo password on ${rows.length} logins. Listed in credentials.local.txt (flagged weak).`);
} else {
  console.log('Usage: node scripts/users.js create | reset <username> | demo-password');
}
