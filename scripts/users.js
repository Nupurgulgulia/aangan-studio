// Manage logins from the command line (needs DATABASE_URL).
//   node scripts/users.js create            make a login for every designer that does not have one
//   node scripts/users.js reset <username>  new one-time password for someone who forgot theirs
// One-time passwords are written to credentials.local.txt (not committed) and never printed.
import { appendFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { ensureUsers, resetPassword } from '../lib/users.js';

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
} else {
  console.log('Usage: node scripts/users.js create | reset <username>');
}
