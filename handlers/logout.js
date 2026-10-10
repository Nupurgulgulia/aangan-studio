import { route } from '../lib/http.js';
import { getDb } from '../lib/db.js';
import { clearCookie, endSession, isSecure, tokenFrom } from '../lib/auth.js';

export default route({ auth: 'none' }, async (req, res) => {
  await endSession(getDb(), tokenFrom(req));
  res.setHeader('set-cookie', clearCookie(isSecure(req)));
  return { ok: true };
});
