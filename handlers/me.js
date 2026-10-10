import { route } from '../lib/http.js';
import { publicUser } from '../lib/auth.js';

// Who is signed in. The page calls this on load to decide between the login screen and the app.
export default route({ method: 'GET', auth: 'user', pendingChangeOk: true }, async (req) => ({ user: publicUser(req.user) }));
