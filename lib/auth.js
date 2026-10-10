import { timingSafeEqual } from 'node:crypto';

// Passwords are stored as PBKDF2-SHA256 hashes. Sessions are random tokens: the browser holds the token in an
// HttpOnly cookie, the database holds only its hash, so a leaked database cannot be replayed as a login.
const ITERATIONS = 100000;
const SESSION_HOURS = 12;
export const COOKIE = 'aangan_session';
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 10;

const enc = new TextEncoder();
const toB64 = (bytes) => Buffer.from(bytes).toString('base64url');
const fromB64 = (text) => new Uint8Array(Buffer.from(text, 'base64url'));

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(await derive(password, salt, ITERATIONS))}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, iterations, salt, hash] = String(stored).split('$');
  if (scheme !== 'pbkdf2' || !salt || !hash) return false;
  const got = Buffer.from(await derive(password, fromB64(salt), Number(iterations)));
  const want = Buffer.from(fromB64(hash));
  return got.length === want.length && timingSafeEqual(got, want);
}

// Returns a message to show the person, or null when the password is acceptable.
export function passwordProblem(password, username = '') {
  const p = String(password || '');
  if (p.length < 10) return 'Use at least 10 characters.';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Use at least one letter and one number.';
  if (username && p.toLowerCase().includes(String(username).toLowerCase())) return 'Do not put your username in your password.';
  return null;
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return Buffer.from(digest).toString('hex');
}

export async function createSession(db, userId, now = new Date()) {
  const token = toB64(crypto.getRandomValues(new Uint8Array(32)));
  await db.query('delete from sessions where expires_at < $1', [now.toISOString()]);
  await db.query('insert into sessions (token_hash, user_id, expires_at) values ($1,$2,$3)', [
    await sha256Hex(token), userId, new Date(now.getTime() + SESSION_HOURS * 3600e3).toISOString(),
  ]);
  return token;
}

export async function endSession(db, token) {
  if (token) await db.query('delete from sessions where token_hash = $1', [await sha256Hex(token)]);
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export const tokenFrom = (req) => parseCookies(req.headers?.cookie)[COOKIE] || null;

export const publicUser = (u) => ({ id: u.id, username: u.username, name: u.name, role: u.role, designer_id: u.designer_id, must_change: u.must_change });

export function setCookie(token, secure) {
  return `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_HOURS * 3600}${secure ? '; Secure' : ''}`;
}
export const clearCookie = (secure) => `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? '; Secure' : ''}`;

// Local development runs over plain http, where a Secure cookie would be dropped.
export function isSecure(req) {
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '');
  return !/^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host);
}

export async function userFromRequest(db, req, now = new Date()) {
  const token = tokenFrom(req);
  if (!token) return null;
  const rows = await db.query(
    `select u.id, u.username, u.name, u.role, u.designer_id, u.must_change
       from sessions s join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > $2 and u.active`,
    [await sha256Hex(token), now.toISOString()],
  );
  return rows[0] || null;
}
