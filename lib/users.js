import { hashPassword, passwordProblem } from './auth.js';

// The people who log in are the designers. The voice agent answers the phone, so there is no front desk role.
// One extra login, "chayya", is the voice agent's own test console: it shows what the agent did on each call.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

// A readable one-time password like k7mq-x4tn-p9wd. The person must replace it at first login.
export function generatePassword() {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
    const pw = `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
    if (!passwordProblem(pw)) return pw;
  }
}

// Creates any missing login. Returns the one-time passwords for the accounts it just created.
export async function ensureUsers(db) {
  const created = [];
  const add = async (username, name, role, designerId) => {
    const existing = await db.query('select id from users where username = $1', [username]);
    if (existing.length) return;
    const password = generatePassword();
    await db.query(
      'insert into users (username, name, role, designer_id, password_hash, must_change) values ($1,$2,$3,$4,$5,true)',
      [username, name, role, designerId, await hashPassword(password)],
    );
    created.push({ username, name, role, password });
  };
  const designers = await db.query('select id, name from designers where active order by rr_order');
  await add('chayya', 'Chayya', 'chayya', null);
  for (const d of designers) await add(d.name.toLowerCase().replace(/[^a-z0-9]/g, ''), d.name, 'designer', d.id);
  return created;
}

// Forgotten password: new one-time password, account unlocked, every open session ended.
export async function resetPassword(db, username) {
  const rows = await db.query('select id from users where username = $1', [String(username).toLowerCase()]);
  if (!rows.length) return null;
  const password = generatePassword();
  await db.query(
    'update users set password_hash = $1, must_change = true, failed_attempts = 0, locked_until = null where id = $2',
    [await hashPassword(password), rows[0].id],
  );
  await db.query('delete from sessions where user_id = $1', [rows[0].id]);
  return { username: String(username).toLowerCase(), password };
}
