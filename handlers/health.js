import { route } from '../lib/http.js';
import { getDb } from '../lib/db.js';

export default route({ method: 'GET', auth: 'none' }, async () => {
  const rows = await getDb().query('select count(*)::int as designers from designers where active');
  return { ok: true, designers: rows[0].designers };
});
