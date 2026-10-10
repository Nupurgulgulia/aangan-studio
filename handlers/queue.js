import { route } from '../lib/http.js';
import { getDb } from '../lib/db.js';
import { attentionQueue } from '../lib/store.js';

// Needs attention: calls the bot could not finish alone. Any signed-in designer can see and act on these.
export default route({ method: 'GET', auth: 'user', roles: ['designer'] }, async () => attentionQueue(getDb()));
