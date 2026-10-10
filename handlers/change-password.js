import { route } from '../lib/http.js';
import { getDb } from '../lib/db.js';
import { createSession, hashPassword, isSecure, passwordProblem, publicUser, setCookie, verifyPassword } from '../lib/auth.js';

// Replaces the one-time password (or any password). Ends every other session for the account.
export default route({ auth: 'user', pendingChangeOk: true }, async (req, res) => {
  const db = getDb();
  const { current, next } = req.body || {};
  const row = (await db.query('select password_hash from users where id = $1', [req.user.id]))[0];
  if (!(await verifyPassword(String(current || ''), row.password_hash))) return res.status(400).json({ error: 'Your current password is not right.' });
  if (current === next) return res.status(400).json({ error: 'Choose a password different from the current one.' });
  const problem = passwordProblem(next, req.user.username);
  if (problem) return res.status(400).json({ error: problem });
  await db.query('update users set password_hash = $1, must_change = false where id = $2', [await hashPassword(next), req.user.id]);
  await db.query('delete from sessions where user_id = $1', [req.user.id]);
  const token = await createSession(db, req.user.id);
  res.setHeader('set-cookie', setCookie(token, isSecure(req)));
  return { user: publicUser({ ...req.user, must_change: false }) };
});
