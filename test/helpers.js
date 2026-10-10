import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { hashPassword, createSession } from '../lib/auth.js';

export async function testDb() {
  const pg = new PGlite();
  for (const f of ['db/schema.sql', 'db/seed.sql']) {
    await pg.exec(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'));
  }
  const db = { query: async (text, params = []) => (await pg.query(text, params)).rows };
  globalThis.__testDb = db;
  return db;
}

// A Wednesday 11:00 AM IST
export const NOW = new Date(Date.UTC(2026, 9, 7, 5, 30));

export function fakeRes() {
  const res = { statusCode: 200, body: null, writableEnded: false, headers: {} };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; return res; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; res.writableEnded = true; return res; };
  res.sendFile = (buf, type, headers) => { res.file = { buf, type, headers }; res.writableEnded = true; return res; };
  return res;
}

export const PASSWORD = 'Test-pass-123';
let hashed;

// Adds a login and returns its id. A designer login is tied to the designer of the same name.
export async function addUser(db, username, role = 'designer', { mustChange = false } = {}) {
  hashed ??= await hashPassword(PASSWORD);
  const d = role === 'designer' ? (await db.query('select id, name from designers where lower(name) = $1', [username]))[0] : null;
  const rows = await db.query(
    'insert into users (username, name, role, designer_id, password_hash, must_change) values ($1,$2,$3,$4,$5,$6) returning id',
    [username, d?.name || username, role, d?.id || null, hashed, mustChange],
  );
  return rows[0].id;
}

// A signed-in cookie header for a new login.
export async function signedIn(db, username, role = 'designer', opts) {
  const id = await addUser(db, username, role, opts);
  return { cookie: `aangan_session=${await createSession(db, id)}`, 'content-type': 'application/json' };
}

// Calls a handler the way the server would.
export async function request(mod, { method = 'POST', headers = {}, body = {}, query = {} } = {}) {
  const handler = (await import(`../handlers/${mod}.js`)).default;
  const res = fakeRes();
  await handler({ method, headers, body, query }, res);
  return res;
}
