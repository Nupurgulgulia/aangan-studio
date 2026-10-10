import { route } from '../lib/http.js';
import { checkArea } from '../lib/area.js';

// Voice agent tool: is the caller's area inside Pune city or PCMC?
// "unknown" means forward with a flag, never decline.
export default route({}, async (req) => checkArea(req.body?.area));
