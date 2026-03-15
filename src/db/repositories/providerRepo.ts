import { getDb } from '../index';
import type { Provider } from '../../lib/types';

const toProvider = (row: Record<string, unknown>): Provider => ({
  id: String(row.id),
  name: String(row.name),
  type: row.type === 'm3u' ? 'm3u' : 'xtream',
  url: String(row.url),
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
});

export const providerRepo = {
  async all(): Promise<Provider[]> {
    const res = await getDb().executeAsync(
      'SELECT id, name, type, url, created_at, updated_at FROM providers ORDER BY created_at ASC',
      []
    );
    const rows = res.rows?._array ?? [];
    return rows.map(toProvider);
  },

  async get(id: string): Promise<Provider | null> {
    const res = await getDb().executeAsync(
      'SELECT id, name, type, url, created_at, updated_at FROM providers WHERE id = ?',
      [id]
    );
    const rows = res.rows?._array ?? [];
    return rows.length ? toProvider(rows[0]) : null;
  },

  async insert(p: Provider): Promise<void> {
    await getDb().executeAsync(
      'INSERT OR REPLACE INTO providers (id, name, type, url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [p.id, p.name, p.type, p.url, p.createdAt, p.updatedAt]
    );
  },

  async delete(id: string): Promise<void> {
    getDb().execute('DELETE FROM providers WHERE id = ?', [id]);
  },
};
