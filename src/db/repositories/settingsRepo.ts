import { getDb } from '../index';

export const settingsRepo = {
  async get(key: string): Promise<string | null> {
    const res = await getDb().executeAsync('SELECT value FROM settings WHERE key = ?', [key]);
    const rows = res.rows?._array ?? [];
    return rows.length ? String(rows[0].value) : null;
  },

  async set(key: string, value: string): Promise<void> {
    await getDb().executeAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  },

  async delete(key: string): Promise<void> {
    await getDb().executeAsync('DELETE FROM settings WHERE key = ?', [key]);
  },
};
