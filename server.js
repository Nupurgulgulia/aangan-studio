// Local server: runs the same handlers as the deployed functions, plus the two screens.
// Uses Neon when DATABASE_URL is set, otherwise a local test database in ./.data
import http from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
if (existsSync(path.join(root, '.env'))) {
  for (const line of readFileSync(path.join(root, '.env'), 'utf8').split('\n')) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    const v = m && m[2].replace(/^(["'])(.*)\1$/, '$2');
    if (m && v && !process.env[m[1]]) process.env[m[1]] = v;
  }
}

// `npm run dev` ignores the Neon address in .env and uses the throwaway local database.
if (process.argv.includes('--local')) delete process.env.DATABASE_URL;

if (!process.env.DATABASE_URL) {
  const { PGlite } = await import('@electric-sql/pglite');
  mkdirSync(path.join(root, '.data'), { recursive: true });
  const pg = new PGlite(path.join(root, '.data', 'pglite'));
  for (const f of ['db/schema.sql', 'db/seed.sql']) await pg.exec(readFileSync(path.join(root, f), 'utf8'));
  globalThis.__testDb = { query: async (t, p = []) => (await pg.query(t, p)).rows };
  console.log('Using the local test database (set DATABASE_URL to use Neon).');
} else {
  console.log('Using Neon.');
}

if (globalThis.__testDb && process.argv.includes('--demo')) {
  const { seedDemo } = await import('./lib/demo/seed.js');
  console.log('Demo data:', JSON.stringify(await seedDemo(globalThis.__testDb, { designsDir: path.join(root, 'public', 'designs') })));
}

const handlers = {};
for (const name of [
  'health', 'check-area', 'book', 'log-call', 'call-update', 'telegram', 'login', 'logout', 'me', 'change-password',
  'queue', 'calendar', 'review', 'call', 'projects', 'project', 'file', 'project-photo', 'project-design', 'project-create', 'project-update', 'event-add', 'item-delete', 'my-leads', 'set-status', 'chayya',
]) {
  handlers[name] = (await import(`./handlers/${name}.js`)).default;
}
const pages = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/app.css': ['app.css', 'text/css; charset=utf-8'],
};

// With the local test database, create the logins on first start and keep the one-time passwords in .data.
if (globalThis.__testDb) {
  const { ensureUsers } = await import('./lib/users.js');
  const created = await ensureUsers(globalThis.__testDb);
  if (created.length) {
    const file = path.join(root, '.data', 'credentials.txt');
    writeFileSync(file, created.map((u) => `${u.username}\t${u.password}\t${u.role}`).join('\n') + '\n');
    console.log(`Created ${created.length} logins. One-time passwords are in ${file}`);
  }
}

const TYPES = { '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const asset = /^\/(photos|designs)\/([\w.-]+\.(jpg|svg))$/.exec(url.pathname);
  if (asset) {
    const file = path.join(root, 'public', asset[1], asset[2]);
    if (!existsSync(file)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] });
    return res.end(readFileSync(file));
  }
  if (pages[url.pathname]) {
    const [file, type] = pages[url.pathname];
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    return res.end(readFileSync(path.join(root, 'public', file)));
  }
  const m = /^\/api\/([a-z-]+)$/.exec(url.pathname);
  if (!m || !handlers[m[1]]) { res.writeHead(404); return res.end('not found'); }
  let body = '';
  for await (const chunk of req) body += chunk;
  try { req.body = body ? JSON.parse(body) : {}; } catch { req.body = {}; }
  req.query = Object.fromEntries(url.searchParams);
  res.status = (c) => { res.statusCode = c; return res; };
  res.sendFile = (buf, type, headers = {}) => { res.writeHead(200, { ...headers, 'content-type': type }); res.end(buf); return res; };
  res.json = (b) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(b)); return res; };
  await handlers[m[1]](req, res);
}).listen(process.env.PORT || 3000, () => console.log(`Listening on http://localhost:${process.env.PORT || 3000}`));
