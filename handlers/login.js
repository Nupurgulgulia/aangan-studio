import { route } from '../lib/http.js';
import { getDb } from '../lib/db.js';
import { hashPassword, verifyPassword, createSession, setCookie, isSecure, publicUser, MAX_FAILED_LOGINS, LOCK_MINUTES } from '../lib/auth.js';

let decoy;

// Sign in with a username and password. Five wrong passwords in a row lock the account for ten minutes.
export default route({ auth: 'none' }, async (req, res) => {
  const db = getDb();
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!username || !password) return res.status(400).json({ error: 'Enter your username and password.' });

  const user = (await db.query('select * from users where username = $1', [username]))[0];
  const now = new Date();
  if (user?.locked_until && new Date(user.locked_until) > now) {
    const mins = Math.ceil((new Date(user.locked_until) - now) / 60000);
    return res.status(429).json({ error: `Too many wrong attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}, or ask the studio admin to reset your password.` });
  }

  // Check a password even for an unknown username, so the response time does not reveal who has an account.
  decoy ??= await hashPassword('not-a-real-password-1');
  const ok = await verifyPassword(password, user?.password_hash || decoy);
  if (!user || !user.active || !ok) {
    if (user) {
      const failed = user.failed_attempts + 1;
      const lock = failed >= MAX_FAILED_LOGINS;
      await db.query('update users set failed_attempts = $1, locked_until = $2 where id = $3', [
        lock ? 0 : failed, lock ? new Date(now.getTime() + LOCK_MINUTES * 60000).toISOString() : null, user.id,
      ]);
    }
    return res.status(401).json({ error: 'Wrong username or password.' });
  }

  await db.query('update users set failed_attempts = 0, locked_until = null, last_login = $1 where id = $2', [now.toISOString(), user.id]);
  const token = await createSession(db, user.id, now);
  res.setHeader('set-cookie', setCookie(token, isSecure(req)));
  return { user: publicUser(user) };
});
