import { neon } from '@neondatabase/serverless';

let client;

// Returns { query(text, params) -> rows[] }. Tests install an in-memory database on globalThis.__testDb.
export function getDb() {
  if (globalThis.__testDb) return globalThis.__testDb;
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    const sql = neon(url);
    client = { query: (text, params = []) => sql.query(text, params) };
  }
  return client;
}
